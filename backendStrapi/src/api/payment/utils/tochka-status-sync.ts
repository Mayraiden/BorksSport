import type { Core } from '@strapi/strapi'
import stockOpsFactory from '../../../shared/stock/stock-ops'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type OrderPaymentStatus =
	| 'awaiting_payment'
	| 'paid'
	| 'payment_failed'
	| 'cancelled'

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

export const mapRemoteStatusToLocal = (
	remoteStatus: string
): {
	paymentStatus: PaymentStatus
	orderStatus?: OrderPaymentStatus
} => {
	const normalizedStatus = remoteStatus.toLowerCase()
	switch (normalizedStatus) {
		case 'paid':
		case 'succeeded':
		case 'success':
		case 'completed':
		case 'approved':
		case 'authorized':
		case 'captured':
		case 'settled':
			return { paymentStatus: 'paid', orderStatus: 'paid' }
		case 'cancelled':
		case 'canceled':
		case 'failed':
		case 'declined':
		case 'rejected':
			return {
				paymentStatus: 'failed',
				orderStatus: 'payment_failed',
			}
		case 'refunded':
		case 'refund':
		case 'refund_succeeded':
		case 'refund_success':
		case 'reversed':
			return {
				paymentStatus: 'refunded',
				orderStatus: 'cancelled',
			}
		default:
			return { paymentStatus: 'pending', orderStatus: 'awaiting_payment' }
	}
}

const normalizeStoredStatus = (value: unknown): string =>
	String(value ?? '').trim()

const shouldUpdateOrderStatus = (
	currentStatus: unknown,
	nextStatus: OrderPaymentStatus
): boolean => {
	const current = normalizeStoredStatus(currentStatus)
	if (!current) return true
	return current !== nextStatus
}

export const syncPaidOrderToSbis = async (strapi: Core.Strapi, orderId: number) => {
	try {
		const result = await strapi
			.service('api::sync-control.sbis-order-sync')
			.syncPaidOrder(orderId)
		if (!result?.skipped) {
			strapi.log.info('[SBIS Order Sync] Paid order synced', {
				orderId,
				sbisExternalId: result?.sbisExternalId,
			})
		}
	} catch (error: any) {
		strapi.log.error('[SBIS Order Sync] Paid order sync failed', {
			orderId,
			error: error?.message || String(error),
			response: error?.response?.data,
		})
	}
}

export async function applyTochkaPaymentStatusUpdate(
	strapi: Core.Strapi,
	input: {
		paymentId: number
		paymentStatus: PaymentStatus
		orderStatus?: OrderPaymentStatus
		paymentData?: JsonObject
		paymentPatch?: Record<string, unknown>
		order?: { id: number; status?: unknown } | null
		source: 'webhook' | 'poll' | 'management'
		isRefundEvent?: boolean
		refundFields?: Record<string, unknown>
	}
): Promise<{ orderUpdated: boolean; paymentUpdated: boolean }> {
	const payment = await strapi.entityService.findOne(
		'api::payment.payment',
		input.paymentId,
		{
			populate: ['order'],
		}
	)

	if (!payment) {
		throw new Error(`Payment ${input.paymentId} not found`)
	}

	const paymentOrder = input.order ?? (payment as any)?.order
	const previousPaymentData = (payment.paymentData ?? {}) as JsonObject
	const nextPaymentData: JsonObject = {
		...previousPaymentData,
		...(input.paymentData || {}),
	}

	const paymentUpdate: Record<string, unknown> = {
		status: input.paymentStatus,
		paymentData: nextPaymentData,
		...(input.paymentPatch || {}),
		...(input.refundFields || {}),
	}

	await strapi.entityService.update('api::payment.payment', input.paymentId, {
		data: paymentUpdate,
	})

	let orderUpdated = false

	if (input.orderStatus && paymentOrder?.id) {
		const currentOrderStatus = (paymentOrder as any).status
		if (shouldUpdateOrderStatus(currentOrderStatus, input.orderStatus)) {
			const stockOps = stockOpsFactory({ strapi })
			const orderUpdate: Record<string, unknown> = { status: input.orderStatus }

			if (input.orderStatus === 'cancelled' && input.isRefundEvent) {
				orderUpdate.cancelledAt = new Date().toISOString()
				orderUpdate.cancelReason =
					(paymentOrder as any).cancelReason ||
					'Отменено: возврат средств подтверждён'
			}

			await strapi.db.transaction(async ({ trx }) => {
				if (input.orderStatus === 'paid') {
					await stockOps.applyOrderStockOp({
						trx,
						orderId: paymentOrder.id,
						kind: 'commit',
					})
				}
				if (
					input.orderStatus === 'cancelled' &&
					input.isRefundEvent &&
					input.paymentStatus === 'refunded'
				) {
					await stockOps.applyOrderStockOp({
						trx,
						orderId: paymentOrder.id,
						kind: 'return',
					})
				}

				await strapi.entityService.update('api::order.order', paymentOrder.id, {
					data: orderUpdate,
				})
			})

			orderUpdated = true

			if (input.orderStatus === 'paid') {
				await syncPaidOrderToSbis(strapi, Number(paymentOrder.id))
			}

			strapi.log.info('Tochka payment status applied to order', {
				source: input.source,
				orderId: paymentOrder.id,
				previousStatus: currentOrderStatus ?? null,
				newStatus: input.orderStatus,
				paymentId: input.paymentId,
				paymentStatus: input.paymentStatus,
			})
		}
	}

	return { orderUpdated, paymentUpdated: true }
}
