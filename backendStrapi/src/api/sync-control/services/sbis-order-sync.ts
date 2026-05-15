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

	/** Сумма к оплате в Saby только по товарам (без доставки СДЭК и прочего из totalAmount). */
	function orderGoodsBankSum(order: any): number {
		const items = Array.isArray(order?.items) ? order.items : []
		let sum = 0
		for (const it of items) {
			const qty = Number(it?.quantity || 0)
			const price = Number(it?.price || 0)
			const subtotal = Number(it?.subtotal)
			if (Number.isFinite(subtotal) && subtotal > 0) {
				sum += subtotal
			} else if (qty > 0 && Number.isFinite(price)) {
				sum += price * qty
			}
		}
		return toMoney(sum)
	}

	const SBIS_DATETIME_TZ =
		optionalEnv('SBIS_ORDER_DATETIME_TZ') || 'Europe/Moscow'

	function formatSbisDateTime(date = new Date()): string {
		const offsetMin = Number(optionalEnv('SBIS_ORDER_DATETIME_OFFSET_MINUTES') || '0')
		const when = Number.isFinite(offsetMin) && offsetMin !== 0
			? new Date(date.getTime() + offsetMin * 60_000)
			: date

		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: SBIS_DATETIME_TZ,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		}).formatToParts(when)

		const pick = (type: Intl.DateTimeFormatPartTypes) =>
			parts.find((p) => p.type === type)?.value || '00'

		return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`
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
			// Saby retail отклоняет datetime в прошлом; при отложенном синке — текущее время.
			datetime: formatSbisDateTime(new Date()),
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

	function resolveSaleExternalId(order: any, fallbackId?: string): string {
		const fromOrder = String(order?.sbisExternalId || '').trim()
		if (fromOrder) return fromOrder

		const response = order?.sbisResponse as JsonRecord | undefined
		const created = response?.create as JsonRecord | undefined
		const fromCreate = String(
			created?.externalId || created?.id || created?.key || created?.saleKey || ''
		).trim()
		if (fromCreate) return fromCreate

		return String(fallbackId || '').trim()
	}

	function hasRegisterPaymentResponse(order: any): boolean {
		const response = order?.sbisResponse as JsonRecord | undefined
		const reg = response?.registerPayment as JsonRecord | undefined
		if (!reg) return false
		if (reg.successFlag === false) return false
		const msg = String(reg.message || '').toLowerCase()
		if (msg.includes('не найден') || msg.includes('not found')) return false
		return true
	}

	function hasSuccessfulSbisCreate(order: any): boolean {
		const created = (order?.sbisResponse as JsonRecord | undefined)?.create as
			| JsonRecord
			| undefined
		if (!created) return false
		if (created.error) return false
		return !!(
			created.externalId ||
			created.id ||
			created.key ||
			created.saleKey
		)
	}

	const SBIS_ELIGIBLE_ORDER_STATUSES = new Set(['paid', 'shipped', 'delivered'])

	async function assertOrderEligibleForSbisSync(order: any, orderId: number) {
		const orderStatus = String((order as any)?.status || '').trim()
		if (!SBIS_ELIGIBLE_ORDER_STATUSES.has(orderStatus)) {
			throw new Error(
				`Order ${orderId} status "${orderStatus || 'empty'}" is not eligible for SBIS sync (need paid/shipped/delivered)`
			)
		}

		const paidPayments = await strapi.entityService.findMany('api::payment.payment', {
			filters: {
				order: orderId,
				status: 'paid',
			} as any,
			limit: 1,
		})

		if (!paidPayments?.length) {
			throw new Error(
				`Order ${orderId} has no paid payment record — sync Tochka payment status first`
			)
		}
	}

	function resolveRegisterPaymentMode(): 'unknown' | 'cash' | 'bank' {
		const fromEnv = optionalEnv('SBIS_ORDER_REGISTER_PAYMENT_MODE')?.toLowerCase()
		if (fromEnv === 'unknown' || fromEnv === 'cash' || fromEnv === 'bank') {
			return fromEnv
		}
		if (boolEnv('SBIS_ORDER_USE_UNKNOWN_SUM', false)) return 'unknown'
		if (boolEnv('SBIS_ORDER_REGISTER_AS_CASH', false)) return 'cash'
		return 'unknown'
	}

	function buildRegisterPaymentParams(freshOrder: any): JsonRecord {
		const amount = orderGoodsBankSum(freshOrder)
		const retailPlace =
			optionalEnv('SBIS_ORDER_RETAIL_PLACE') ||
			optionalEnv('FRONTEND_URL') ||
			optionalEnv('NEXT_PUBLIC_APP_URL') ||
			'https://borkssport.ru'
		const base = {
			retailPlace,
			paymentType: 'full',
			nonFiscal: boolEnv('SBIS_ORDER_NON_FISCAL', true),
		}

		const mode = resolveRegisterPaymentMode()
		if (mode === 'unknown') {
			const sumField =
				optionalEnv('SBIS_ORDER_CUSTOM_SUM_FIELD') || 'unknownSum'
			return {
				bankSum: 0,
				cashSum: 0,
				salarySum: 0,
				[sumField]: amount,
				...base,
				nonFiscal: true,
			}
		}

		if (mode === 'cash') {
			return {
				bankSum: 0,
				cashSum: amount,
				salarySum: 0,
				...base,
				nonFiscal: true,
			}
		}

		const nonFiscal = base.nonFiscal
		return {
			bankSum: nonFiscal ? 0 : amount,
			cashSum: nonFiscal ? amount : 0,
			salarySum: 0,
			...base,
			nonFiscal,
		}
	}

	function throwRegisterPaymentFailed(message: string, registerParams: JsonRecord): never {
		const err = new Error(message) as Error & { sbisRegisterPaymentParams?: JsonRecord }
		err.sbisRegisterPaymentParams = registerParams
		throw err
	}

	async function postRegisterPayment(
		freshOrder: any,
		saleExternalId: string,
		token: string,
		apiBaseUrl: string,
		timeout: number
	): Promise<{ axiosResponse: any; registerParams: JsonRecord }> {
		const headers = {
			Authorization: `Bearer ${token}`,
			'X-SBISAccessToken': token,
		}
		const registerParams = buildRegisterPaymentParams(freshOrder)
		strapi.log.info(
			`[SBIS Order Sync] register-payment sale=${saleExternalId} params=${JSON.stringify(registerParams)}`
		)
		try {
			const axiosResponse = await axios.post(
				`${apiBaseUrl}/order/${encodeURIComponent(saleExternalId)}/register-payment`,
				registerParams,
				{ headers, timeout }
			)
			return { axiosResponse, registerParams }
		} catch (error: any) {
			error.sbisRegisterPaymentParams = registerParams
			throw error
		}
	}

	async function fetchOrderState(externalId: string) {
		const token = await getToken()
		const apiBaseUrl = normalizeApiBaseUrl()
		const headers = {
			Authorization: `Bearer ${token}`,
			'X-SBISAccessToken': token,
		}
		const timeout = Number(process.env.SBIS_TIMEOUT || 30000)
		const response = await axios.get(
			`${apiBaseUrl}/order/${encodeURIComponent(externalId)}/state`,
			{ headers, timeout }
		)
		return response.data
	}

	return {
		async getOrderState(orderId: number) {
			const order = await strapi.entityService.findOne('api::order.order', orderId)
			if (!order) {
				throw new Error(`Order ${orderId} not found`)
			}

			const sbisExternalId = resolveSaleExternalId(order)
			if (!sbisExternalId) {
				throw new Error(
					`Order ${orderId} has no SBIS external id (sbisExternalId / sbisResponse.create)`
				)
			}

			const state = await fetchOrderState(sbisExternalId)
			return {
				orderId,
				orderNumber: (order as any).orderNumber,
				sbisExternalId,
				sbisSyncStatus: (order as any).sbisSyncStatus,
				state,
			}
		},

		async registerSbisPayment(orderId: number) {
			return this.syncPaidOrder(orderId, {
				force: true,
				registerPaymentOnly: true,
			})
		},

		async syncPaidOrder(
			orderId: number,
			options: { force?: boolean; registerPaymentOnly?: boolean } = {}
		) {
			const order = await strapi.entityService.findOne('api::order.order', orderId, {
				populate: ['user'],
			})

			if (!order) {
				throw new Error(`Order ${orderId} not found`)
			}
			await assertOrderEligibleForSbisSync(order, orderId)

			const existingSaleId = resolveSaleExternalId(order)
			const registerPaymentOnly =
				options.registerPaymentOnly ||
				(options.force &&
					hasSuccessfulSbisCreate(order) &&
					!hasRegisterPaymentResponse(order))

			if (registerPaymentOnly && !existingSaleId) {
				throw new Error(
					`Order ${orderId}: sale id in Saby is missing (sbisExternalId / sbisResponse.create)`
				)
			}

			if (
				(order as any).sbisSyncStatus === 'synced' &&
				hasRegisterPaymentResponse(order) &&
				!options.registerPaymentOnly
			) {
				return {
					skipped: true,
					reason: 'already_synced_with_payment',
					orderId,
					sbisExternalId: existingSaleId,
				}
			}

			if ((order as any).sbisSyncStatus === 'synced' && !options.force && !registerPaymentOnly) {
				return { skipped: true, reason: 'already_synced', orderId }
			}
			if ((order as any).sbisSyncStatus === 'syncing' && !options.force) {
				return { skipped: true, reason: 'already_syncing', orderId }
			}

			const needsFreshSale =
				!hasSuccessfulSbisCreate(order) && !options.registerPaymentOnly
			const sbisExternalId = needsFreshSale
				? randomUUID()
				: existingSaleId || String((order as any).sbisExternalId || randomUUID())
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
				const token = await getToken()
				const apiBaseUrl = normalizeApiBaseUrl()
				const headers = {
					Authorization: `Bearer ${token}`,
					'X-SBISAccessToken': token,
				}
				const timeout = Number(process.env.SBIS_TIMEOUT || 30000)

				if (registerPaymentOnly) {
					const saleExternalId = resolveSaleExternalId(freshOrder, sbisExternalId)
					let registerPaymentResult: Awaited<ReturnType<typeof postRegisterPayment>> | null =
						null
					if (boolEnv('SBIS_ORDER_REGISTER_PAYMENT', true)) {
						registerPaymentResult = await postRegisterPayment(
							freshOrder,
							saleExternalId,
							token,
							apiBaseUrl,
							timeout
						)
					}

					const registerParams = registerPaymentResult?.registerParams || null
					const regData = (registerPaymentResult?.axiosResponse?.data ||
						null) as JsonRecord | null
					if (regData?.successFlag === false) {
						const errMsg =
							String(regData.message || '') || 'SBIS register-payment failed'
						throwRegisterPaymentFailed(
							errMsg,
							registerParams || buildRegisterPaymentParams(freshOrder)
						)
					}

					const previousResponse = ((freshOrder as any).sbisResponse || {}) as JsonRecord
					const responseData = {
						...previousResponse,
						registerPayment: regData,
						registerPaymentRequest: registerParams,
					}

					await strapi.entityService.update('api::order.order', orderId, {
						data: {
							sbisExternalId: saleExternalId,
							sbisSyncStatus: 'synced',
							sbisSyncedAt: new Date().toISOString(),
							sbisLastError: null,
							sbisResponse: responseData,
						} as any,
					})

					return {
						success: true,
						orderId,
						sbisExternalId: saleExternalId,
						registerPaymentOnly: true,
						response: responseData,
					}
				}

				payload = await buildOrderPayload(freshOrder)
				strapi.log.info(
					`[SBIS Order Sync] order ${orderId} create datetime=${payload.datetime} tz=${SBIS_DATETIME_TZ} externalId=${payload.externalId}`
				)
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

				let registerPaymentResult: Awaited<ReturnType<typeof postRegisterPayment>> | null =
					null
				if (boolEnv('SBIS_ORDER_REGISTER_PAYMENT', true)) {
					registerPaymentResult = await postRegisterPayment(
						freshOrder,
						saleExternalId,
						token,
						apiBaseUrl,
						timeout
					)
				}

				const registerParams = registerPaymentResult?.registerParams || null
				const regData = (registerPaymentResult?.axiosResponse?.data || null) as JsonRecord | null
				if (regData?.successFlag === false) {
					const errMsg =
						String(regData.message || '') || 'SBIS register-payment failed'
					throwRegisterPaymentFailed(
						errMsg,
						registerParams || buildRegisterPaymentParams(freshOrder)
					)
				}

				const responseData = {
					create: createResponse.data,
					registerPayment: regData,
					registerPaymentRequest: registerParams,
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
