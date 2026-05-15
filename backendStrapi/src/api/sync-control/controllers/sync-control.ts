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

	async retrySbisOrderSync(ctx: any) {
		try {
			const orderId = Number(ctx.params.id)
			if (!Number.isInteger(orderId) || orderId <= 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid order id',
				}
				return
			}

			const result = await strapi
				.service('api::sync-control.sbis-order-sync')
				.syncPaidOrder(orderId, { force: true })

			ctx.status = 200
			ctx.body = {
				success: true,
				source: 'sbis-order-sync',
				result,
			}
		} catch (error: any) {
			strapi.log.error(`[SBIS Order Sync] Retry failed: ${error?.message || error}`)
			ctx.status = 500
			ctx.body = {
				success: false,
				source: 'sbis-order-sync',
				message: error?.message || 'SBIS order sync retry failed',
				response: error?.response?.data,
			}
		}
	},

	async getSbisOrderState(ctx: any) {
		try {
			const orderId = Number(ctx.params.id)
			if (!Number.isInteger(orderId) || orderId <= 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid order id',
				}
				return
			}

			const result = await strapi
				.service('api::sync-control.sbis-order-sync')
				.getOrderState(orderId)

			ctx.status = 200
			ctx.body = {
				success: true,
				source: 'sbis-order-state',
				result,
			}
		} catch (error: any) {
			strapi.log.error(`[SBIS Order Sync] State failed: ${error?.message || error}`)
			ctx.status = error?.response?.status || 500
			ctx.body = {
				success: false,
				source: 'sbis-order-state',
				message: error?.message || 'SBIS order state failed',
				response: error?.response?.data,
			}
		}
	},

	async registerSbisOrderPayment(ctx: any) {
		try {
			const orderId = Number(ctx.params.id)
			if (!Number.isInteger(orderId) || orderId <= 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid order id',
				}
				return
			}

			const result = await strapi
				.service('api::sync-control.sbis-order-sync')
				.registerSbisPayment(orderId)

			ctx.status = 200
			ctx.body = {
				success: true,
				source: 'sbis-order-register-payment',
				result,
			}
		} catch (error: any) {
			strapi.log.error(
				`[SBIS Order Sync] Register payment failed: ${error?.message || error}`
			)
			ctx.status = 500
			ctx.body = {
				success: false,
				source: 'sbis-order-register-payment',
				message: error?.message || 'SBIS register-payment failed',
				response: error?.response?.data,
			}
		}
	},
})
