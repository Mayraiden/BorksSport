import type { ApiResponse } from '@/shared/types'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

export type FooterSettings = {
	companyName: string
	inn: string
	ogrn: string
	legalAddress: string
	phone: string
	telegramUrl: string
	telegramLabel: string
	physicalAddress: string
	copyrightText: string
}

const defaultSettings: FooterSettings = {
	companyName: 'ООО «Руспроект»',
	inn: '9715238760',
	ogrn: '1167746088586',
	legalAddress:
		'123007, г. Москва, вн.тер.г. муниципальный округ Хорошевский, проезд 2-й Хорошёвский, д. 7, стр. 16, ком 2',
	phone: '+7 (977) 697-21-77',
	telegramUrl: 'https://t.me/profisportrf',
	telegramLabel: 'Телеграмм канал',
	physicalAddress: 'г. Москва, Волгоградский проспект, дом 111',
	copyrightText: '© 2025 ПРОФСПОРТ. Все права защищены.',
}

export const footerApi = {
	async getFooterSettings(): Promise<FooterSettings> {
		try {
			const response = await fetch(`${API_URL}/api/footer-settings/public`, {
				next: { revalidate: 300 },
			})

			if (!response.ok) {
				return defaultSettings
			}

			const data: ApiResponse<Partial<FooterSettings>> = await response.json()
			if (!data.success || !data.data) {
				return defaultSettings
			}

			return {
				companyName: data.data.companyName || defaultSettings.companyName,
				inn: data.data.inn || defaultSettings.inn,
				ogrn: data.data.ogrn || defaultSettings.ogrn,
				legalAddress: data.data.legalAddress || defaultSettings.legalAddress,
				phone: data.data.phone || defaultSettings.phone,
				telegramUrl: data.data.telegramUrl || defaultSettings.telegramUrl,
				telegramLabel: data.data.telegramLabel || defaultSettings.telegramLabel,
				physicalAddress: data.data.physicalAddress || defaultSettings.physicalAddress,
				copyrightText: data.data.copyrightText || defaultSettings.copyrightText,
			}
		} catch (error) {
			console.error('Error fetching footer settings:', error)
			return defaultSettings
		}
	},
}
