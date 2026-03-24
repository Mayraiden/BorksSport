import { factories } from '@strapi/strapi'

const HOMEPAGE_SETTINGS_UID = 'api::homepage-settings.homepage-settings'

export default factories.createCoreController(HOMEPAGE_SETTINGS_UID as any, ({ strapi }) => ({
	async findPublic(ctx: any) {
		try {
			const settings = await strapi.db.query(HOMEPAGE_SETTINGS_UID).findOne({
				populate: {
					heroImage: true,
				},
			})

			const heroImage = settings?.heroImage
				? {
						url: settings.heroImage.url,
						alternativeText: settings.heroImage.alternativeText || null,
					}
				: null

			ctx.body = {
				success: true,
				data: {
					heroTitle: settings?.heroTitle || null,
					heroImage,
					showHits: settings?.showHits ?? true,
					showDiscounts: settings?.showDiscounts ?? true,
					showNew: settings?.showNew ?? true,
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
