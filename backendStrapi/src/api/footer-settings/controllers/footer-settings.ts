import { factories } from '@strapi/strapi'

const FOOTER_SETTINGS_UID = 'api::footer-settings.footer-settings'

export default factories.createCoreController(FOOTER_SETTINGS_UID as any, ({ strapi }) => ({
	async findPublic(ctx: any) {
		try {
			const settings = await strapi.db.query(FOOTER_SETTINGS_UID).findOne({})

			ctx.body = {
				success: true,
				data: {
					companyName: settings?.companyName || 'ООО «Руспроект»',
					inn: settings?.inn || '9715238760',
					ogrn: settings?.ogrn || '1167746088586',
					legalAddress:
						settings?.legalAddress ||
						'109117, г. Москв, вн.тер.г. Муниципальный округ Кузьминки, пр-кт Волгоградский, д.111, помещ.2Н',
					phone: settings?.phone || '+7 (965) 262-14-24',
					email: settings?.email || 'mblmos@yandex.ru',
					telegramUrl: settings?.telegramUrl || 'https://t.me/profisportrf',
					telegramLabel: settings?.telegramLabel || 'Наш телеграм',
					physicalAddress:
						settings?.physicalAddress ||
						'г. Москва, Волгоградский проспект, дом 111',
					physicalAddressMapUrl:
						settings?.physicalAddressMapUrl ||
						'https://yandex.ru/maps/?text=%D0%B3.%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2C%20%D0%B4%D0%BE%D0%BC%20111',
					workModeText: settings?.workModeText || 'Уточняйте по телефону',
					copyrightText:
						settings?.copyrightText ||
						'© 2025 ПРОФСПОРТ. Все права защищены.',
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				error: error.message,
			}
		}
	},
}))
