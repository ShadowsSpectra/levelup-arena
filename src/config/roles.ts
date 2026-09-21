export type RoleId = 'product_manager' | 'project_manager' | 'sales_manager'

export type Role = {
  id: RoleId
  name: string
  shortName: string
  description: string
  focus: string
}

export const roles: Role[] = [
  {
    id: 'product_manager',
    name: 'Product Manager',
    shortName: 'Product',
    description: 'Приоритизация, работа с ожиданиями и поиск ценности.',
    focus: 'Продуктовые переговоры',
  },
  {
    id: 'project_manager',
    name: 'Project Manager',
    shortName: 'Project',
    description: 'Сроки, ресурсы и согласование интересов участников.',
    focus: 'Проектные переговоры',
  },
  {
    id: 'sales_manager',
    name: 'Sales Manager',
    shortName: 'Sales',
    description: 'Потребности клиента, возражения и взаимовыгодные условия.',
    focus: 'Коммерческие переговоры',
  },
]

export function getRoleById(roleId: RoleId | null) {
  return roles.find((role) => role.id === roleId) ?? null
}

export function isRoleId(value: string | null): value is RoleId {
  return roles.some((role) => role.id === value)
}
