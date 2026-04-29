import type { Core } from '@strapi/strapi'
import { acquireSyncLock, getActiveSyncRun, releaseSyncLock } from '../../../utils/sync-lock'

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	async runSbisSync(ctx: any) {
		const lock = acquireSyncLock('sbis-api')
		if (lock.ok === false) {
			ctx.status = 409
			ctx.body = {
				success: false,
				message: `Sync is already running (${lock.active.source})`,
				active: lock.active,
			}
			return
		}

		try {
			const summary = await strapi.service('api::sync-control.sync-control').runSbisCatalogSync()
			ctx.status = 200
			ctx.body = {
				success: true,
				source: 'sbis-api',
				summary,
			}
		} catch (error: any) {
			strapi.log.error(`[SBIS Sync] Run failed: ${error?.message || error}`)
			ctx.status = 500
			ctx.body = {
				success: false,
				source: 'sbis-api',
				message: error?.message || 'SBIS sync failed',
				active: getActiveSyncRun(),
			}
		} finally {
			releaseSyncLock(lock.run.token)
		}
	},
})
