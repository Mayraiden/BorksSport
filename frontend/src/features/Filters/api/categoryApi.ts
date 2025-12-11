import type { ApiResponse } from '@/shared/types'

const API_URL = 'http://localhost:1337'

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
	 */
	async getMainCategories(): Promise<MainCategory[]> {
		try {
			const response = await fetch(`${API_URL}/api/categories/main`)

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
	 * @param level - Уровень вложенности (0 - виды спорта, 1 - категории товаров, 2 - бренды)
	 */
	async getCategoriesByLevel(level: number): Promise<MainCategory[]> {
		try {
			const response = await fetch(`${API_URL}/api/categories/by-level/${level}`)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<MainCategory[]> = await response.json()

			if (!data.success) {
				throw new Error(`Failed to fetch categories for level ${level}`)
			}

			return data.data
		} catch (error) {
			console.error(`Error fetching categories for level ${level}:`, error)
			throw error
		}
	},
}
