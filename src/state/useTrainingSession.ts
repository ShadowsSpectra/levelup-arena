import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../config/roles'
import { localQuestionSource } from '../content/questionSource'
import {
  createTraining,
  createTrainingAnswer,
  createTrainingResult,
} from '../services/trainingEngine'
import type {
  TrainingAnswer,
  TrainingQuestion,
  TrainingResult,
} from '../types/training'

type TrainingStatus = 'loading' | 'ready' | 'empty' | 'result' | 'error'

export function useTrainingSession(role: RoleId, level: number) {
  const [status, setStatus] = useState<TrainingStatus>('loading')
  const [questions, setQuestions] = useState<TrainingQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerConfirmed, setAnswerConfirmed] = useState(false)
  const [answers, setAnswers] = useState<TrainingAnswer[]>([])
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [runNumber, setRunNumber] = useState(0)
  const previousQuestionIds = useRef<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadTraining() {
      setStatus('loading')

      try {
        const nextQuestions = await createTraining({
          role,
          level,
          source: localQuestionSource,
          previousQuestionIds: previousQuestionIds.current,
        })

        if (cancelled) return

        setQuestions(nextQuestions)
        setCurrentIndex(0)
        setSelectedAnswer(null)
        setAnswerConfirmed(false)
        setAnswers([])
        setResult(null)
        setStatus(nextQuestions.length === 0 ? 'empty' : 'ready')
      } catch (error) {
        if (import.meta.env.DEV) console.error('[Training] Failed to create training.', error)
        if (!cancelled) setStatus('error')
      }
    }

    void loadTraining()

    return () => {
      cancelled = true
    }
  }, [level, role, runNumber])

  const currentQuestion = questions[currentIndex] ?? null

  function selectAnswer(answerIndex: number) {
    if (!answerConfirmed) setSelectedAnswer(answerIndex)
  }

  function confirmAnswer() {
    if (!currentQuestion || selectedAnswer === null || answerConfirmed) return

    const answer = createTrainingAnswer(currentQuestion, selectedAnswer)
    setAnswers((current) => [...current, answer])
    setAnswerConfirmed(true)
  }

  function goNext() {
    if (!answerConfirmed) return

    if (currentIndex === questions.length - 1) {
      setResult(createTrainingResult(answers))
      setStatus('result')
      return
    }

    setCurrentIndex((current) => current + 1)
    setSelectedAnswer(null)
    setAnswerConfirmed(false)
  }

  function restart() {
    previousQuestionIds.current = questions.map((question) => question.id)
    setRunNumber((current) => current + 1)
  }

  return {
    status,
    questions,
    currentQuestion,
    currentIndex,
    selectedAnswer,
    answerConfirmed,
    result,
    selectAnswer,
    confirmAnswer,
    goNext,
    restart,
  }
}
