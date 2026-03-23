import type { ApiResponse } from '@/shared/types'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

export type HomeBrand = {
	id: number
	name: string
	slug?: string
	showOnHome?: boolean
	homeSort?: number
	logo?: {
		url?: string
		alternativeText?: string | null
	} | null
}

export const brandApi = {
	async getHomeBrands(limit = 15): Promise<HomeBrand[]> {
		const params = new URLSearchParams()
		params.set('limit', String(limit))

		const response = await fetch(`${API_URL}/api/brands/home?${params.toString()}`)
		if (!response.ok) {
			throw new Error(`API error: ${response.status}`)
		}

		const data: ApiResponse<HomeBrand[]> = await response.json()
		if (!data.success) {
			throw new Error('Failed to fetch home brands')
		}

		return data.data
	},
}
