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
	email: string
	telegramUrl: string
	telegramLabel: string
	physicalAddress: string
	physicalAddressMapUrl: string
	workModeText: string
	copyrightText: string
}

const defaultSettings: FooterSettings = {
	companyName: 'ООО «Руспроект»',
	inn: '9715238760',
	ogrn: '1167746088586',
	legalAddress:
		'109117, г. Москв, вн.тер.г. Муниципальный округ Кузьминки, пр-кт Волгоградский, д.111, помещ.2Н',
	phone: '+7 (965) 262-14-24',
	email: 'mblmos@yandex.ru',
	telegramUrl: 'https://t.me/profisportrf',
	telegramLabel: 'Наш телеграм',
	physicalAddress: 'г. Москва, Волгоградский проспект, дом 111',
	physicalAddressMapUrl:
		'https://yandex.ru/maps/?text=%D0%B3.%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2C%20%D0%B4%D0%BE%D0%BC%20111',
	workModeText: 'Уточняйте по телефону',
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
				email: data.data.email || defaultSettings.email,
				telegramUrl: data.data.telegramUrl || defaultSettings.telegramUrl,
				telegramLabel: data.data.telegramLabel || defaultSettings.telegramLabel,
				physicalAddress: data.data.physicalAddress || defaultSettings.physicalAddress,
				physicalAddressMapUrl:
					data.data.physicalAddressMapUrl || defaultSettings.physicalAddressMapUrl,
				workModeText: data.data.workModeText || defaultSettings.workModeText,
				copyrightText: data.data.copyrightText || defaultSettings.copyrightText,
			}
		} catch {
			return defaultSettings
		}
	},
}
