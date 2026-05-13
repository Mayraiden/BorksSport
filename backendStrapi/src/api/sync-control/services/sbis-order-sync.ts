import { randomUUID } from 'crypto'
import type { Core } from '@strapi/strapi'
import axios from 'axios'

type JsonRecord = Record<string, any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default ({ strapi }: { strapi: Core.Strapi }) => {
	function requiredEnv(name: string): string {
		const value = process.env[name]
		if (!value) {
			throw new Error(`Missing required env ${name}`)
		}
		return value
	}

	function optionalEnv(name: string): string | undefined {
		const value = process.env[name]
		return value && value.trim() ? value.trim() : undefined
	}

	function orderPointId(): number {
		const value = optionalEnv('SBIS_ORDER_POINT_ID') || optionalEnv('SBIS_POINT_ID')
		const parsed = Number(value)
		if (!Number.isInteger(parsed) || parsed <= 0) {
			throw new Error('Missing valid SBIS_ORDER_POINT_ID or SBIS_POINT_ID')
		}
		return parsed
	}

	function orderPriceListId(): number {
		const value = optionalEnv('SBIS_ORDER_PRICE_LIST_ID') || optionalEnv('SBIS_PRICE_LIST_ID')
		const parsed = Number(value)
		if (!Number.isInteger(parsed) || parsed <= 0) {
			throw new Error('Missing valid SBIS_ORDER_PRICE_LIST_ID or SBIS_PRICE_LIST_ID')
		}
		return parsed
	}

	function normalizeApiBaseUrl(): string {
		const baseUrl = process.env.SBIS_API_URL || 'https://api.sbis.ru/retail/v2'
		return baseUrl.replace(/\/v2\/?$/, '').replace(/\/$/, '')
	}

	function boolEnv(name: string, fallback: boolean): boolean {
		const raw = optionalEnv(name)
		if (!raw) return fallback
		return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
	}

	function toMoney(value: unknown): number {
		const n = Number(value)
		if (!Number.isFinite(n)) return 0
		return Math.round(n * 100) / 100
	}

	function formatSbisDateTime(date = new Date()): string {
		const pad = (n: number) => String(n).padStart(2, '0')
		return [
			date.getFullYear(),
			pad(date.getMonth() + 1),
			pad(date.getDate()),
		].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	}

	function splitCustomerName(fullName: string): {
		name: string
		lastname?: string
		patronymic?: string
	} {
		const parts = fullName.trim().split(/\s+/).filter(Boolean)
		if (parts.length >= 2) {
			return {
				lastname: parts[0],
				name: parts[1],
				patronymic: parts.slice(2).join(' ') || undefined,
			}
		}
		return { name: parts[0] || 'Покупатель' }
	}

	function addressFull(order: any): string {
		const shipping = order?.shippingAddress || {}
		if (shipping.type === 'pickup') {
			return String(shipping.pickupAddress?.address || order?.cdekPvzAddress || '').trim()
		}
		if (shipping.selectedPvz?.address) {
			return String(shipping.selectedPvz.address).trim()
		}
		const delivery = shipping.deliveryAddress || {}
		return [
			delivery.city,
			delivery.street,
			delivery.house,
			delivery.apartment ? `кв. ${delivery.apartment}` : undefined,
		].filter(Boolean).join(', ')
	}

	async function getToken(): Promise<string> {
		const oauthUrl = process.env.SBIS_OAUTH_URL || 'https://online.sbis.ru/oauth/service/'
		const payload = {
			app_client_id: requiredEnv('SBIS_APP_CLIENT_ID'),
			app_secret: requiredEnv('SBIS_APP_SECRET'),
			secret_key: requiredEnv('SBIS_SECRET_KEY'),
		}

		try {
			const response = await axios.post(oauthUrl, payload, {
				timeout: Number(process.env.SBIS_TIMEOUT || 30000),
			})
			const token = response.data?.access_token || response.data?.token
			if (token) return String(token)
		} catch (error: any) {
			strapi.log.warn(`[SBIS Order Sync] JSON auth failed, retrying form auth: ${error?.message || error}`)
		}

		const form = new URLSearchParams(payload)
		const response = await axios.post(oauthUrl, form.toString(), {
			timeout: Number(process.env.SBIS_TIMEOUT || 30000),
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		})
		const token = response.data?.access_token || response.data?.token
		if (!token) {
			throw new Error(`SBIS auth failed: ${JSON.stringify(response.data)}`)
		}
		return String(token)
	}

	async function buildOrderPayload(order: any): Promise<JsonRecord> {
		const pointId = orderPointId()
		const priceListId = orderPriceListId()
		const customerData = order?.customerData || {}
		const customerName = String(customerData.name || '').trim()
		const phone = String(customerData.phone || '').trim()

		if (!phone) {
			throw new Error('Order customer phone is required for SBIS order')
		}

		const items = Array.isArray(order?.items) ? order.items : []
		if (items.length === 0) {
			throw new Error('Order has no items for SBIS order')
		}

		const nomenclatures = []
		for (const item of items) {
			const productId = Number(item?.productId)
			const quantity = Number(item?.quantity || 0)
			if (!productId || quantity <= 0) {
				throw new Error(`Invalid order item for SBIS order: ${JSON.stringify(item)}`)
			}

			const product = await strapi.entityService.findOne('api::product.product', productId)
			if (!product) {
				throw new Error(`Product ${productId} not found for SBIS order`)
			}

			const row: JsonRecord = {
				count: quantity,
				cost: toMoney(item?.price || (product as any).price || 0),
				name: item?.name || (product as any).name,
				priceListId,
			}

			const sbisId = Number((product as any).sbisId)
			const externalId = String((product as any).sbisExternalId || '').trim()
			const nomNumber = String((product as any).sbisNomNumber || item?.article || '').trim()
			if (Number.isInteger(sbisId) && sbisId > 0) {
				row.id = sbisId
			} else if (UUID_RE.test(externalId)) {
				row.externalId = externalId
			} else if (nomNumber) {
				row.nomNumber = nomNumber
			} else {
				throw new Error(`Product ${productId} has no SBIS id, externalId or nomNumber`)
			}

			nomenclatures.push(row)
		}

		const deliveryType = String(order?.deliveryType || '')
		const shipping = order?.shippingAddress || {}
		const isPickup = deliveryType === 'pickup' || shipping.type === 'pickup'
		const fullAddress = addressFull(order)
		if (!isPickup && !fullAddress) {
			throw new Error('Order delivery address is required for SBIS order')
		}

		const siteUrl =
			optionalEnv('SBIS_ORDER_RETAIL_PLACE') ||
			optionalEnv('FRONTEND_URL') ||
			optionalEnv('NEXT_PUBLIC_APP_URL') ||
			'https://borkssport.ru'

		const rawCustomerExternalId = String(
			(order as any).user?.id ?? (order as any).user ?? order.id ?? ''
		).trim()
		const customerExternalId: string | null =
			rawCustomerExternalId && UUID_RE.test(rawCustomerExternalId)
				? rawCustomerExternalId
				: null

		return {
			product: optionalEnv('SBIS_ORDER_PRODUCT') || 'delivery',
			pointId,
			externalId: order.sbisExternalId,
			comment: [
				`Заказ сайта ${order.orderNumber}`,
				order.notes ? `Комментарий: ${order.notes}` : undefined,
			].filter(Boolean).join('\n'),
			customer: {
				externalId: customerExternalId,
				...splitCustomerName(customerName),
				email: String(customerData.email || '').trim() || undefined,
				phone,
			},
			datetime: formatSbisDateTime(new Date(order.createdAt || Date.now())),
			nomenclatures,
			delivery: {
				isPickup,
				addressFull: !isPickup ? fullAddress : undefined,
				paymentType: 'online',
				shopURL: siteUrl,
				successURL: siteUrl,
				errorURL: siteUrl,
			},
		}
	}

	async function markFailed(orderId: number, payload: JsonRecord | null, error: any) {
		const message = error?.response?.data
			? JSON.stringify(error.response.data)
			: error?.message || String(error)
		await strapi.entityService.update('api::order.order', orderId, {
			data: {
				sbisSyncStatus: 'failed',
				sbisLastError: message,
				sbisPayload: payload || undefined,
			} as any,
		})
	}

	return {
		async syncPaidOrder(orderId: number, options: { force?: boolean } = {}) {
			const order = await strapi.entityService.findOne('api::order.order', orderId, {
				populate: ['user'],
			})

			if (!order) {
				throw new Error(`Order ${orderId} not found`)
			}
			if ((order as any).status !== 'paid') {
				throw new Error(`Order ${orderId} is not paid`)
			}
			if ((order as any).sbisSyncStatus === 'synced' && !options.force) {
				return { skipped: true, reason: 'already_synced', orderId }
			}
			if ((order as any).sbisSyncStatus === 'syncing' && !options.force) {
				return { skipped: true, reason: 'already_syncing', orderId }
			}

			const sbisExternalId = String((order as any).sbisExternalId || randomUUID())
			await strapi.entityService.update('api::order.order', orderId, {
				data: {
					sbisExternalId,
					sbisSyncStatus: 'syncing',
					sbisLastError: null,
				} as any,
			})

			let payload: JsonRecord | null = null
			try {
				const freshOrder = await strapi.entityService.findOne('api::order.order', orderId, {
					populate: ['user'],
				})
				payload = await buildOrderPayload(freshOrder)

				const token = await getToken()
				const apiBaseUrl = normalizeApiBaseUrl()
				const headers = {
					Authorization: `Bearer ${token}`,
					'X-SBISAccessToken': token,
				}
				const timeout = Number(process.env.SBIS_TIMEOUT || 30000)
				const createResponse = await axios.post(`${apiBaseUrl}/order/create`, payload, {
					headers,
					timeout,
				})

				const created = createResponse.data as JsonRecord | undefined
				const saleExternalId = String(
					created?.externalId ||
						created?.id ||
						created?.key ||
						created?.saleKey ||
						sbisExternalId
				).trim()

				let registerPaymentResponse: any = null
				if (boolEnv('SBIS_ORDER_REGISTER_PAYMENT', true)) {
					const registerParams = {
						bankSum: toMoney((freshOrder as any).totalAmount || 0),
						cashSum: 0,
						salarySum: 0,
						retailPlace:
							optionalEnv('SBIS_ORDER_RETAIL_PLACE') ||
							optionalEnv('FRONTEND_URL') ||
							optionalEnv('NEXT_PUBLIC_APP_URL') ||
							'https://borkssport.ru',
						paymentType: 'full',
						nonFiscal: boolEnv('SBIS_ORDER_NON_FISCAL', false),
					}
					// Saby API ожидает POST (GET больше не допускается).
					registerPaymentResponse = await axios.post(
						`${apiBaseUrl}/order/${encodeURIComponent(saleExternalId)}/register-payment`,
						registerParams,
						{
							headers,
							timeout,
						}
					)
				}

				const responseData = {
					create: createResponse.data,
					registerPayment: registerPaymentResponse?.data || null,
				}

				await strapi.entityService.update('api::order.order', orderId, {
					data: {
						sbisExternalId: saleExternalId,
						sbisSyncStatus: 'synced',
						sbisSyncedAt: new Date().toISOString(),
						sbisLastError: null,
						sbisPayload: payload,
						sbisResponse: responseData,
					} as any,
				})

				return { success: true, orderId, sbisExternalId: saleExternalId, response: responseData }
			} catch (error: any) {
				await markFailed(orderId, payload, error)
				throw error
			}
		},
	}
}
