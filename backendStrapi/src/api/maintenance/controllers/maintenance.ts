import type { Core } from '@strapi/strapi'

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	async clearByUid(ctx) {
		try {
			const rawUid = ctx.params.uid
			const uid = decodeURIComponent(rawUid)

			if (!uid || typeof uid !== 'string') {
				ctx.status = 400
				ctx.body = { success: false, message: 'Invalid uid' }
				return
			}

			if (!strapi.contentTypes[uid]) {
				ctx.status = 404
				ctx.body = { success: false, message: `Content type not found: ${uid}` }
				return
			}

			const before = await strapi.entityService.count(uid as any)
			const res = await strapi.db.query(uid as any).deleteMany({ where: {} })
			const deleted = typeof res === 'number' ? res : (res?.count ?? 0)
			const after = await strapi.entityService.count(uid as any)

			ctx.body = { success: true, data: { uid, before, deleted, after } }
		} catch (error) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},
})
