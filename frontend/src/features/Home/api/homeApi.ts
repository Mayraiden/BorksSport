import type { ApiResponse } from '@/shared/types'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

export type HomepageSettings = {
	heroTitle: string | null
	heroImage: {
		url?: string
		alternativeText?: string | null
	} | null
	showHits: boolean
	showDiscounts: boolean
	showNew: boolean
}

const defaultSettings: HomepageSettings = {
	heroTitle: null,
	heroImage: null,
	showHits: true,
	showDiscounts: true,
	showNew: true,
}

export const homeApi = {
	async getHomepageSettings(): Promise<HomepageSettings> {
		try {
			const response = await fetch(`${API_URL}/api/homepage-settings/public`, {
				next: { revalidate: 300 },
			})

			if (!response.ok) {
				return defaultSettings
			}

			const data: ApiResponse<Partial<HomepageSettings>> = await response.json()
			if (!data.success || !data.data) {
				return defaultSettings
			}

			return {
				heroTitle: data.data.heroTitle ?? null,
				heroImage: data.data.heroImage ?? null,
				showHits: data.data.showHits ?? true,
				showDiscounts: data.data.showDiscounts ?? true,
				showNew: data.data.showNew ?? true,
			}
		} catch {
			return defaultSettings
		}
	},
}
