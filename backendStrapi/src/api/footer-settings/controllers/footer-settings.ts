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
						'123007, г. Москва, вн.тер.г. муниципальный округ Хорошевский, проезд 2-й Хорошёвский, д. 7, стр. 16, ком 2',
					phone: settings?.phone || '+7 (977) 697-21-77',
					telegramUrl: settings?.telegramUrl || 'https://t.me/profisportrf',
					telegramLabel: settings?.telegramLabel || 'Телеграмм канал',
					physicalAddress:
						settings?.physicalAddress ||
						'г. Москва, Волгоградский проспект, дом 111',
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
