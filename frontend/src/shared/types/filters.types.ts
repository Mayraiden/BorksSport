export type FilterType = 'range' | 'checkbox' | 'radio' | 'select'

export interface FilterOption {
	value: string
	label: string
	count?: number
	id?: number | string // Для уникальности ключей в React (используется для категорий)
}

export type FilterValue = string[] | { min: number; max: number }

export interface FilterConfig {
	id: string
	label: string
	type: FilterType
	options?: FilterOption[]
	default?: FilterValue
	min?: number
	max?: number
	step?: number
}

export interface FilterValues {
	[key: string]: FilterValue
}

export interface FilterSection {
	id: string
	label: string
	filters: FilterConfig[]
	expanded?: boolean
}
