import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../config/roles'
import { localQuestionSource } from '../content/questionSource'
import {
  createTraining,
  createTrainingAnswer,
  createTrainingResult,
} from '../services/trainingEngine'
import type { TrainingAward } from '../services/progression'
import type {
  TrainingAnswer,
  TrainingQuestion,
  TrainingResult,
} from '../types/training'

type TrainingStatus = 'loading' | 'ready' | 'empty' | 'result' | 'error'

export function useTrainingSession(
  role: RoleId,
  level: number,
  onComplete: (result: TrainingResult, questions: TrainingQuestion[]) => TrainingAward,
) {
  const [status, setStatus] = useState<TrainingStatus>('loading')
  const [questions, setQuestions] = useState<TrainingQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerConfirmed, setAnswerConfirmed] = useState(false)
  const [answers, setAnswers] = useState<TrainingAnswer[]>([])
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [award, setAward] = useState<TrainingAward | null>(null)
  const [runNumber, setRunNumber] = useState(0)
  const previousQuestionIds = useRef<string[]>([])
  const sessionLevel = useRef(level)
  const completionRecorded = useRef(false)
  const confirmationPending = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadTraining() {
      setStatus('loading')

      try {
        const nextQuestions = await createTraining({
          role,
          level: sessionLevel.current,
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
        setAward(null)
        completionRecorded.current = false
        confirmationPending.current = false
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
  }, [role, runNumber])

  const currentQuestion = questions[currentIndex] ?? null

  function selectAnswer(answerIndex: number) {
    if (!answerConfirmed && !confirmationPending.current) setSelectedAnswer(answerIndex)
  }

  function submitAnswer(answerIndex: number | null) {
    if (!currentQuestion || answerIndex === null || answerConfirmed || confirmationPending.current) return

    confirmationPending.current = true
    setSelectedAnswer(answerIndex)
    const answer = createTrainingAnswer(currentQuestion, answerIndex)
    setAnswers((current) => [...current, answer])
    setAnswerConfirmed(true)
  }

  function confirmAnswer() {
    submitAnswer(selectedAnswer)
  }

  function goNext() {
    if (!answerConfirmed) return

    if (currentIndex === questions.length - 1) {
      if (completionRecorded.current) return
      completionRecorded.current = true
      const completedResult = createTrainingResult(answers)
      setAward(onComplete(completedResult, questions))
      setResult(completedResult)
      setStatus('result')
      return
    }

    setCurrentIndex((current) => current + 1)
    setSelectedAnswer(null)
    setAnswerConfirmed(false)
    confirmationPending.current = false
  }

  function restart() {
    previousQuestionIds.current = questions.map((question) => question.id)
    sessionLevel.current = level
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
    award,
    selectAnswer,
    submitAnswer,
    confirmAnswer,
    goNext,
    restart,
  }
}
