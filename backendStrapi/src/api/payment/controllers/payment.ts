import { factories } from '@strapi/strapi'
import stockOpsFactory from '../../../shared/stock/stock-ops'
import {
	applyTochkaPaymentStatusUpdate,
	mapRemoteStatusToLocal,
} from '../utils/tochka-status-sync'

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

const isEmailAuthDisabled = () => {
	const raw = process.env.EMAIL_AUTH_DISABLED
	return raw === '1' || raw === 'true' || raw === 'yes'
}

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

const resolveUserId = async (strapi: any, ctx: any): Promise<number | null> => {
	let userId = ctx.state.user?.id

	if (!userId) {
		const authHeader = ctx.request.header?.authorization
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7)
			try {
				const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(
					token
				)
				userId = id
			} catch (e) {
				// ignore, we'll fallback to 401 below
			}
		}
	}

	return userId ?? null
}

const requireConfirmedUser = async (strapi: any, ctx: any, userId: number): Promise<boolean> => {
	if (isEmailAuthDisabled()) {
		return true
	}

	const user = await strapi.db.query('plugin::users-permissions.user').findOne({
		where: { id: userId },
		select: ['id', 'confirmed'],
	})

	if (!user) {
		ctx.status = 401
		ctx.body = {
			success: false,
			message: 'User not authenticated',
		}
		return false
	}

	if (!user.confirmed) {
		ctx.status = 403
		ctx.body = {
			success: false,
			code: 'EMAIL_NOT_CONFIRMED',
			message: 'Please confirm your email before payment',
		}
		return false
	}

	return true
}

export default factories.createCoreController(
	'api::payment.payment',
	({ strapi }) => ({
		/**
		 * Get payments for order
		 * GET /api/payments
		 */
		async find(ctx) {
			try {
				const { orderId } = ctx.query
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				let filters = {}
				if (orderId) {
					// Verify user owns the order
					const order = await strapi.entityService.findOne(
						'api::order.order',
						orderId as string,
						{
							populate: ['user'],
						}
					)
					if (!order || (order as any).user?.id !== userId) {
						ctx.status = 404
						ctx.body = {
							success: false,
							message: 'Order not found',
						}
						return
					}
					filters = { order: orderId }
				}

				const payments = await strapi.entityService.findMany(
					'api::payment.payment',
					{
						filters,
						sort: 'createdAt:desc',
					}
				)

				ctx.body = {
					success: true,
					data: payments,
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Create payment
		 * POST /api/payments
		 */
		async create(ctx) {
			try {
				const {
					orderId,
					paymentId,
					amount,
					paymentMethod,
					paymentData,
					provider,
					currency,
					paymentUrl,
					sessionId,
					externalId,
					expiresAt,
				} = ctx.request.body
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const canPay = await requireConfirmedUser(strapi, ctx, userId)
				if (!canPay) {
					return
				}

				if (!orderId || !paymentId || !amount || !paymentMethod) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message:
							'Required fields: orderId, paymentId, amount, paymentMethod',
					}
					return
				}

				// Verify user owns the order
				const order = await strapi.entityService.findOne(
					'api::order.order',
					orderId,
					{
						populate: ['user'],
					}
				)
				if (!order || (order as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Order not found',
					}
					return
				}

				const payment = await strapi.entityService.create(
					'api::payment.payment',
					{
						data: {
							order: orderId,
							paymentId,
							amount,
							currency: currency || 'RUB',
							status: 'pending',
							paymentMethod,
							provider: provider || 'tochka',
							paymentUrl,
							sessionId,
							externalId,
							expiresAt,
							paymentData: paymentData || {},
						},
					}
				)

				ctx.body = {
					success: true,
					data: payment,
					message: 'Payment created successfully',
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Update payment status
		 * PUT /api/payments/:id
		 */
		async update(ctx) {
			try {
				const { id } = ctx.params
				const { status, paymentData, paymentUrl, sessionId, expiresAt } =
					ctx.request.body
				const userId = await resolveUserId(strapi, ctx)

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const payment = await strapi.entityService.findOne(
					'api::payment.payment',
					id,
					{
						populate: ['order', 'order.user'],
					}
				)

				if (!payment || (payment as any).order?.user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Payment not found',
					}
					return
				}

				const updateData: any = {
					status: status || payment.status,
					paymentData: paymentData || payment.paymentData,
				}
				if (paymentUrl) updateData.paymentUrl = paymentUrl
				if (sessionId) updateData.sessionId = sessionId
				if (expiresAt) updateData.expiresAt = expiresAt

				const updatedPayment = await strapi.entityService.update(
					'api::payment.payment',
					id,
					{
						data: updateData,
					}
				)

				// Update order status if payment is successful
				if (status === 'paid') {
					await strapi.entityService.update(
						'api::order.order',
						(payment as any).order.id,
						{
							data: { status: 'paid' },
						}
					)
				}

				ctx.body = {
					success: true,
					data: updatedPayment,
					message: 'Payment updated successfully',
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		async createTochkaSession(ctx) {
			try {
				const userId = await resolveUserId(strapi, ctx)
				const { orderId } = ctx.request.body

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const canPay = await requireConfirmedUser(strapi, ctx, userId)
				if (!canPay) {
					return
				}

				if (!orderId) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'orderId is required',
					}
					return
				}

				const order = await strapi.entityService.findOne('api::order.order', orderId, {
					populate: ['user'],
				})

				if (!order || (order as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Order not found',
					}
					return
				}

				if ((order as any).status === 'cancelled') {
					ctx.status = 400
					ctx.body = {
						success: false,
						code: 'ORDER_CANCELLED',
						message: 'Order is cancelled. Payment is not available.',
					}
					return
				}

				if (order.paymentMethod !== 'online') {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Order does not require online payment',
					}
					return
				}

				const tochkaPayService = strapi.service('api::payment.tochka-pay')
				const tochkaConfig = tochkaPayService?.config

				if (
					!tochkaConfig ||
					!tochkaConfig.authToken ||
					!tochkaConfig.clientId ||
					!tochkaConfig.customerCode
				) {
					ctx.status = 500
					ctx.body = {
						success: false,
						error: 'Tochka Pay is not configured',
					}
					return
				}

				const amount = Number(order.totalAmount || 0)
				if (!amount || Number.isNaN(amount)) {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Order amount is not defined',
					}
					return
				}

				const customerData = (order as any).customerData as
					| {
						name?: string
						email?: string
						phone?: string
					}
					| undefined

				const rawAppUrl =
					process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
				const appUrl = rawAppUrl.startsWith('http://')
					? rawAppUrl.replace(/^http:\/\//, 'https://')
					: rawAppUrl.startsWith('https://')
					? rawAppUrl
					: `https://${rawAppUrl}`
				const successRedirectUrl = `${appUrl}/orders/${order.id}?payment=success`
				const failRedirectUrl = `${appUrl}/orders/${order.id}?payment=failed`
				const paymentModes = (() => {
					switch ((order as any).paymentProvider) {
						case 'sbp':
							return ['sbp']
						case 'card':
						case 'tochka':
						default:
							return ['card']
					}
				})()

				const orderItems = Array.isArray((order as any).items)
					? ((order as any).items as Array<{
						name?: string
						price?: number
						quantity?: number
					}>).map((item, index) => ({
						name: item.name || `Товар ${index + 1}`,
						price: Number(item.price || 0),
						quantity: Number(item.quantity || 1),
					}))
					: []

				// Создаем уникальный paymentLinkId для Точки банка
				// Используем orderNumber + ID заказа для гарантии уникальности
				// Это нужно, чтобы избежать конфликтов, если заказ был удален из нашей БД,
				// но Точка банк его еще помнит
				const uniquePaymentLinkId = `${order.orderNumber}-${order.id}`
				
				// Точка банк проверяет уникальность по orderNumber, поэтому добавляем ID заказа
				// чтобы гарантировать уникальность даже если заказ был удален и создан заново
				const uniqueOrderNumber = `${order.orderNumber}-${order.id}`

				const session = await tochkaPayService.createPaymentSession({
					orderNumber: uniqueOrderNumber, // Уникальный номер для Точки банка (с ID заказа)
					amount,
					description: `Оплата заказа ${order.orderNumber}`, // Оригинальный номер для пользователя
					currency: 'RUB',
					customer: {
						name: customerData?.name || (order as any).user?.username,
						email: customerData?.email || (order as any).user?.email,
						phone: customerData?.phone,
					},
					metadata: {
						orderId,
						userId,
						paymentModes,
						paymentLinkId: uniquePaymentLinkId,
						redirectUrl: successRedirectUrl,
						failRedirectUrl,
						ttl: Number(process.env.TOCHKA_PAY_TTL || 10080),
						items: orderItems,
						consumerId: String(userId),
					},
				})

				const existingPayments = await strapi.entityService.findMany(
					'api::payment.payment',
					{
						filters: {
							order: orderId,
						},
						sort: 'createdAt:desc',
					}
				)

				let paymentRecord = existingPayments[0] as
					| (typeof existingPayments)[number]
					| undefined

				const previousPaymentData = (
					paymentRecord?.paymentData ?? {}
				) as JsonObject

				const paymentData: JsonObject = {
					...previousPaymentData,
					lastSession: session.raw as JsonValue,
				}

				const paymentStatus: PaymentStatus =
					session.status === 'paid' ? 'paid' : 'pending'

				const paymentPayload = {
					paymentId: session.externalId,
					amount,
					currency: 'RUB',
					status: paymentStatus,
					paymentMethod: 'online',
					provider: 'tochka' as const,
					paymentUrl: session.paymentUrl ?? undefined,
					sessionId: session.sessionId ?? undefined,
					externalId: session.externalId ?? undefined,
					expiresAt: session.expiresAt ?? undefined,
					paymentData,
				}

				if (paymentRecord) {
					paymentRecord = await strapi.entityService.update(
						'api::payment.payment',
						paymentRecord.id,
						{
							data: paymentPayload,
						}
					)
				} else {
					paymentRecord = await strapi.entityService.create(
						'api::payment.payment',
						{
							data: {
								order: orderId,
								...paymentPayload,
							},
						}
					)
				}

				if (order.status !== 'awaiting_payment') {
					await strapi.entityService.update('api::order.order', orderId, {
						data: { status: 'awaiting_payment' },
					})
				}

				ctx.body = {
					success: true,
					data: {
						paymentId: paymentRecord.id,
						orderId,
						externalId: session.externalId,
						sessionId: session.sessionId,
						status: session.status,
						paymentUrl: session.paymentUrl,
						expiresAt: session.expiresAt,
					},
				}
			} catch (error: any) {
				strapi.log.error('Tochka Pay session error', error)
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		async tochkaWebhook(ctx) {
			try {
				const signatureHeader =
					(ctx.request.headers['x-request-signature'] as string | undefined) ||
					(ctx.request.headers['x-signature'] as string | undefined)
				const body = ctx.request.body as Record<string, unknown>

				const tochkaPayService = strapi.service('api::payment.tochka-pay')

				const signatureValid = tochkaPayService.verifyWebhookSignature(
					body,
					signatureHeader
				)

				if (!signatureValid) {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Invalid Tochka Pay signature',
					}
					return
				}

				const event = tochkaPayService.mapWebhookEvent(body)
				const payload = event.payload || {}
				
				// Логируем весь webhook для отладки
				if (process.env.TOCHKA_PAY_DEBUG === 'true') {
					strapi.log.info('Tochka Pay webhook received', {
						eventType: event.eventType,
						payload,
						headers: {
							'x-request-signature': ctx.request.headers['x-request-signature'],
							'x-signature': ctx.request.headers['x-signature'],
						},
					})
				}

				// Пытаемся найти идентификатор платежа из разных полей
				const invoiceId = (payload.invoice_id as string) ||
					(payload.invoiceId as string) ||
					(payload.operationId as string) ||
					(payload.operation_id as string) ||
					(payload.sessionId as string) ||
					(payload.session_id as string) ||
					(payload.id as string) ||
					(payload.order_number as string) ||
					(payload.paymentLinkId as string) ||
					(payload.payment_link_id as string)

				if (!invoiceId) {
					strapi.log.warn('Tochka Pay webhook received without invoice id', {
						payload,
						eventType: event.eventType,
					})
					ctx.body = { success: true }
					return
				}

				// Ищем платеж по разным идентификаторам
				// Сначала по paymentId (externalId)
				let payments = await strapi.entityService.findMany(
					'api::payment.payment',
					{
						filters: { paymentId: invoiceId },
						populate: ['order'],
					}
				)

				// Если не нашли, ищем по sessionId
				if (!payments.length) {
					payments = await strapi.entityService.findMany(
						'api::payment.payment',
						{
							filters: { sessionId: invoiceId },
							populate: ['order'],
						}
					)
				}

				// Если не нашли, ищем по externalId
				if (!payments.length) {
					payments = await strapi.entityService.findMany(
						'api::payment.payment',
						{
							filters: { externalId: invoiceId },
							populate: ['order'],
						}
					)
				}

				// Если не нашли, пытаемся найти по orderNumber из payload
				if (!payments.length && payload.order_number) {
					const orderNumber = payload.order_number as string
					// Убираем ID заказа из конца, если есть (формат: YYYYMMDD-XXXX-ID)
					const baseOrderNumber = orderNumber.split('-').slice(0, -1).join('-')
					
					const orders = await strapi.entityService.findMany('api::order.order', {
						filters: {
							$or: [
								{ orderNumber: orderNumber },
								{ orderNumber: { $startsWith: baseOrderNumber } },
							],
						},
					})

					if (orders.length > 0) {
						const order = orders[0]
						// Ищем платежи по orderId
						const orderPayments = await strapi.entityService.findMany(
							'api::payment.payment',
							{
								filters: { order: { id: { $eq: order.id } } } as any,
								populate: ['order'],
								sort: 'createdAt:desc',
								limit: 1,
							}
						)
						
						if (orderPayments.length > 0) {
							payments = orderPayments
						}
					}
				}

				if (!payments.length) {
					strapi.log.warn('Tochka Pay webhook for unknown payment', {
						invoiceId,
						payload,
						searchedFields: ['paymentId', 'sessionId', 'externalId', 'orderNumber'],
					})
					ctx.body = { success: true }
					return
				}

				const payment = payments[0]
				const eventType = String(event.eventType || '')
				const remoteStatus = String(
					payload.status || payload.payment_status || payload.Status || 'pending'
				)

				const isRefundEvent =
					/refund/i.test(eventType) ||
					typeof (payload as any).refund_id === 'string' ||
					typeof (payload as any).refundId === 'string' ||
					typeof (payload as any).request_id === 'string' ||
					typeof (payload as any).requestId === 'string'

				const baseMapping = mapRemoteStatusToLocal(remoteStatus)
				let paymentStatus = baseMapping.paymentStatus
				let orderStatus = baseMapping.orderStatus

				let refundIdFromPayload: string | undefined
				let refundRemoteStatus: string | undefined
				let refundStatus: 'none' | 'pending' | 'succeeded' | 'failed' | undefined
				let refundedAt: string | undefined

				if (isRefundEvent) {
					refundIdFromPayload = String(
						(payload as any).refund_id ||
							(payload as any).refundId ||
							(payload as any).request_id ||
							(payload as any).requestId ||
							''
					).trim() || undefined

					refundRemoteStatus = String(
						(payload as any).refund_status ||
							(payload as any).refundStatus ||
							(payload as any).status ||
							(payload as any).payment_status ||
							''
					)

					const n = refundRemoteStatus.toLowerCase()
					if (
						n.includes('refunded') ||
						n.includes('refund') && (n.includes('success') || n.includes('succeed')) ||
						n.includes('completed') ||
						n.includes('approved') ||
						n.includes('success') ||
						n.includes('succeeded')
					) {
						refundStatus = 'succeeded'
						refundedAt = new Date().toISOString()
						paymentStatus = 'refunded'
						orderStatus = 'cancelled'
					} else if (
						n.includes('failed') ||
						n.includes('declined') ||
						n.includes('rejected') ||
						n.includes('error')
					) {
						refundStatus = 'failed'
						// keep paymentStatus/orderStatus as-is
					} else {
						refundStatus = 'pending'
					}
				}

				// Логируем обновление статуса
				strapi.log.info('Tochka Pay webhook: updating payment status', {
					paymentId: payment.id,
					oldStatus: payment.status,
					newStatus: paymentStatus,
					remoteStatus,
					eventType,
					isRefundEvent,
					refundIdFromPayload,
					refundStatus,
					orderId: (payment as any).order?.id,
					orderStatus,
				})

				const paymentOrder = (payment as any)?.order

				await applyTochkaPaymentStatusUpdate(strapi, {
					paymentId: payment.id,
					paymentStatus,
					orderStatus,
					paymentData: {
						lastWebhookEvent: payload as JsonValue,
					},
					paymentPatch: {
						paymentUrl:
							(payload.payment_url as string) || payment.paymentUrl,
						sessionId:
							(payload.session_id as string) || payment.sessionId,
						externalId:
							(payload.invoice_id as string) || payment.externalId,
						expiresAt:
							(payload.expires_at as string) || payment.expiresAt,
					},
					refundFields: isRefundEvent
						? {
								refundId: refundIdFromPayload || (payment as any).refundId,
								refundStatus: refundStatus || (payment as any).refundStatus,
								refundedAt: refundedAt || (payment as any).refundedAt,
								refundData: payload as JsonValue,
							}
						: undefined,
					order: paymentOrder,
					source: 'webhook',
					isRefundEvent,
				})

				if (
					orderStatus === 'cancelled' &&
					isRefundEvent &&
					refundStatus === 'succeeded' &&
					paymentOrder
				) {
					const cdekUuid = String((paymentOrder as any).cdekOrderUuid || '').trim()
					if (cdekUuid) {
						try {
							const cdekService = strapi.service('api::cdek-sync.cdek-sync')
							const result = await cdekService.cancelOrder(cdekUuid)
							await strapi.entityService.update('api::order.order', paymentOrder.id, {
								data: {
									cdekStatus: result.ok ? 'CANCELLED' : 'CANCEL_CANCELLED_FAILED',
								},
							})
						} catch (cdekError: any) {
							strapi.log.warn('CDEK cancel after refund failed', {
								orderId: paymentOrder.id,
								cdekOrderUuid: (paymentOrder as any).cdekOrderUuid,
								error: cdekError?.message,
							})
						}
					}
				}

				ctx.body = { success: true }
			} catch (error: any) {
				strapi.log.error('Tochka Pay webhook error', error)
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		async getTochkaStatus(ctx) {
			try {
				const userId = await resolveUserId(strapi, ctx)
				const { id } = ctx.params

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const payment = await strapi.entityService.findOne(
					'api::payment.payment',
					id,
					{
						populate: ['order', 'order.user'],
					}
				)

				if (!payment || (payment as any).order?.user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Payment not found',
					}
					return
				}

				if ((payment as any).order?.status === 'cancelled') {
					ctx.status = 400
					ctx.body = {
						success: false,
						code: 'ORDER_CANCELLED',
						message: 'Order is cancelled. Payment status is not available.',
					}
					return
				}

				// Для получения статуса используем sessionId (operationId), если нет - используем paymentId (externalId)
				const statusIdentifier = payment.sessionId || payment.paymentId
				
				if (!statusIdentifier) {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Payment identifier is missing',
					}
					return
				}

				const tochkaPayService = strapi.service('api::payment.tochka-pay')
				
				// Логируем для отладки
				strapi.log.info('Tochka Pay: getting payment status', {
					paymentId: payment.id,
					statusIdentifier,
					sessionId: payment.sessionId,
					externalId: payment.externalId,
					paymentIdField: payment.paymentId,
				})
				
				const statusResponse = await tochkaPayService.getPaymentStatus(
					statusIdentifier
				)
				const paymentStatusResponse = String(
					statusResponse.status ?? 'pending'
				)
				const { paymentStatus, orderStatus } = mapRemoteStatusToLocal(
					paymentStatusResponse
				)

				await applyTochkaPaymentStatusUpdate(strapi, {
					paymentId: id,
					paymentStatus,
					orderStatus,
					paymentData: {
						lastPolledStatus: statusResponse.raw as JsonValue,
						lastStatusSyncAt: new Date().toISOString(),
					},
					source: 'poll',
				})

				ctx.body = {
					success: true,
					data: {
						status: paymentStatus,
						rawStatus: statusResponse.raw,
					},
				}
			} catch (error: any) {
				strapi.log.error('Tochka Pay status error', error)
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},
	})
)
