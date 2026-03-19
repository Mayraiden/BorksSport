import type { ApiResponse } from '@/shared/types'

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

export type MainCategory = {
	id: number
	name: string
	slug: string
	level: number
	sbisId: number
	children?: MainCategory[]
}

/**
 * API для работы с категориями
 */
export const categoryApi = {
	/**
	 * Получить главные категории (level = 0) - Виды спорта
	 * Запрашивает с populate children для получения подкатегорий (включая вложенные)
	 */
	async getMainCategories(): Promise<MainCategory[]> {
		try {
			const response = await fetch(
				`${API_URL}/api/categories/main?populate[children][populate]=children`
			)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<MainCategory[]> = await response.json()

			if (!data.success) {
				throw new Error('Failed to fetch main categories')
			}

			return data.data
		} catch (error) {
			console.error('Error fetching main categories:', error)
			throw error
		}
	},

	/**
	 * Получить категории по уровню вложенности
	 * @param level - Уровень вложенности (0 - виды спорта, 1 - категории товаров, 2+ - нижние уровни)
	 * @param type - Тип категории (sport, productType, subcategory, brand)
	 * @param sports - опционально: список названий sport'ов для scoping категории (parent.name IN ...)
	 */
	async getCategoriesByLevel(level: number, type?: string, sports?: string[]): Promise<MainCategory[]> {
		try {
			const params = new URLSearchParams()
			if (type) params.set('type', type)
			if (sports && sports.length > 0) params.set('sports', sports.join(','))

			const query = params.toString() ? `?${params.toString()}` : ''
			const response = await fetch(`${API_URL}/api/categories/by-level/${level}${query}`)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<MainCategory[]> = await response.json()

			if (!data.success) {
				throw new Error(`Failed to fetch categories for level ${level}`)
			}

			return data.data
		} catch (error) {
			console.error(`Error fetching categories for level ${level}${type ? ` (${type})` : ''}:`, error)
			throw error
		}
	},
}
