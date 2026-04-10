import type { Core } from '@strapi/strapi'
import axios, { type AxiosInstance } from 'axios'
import { createHmac, randomUUID } from 'crypto'

interface TochkaPayConfig {
	baseUrl: string
	createPaymentEndpoint: string
	statusEndpoint: string
	apiKey: string
	authToken: string
	secretKey: string
	merchantId: string
	terminalId: string
	clientId?: string
	customerCode: string
	successCallbackUrl?: string
	failureCallbackUrl?: string
	webhookSecret?: string
	timeout: number
	useReceiptPayload: boolean
}

interface CreatePaymentSessionOptions {
	orderNumber: string
	amount: number
	currency?: string
	description?: string
	customer?: {
		email?: string
		phone?: string
		name?: string
	}
	metadata?: Record<string, unknown>
}

interface TochkaPaySessionResponse {
	paymentUrl: string
	sessionId: string
	externalId: string
	status: string
	expiresAt?: string
	raw: unknown
}

interface TochkaPayStatusResponse {
	status: string
	raw: unknown
}

interface TochkaPayRefundResponse {
	refundId: string
	status: string
	raw: unknown
}

interface TochkaRefundStatusResult {
	status: string
	raw: unknown
}

interface TochkaWebhookEvent {
	eventType: string
	payload: Record<string, unknown>
}

interface TochkaOrderItem {
	name: string
	price: number
	quantity: number
	vatType?: string
	paymentMethod?: string
	paymentObject?: string
	measure?: string
}

interface CreateRefundOptions {
	operationId: string
	amount: number
	reason?: string
	paymentData?: Record<string, unknown>
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => sortKeys(item))
	}

	if (value && typeof value === 'object') {
		return Object.keys(value as Record<string, unknown>)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = sortKeys((value as Record<string, unknown>)[key])
				return acc
			}, {})
	}

	return value
}

function stringifyPayload(payload: unknown): string {
	return JSON.stringify(sortKeys(payload))
}

function buildSignature(secret: string, payload: unknown, salt?: string): string {
	const normalized = stringifyPayload(payload)
	const dataToSign = salt ? `${normalized}.${salt}` : normalized
	return createHmac('sha256', secret).update(dataToSign).digest('hex')
}

function createHttpClient(config: TochkaPayConfig): AxiosInstance {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	}

	if (config.authToken) {
		headers.Authorization = `Bearer ${config.authToken}`
	}

	if (config.clientId) {
		headers['X-Client-Id'] = config.clientId
	}

	if (config.apiKey) {
		headers['X-API-KEY'] = config.apiKey
	}

	return axios.create({
		baseURL: config.baseUrl,
		timeout: config.timeout,
		headers,
	})
}

function parsePaymentModes(raw: string | undefined, fallback: string[]): string[] {
	const modes = (raw || '')
		.split(',')
		.map((mode) => mode.trim())
		.filter((mode) => mode.length > 0)
	return modes.length ? modes : fallback
}

function formatAmount(value: number): string {
	return value.toFixed(2)
}

function normalizePhone(phone?: string | null): string {
	if (!phone) {
		return '+70000000000'
	}
	const digits = phone.replace(/\D+/g, '')
	if (digits.startsWith('8')) {
		return `+7${digits.slice(1)}`
	}
	if (digits.startsWith('7')) {
		return `+${digits}`
	}
	if (digits.startsWith('00')) {
		return `+${digits.slice(2)}`
	}
	if (digits.startsWith('+')) {
		return digits
	}
	return `+${digits}`
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	const config: TochkaPayConfig = {
		baseUrl:
			process.env.TOCHKA_PAY_BASE_URL || 'https://enter.tochka.com/uapi',
		createPaymentEndpoint:
			process.env.TOCHKA_PAY_CREATE_PAYMENT_PATH ||
			(process.env.TOCHKA_PAY_USE_RECEIPT === 'true'
				? '/acquiring/v1.0/payments_with_receipt'
				: '/acquiring/v1.0/payments'),
		statusEndpoint:
			process.env.TOCHKA_PAY_STATUS_PATH ||
			'/acquiring/v1.0/payments/{operationId}',
		apiKey: process.env.TOCHKA_PAY_API_KEY || undefined,
		authToken:
			process.env.TOCHKA_PAY_AUTH_TOKEN ||
			process.env.TOCHKA_PAY_API_KEY ||
			process.env.TOCHKA_JWT_KEY ||
			undefined,
		secretKey:
			process.env.TOCHKA_PAY_SECRET_KEY ||
			process.env.TOCHKA_JWT_KEY ||
			'',
		merchantId: process.env.TOCHKA_PAY_MERCHANT_ID || '',
		terminalId: process.env.TOCHKA_PAY_TERMINAL_ID || '',
		clientId: process.env.TOCHKA_CLIENT_ID || process.env.TOCHKA_PAY_CLIENT_ID,
		successCallbackUrl: process.env.TOCHKA_PAY_SUCCESS_URL,
		failureCallbackUrl: process.env.TOCHKA_PAY_FAILURE_URL,
		webhookSecret:
			process.env.TOCHKA_PAY_WEBHOOK_SECRET ||
			process.env.TOCHKA_PAY_SECRET_KEY ||
			process.env.TOCHKA_JWT_KEY ||
			'',
		timeout: Number(process.env.TOCHKA_PAY_TIMEOUT || 20000),
		customerCode: process.env.TOCHKA_PAY_CUSTOMER_CODE || '',
		useReceiptPayload: process.env.TOCHKA_PAY_USE_RECEIPT === 'true',
	}

	const http = createHttpClient(config)
	let retailerPromise:
		| Promise<{
				merchantId?: string
				customerCode?: string
		  } | null>
		| null = null

	const fetchRetailer = async () => {
		try {
			const response = await http.get('/acquiring/v1.0/retailers')
			const raw = response.data as Record<string, unknown>
			const data = (raw?.Data as unknown) ?? raw

			const retailers =
				(Array.isArray(data) ? data : null) ||
				(Array.isArray((data as any)?.items) ? (data as any).items : null) ||
				(Array.isArray((data as any)?.Retailers) ? (data as any).Retailers : null) ||
				[]

			const retailer = retailers[0] as Record<string, unknown> | undefined
			if (!retailer) {
				return null
			}

			const merchantId =
				(retailer.merchantId as string | undefined) ||
				(retailer.merchant_id as string | undefined)
			const customerCode =
				(retailer.customerCode as string | undefined) ||
				(retailer.customer_code as string | undefined)

			if (merchantId && /^\d+$/.test(merchantId)) {
				config.merchantId = merchantId
			}
			if (customerCode && !config.customerCode) {
				config.customerCode = customerCode
			}

			return { merchantId: config.merchantId, customerCode: config.customerCode }
		} catch (error: any) {
			strapi.log.warn('Tochka Pay: failed to fetch retailers', {
				error: error.response?.data || error.message,
			})
			return null
		}
	}

	const ensureRetailerContext = async () => {
		if (config.merchantId && config.customerCode) {
			return
		}

		if (!retailerPromise) {
			retailerPromise = fetchRetailer()
		}

		const result = await retailerPromise
		
		// Логируем результат получения retailer данных
		if (process.env.TOCHKA_PAY_DEBUG === 'true') {
			strapi.log.info('Tochka Pay: retailer context', {
				merchantId: config.merchantId || 'not set',
				customerCode: config.customerCode || 'not set',
				fetched: result,
			})
		}
		
		// Если не удалось получить через API, но есть в переменных окружения - используем их
		if (!config.merchantId && process.env.TOCHKA_PAY_MERCHANT_ID) {
			config.merchantId = process.env.TOCHKA_PAY_MERCHANT_ID
		}
		if (!config.customerCode && process.env.TOCHKA_PAY_CUSTOMER_CODE) {
			config.customerCode = process.env.TOCHKA_PAY_CUSTOMER_CODE
		}
	}

	return {
		config,

		buildSignature(payload: unknown, salt?: string) {
			return buildSignature(config.secretKey, payload, salt)
		},

		verifyWebhookSignature(payload: unknown, signature: string | undefined, salt?: string) {
			if (!config.webhookSecret) {
				throw new Error('Webhook secret is not configured for Tochka Pay')
			}

			if (!signature) {
				return false
			}

			const expected = buildSignature(config.webhookSecret, payload, salt)
			return expected === signature
		},

		async createPaymentSession(
			options: CreatePaymentSessionOptions
		): Promise<TochkaPaySessionResponse> {
			await ensureRetailerContext()

			const externalId = randomUUID()
			const metadata: Record<string, unknown> = {
				orderNumber: options.orderNumber,
				...(options.metadata || {}),
			}

			const basePaymentModes = ['sbp', 'card', 'tinkoff', 'dolyame']
			const metadataPaymentModes = Array.isArray(metadata.paymentModes)
				? (metadata.paymentModes as string[])
				: Array.isArray(metadata.paymentMode)
				? ([metadata.paymentMode].flat() as string[])
				: undefined
			const paymentModes =
				metadataPaymentModes && metadataPaymentModes.length
					? metadataPaymentModes
					: basePaymentModes

			const customerCode = String(
				(metadata.customerCode as string | number | undefined) ||
					config.customerCode
			)
			const merchantIdCandidate = (metadata.merchantId as string | number | undefined) || config.merchantId
			const merchantId =
				merchantIdCandidate !== undefined && merchantIdCandidate !== null
					? String(merchantIdCandidate)
					: undefined
			const normalizedMerchantId =
				merchantId && /^\d+$/.test(merchantId) ? merchantId : undefined
			const ttl = Number(metadata.ttl || 10080)
			const redirectUrl = (metadata.redirectUrl as string | undefined) ||
				config.successCallbackUrl
			const failRedirectUrl = (metadata.failRedirectUrl as string | undefined) ||
				config.failureCallbackUrl
			const paymentLinkId = (metadata.paymentLinkId as string | undefined) ||
				options.orderNumber
			const consumerId = (metadata.consumerId as string | undefined) ||
				customerCode ||
				externalId

			const clientName =
				options.customer?.name ||
				(metadata.clientName as string | undefined) ||
				'Покупатель'
			const clientEmail =
				options.customer?.email ||
				(metadata.clientEmail as string | undefined) ||
				'client@example.com'
			const clientPhone = normalizePhone(
				options.customer?.phone ||
					(metadata.clientPhone as string | undefined) ||
					'+70000000000'
			)

			const supplierInfo = {
				phone:
					normalizePhone(metadata.supplierPhone as string | undefined) ||
					'+79999999999',
				name: (metadata.supplierName as string) || 'ООО Поставщик',
				taxCode: (metadata.supplierTaxCode as string) || '770000000000',
			}

			const itemsMetadata = Array.isArray(metadata.items)
				? (metadata.items as TochkaOrderItem[])
				: []

			const itemsPayload =
				itemsMetadata.length > 0
					? itemsMetadata.map((item, index) => ({
							name:
								item.name ||
								options.description ||
								`Товар ${index + 1}`,
							amount: formatAmount(
								Number(item.price || 0) *
									Number(item.quantity || 1)
							),
							quantity: item.quantity || 1,
							vatType: item.vatType || 'none',
							paymentMethod: item.paymentMethod || 'full_payment',
							paymentObject: item.paymentObject || 'service',
							measure: item.measure || 'шт.',
							Supplier: supplierInfo,
					  }))
					: [
							{
								name:
									options.description ||
									`Оплата заказа ${options.orderNumber}`,
								amount: formatAmount(options.amount),
								quantity: 1,
								vatType: 'none',
								paymentMethod: 'full_payment',
								paymentObject: 'service',
								measure: 'шт.',
								Supplier: supplierInfo,
							},
					  ]

			const paymentData: Record<string, unknown> = {
				customerCode,
				amount: formatAmount(options.amount),
				purpose: options.description || `Оплата заказа ${options.orderNumber}`,
				redirectUrl: redirectUrl || undefined,
				failRedirectUrl: failRedirectUrl || undefined,
				paymentMode: paymentModes,
				saveCard: Boolean(metadata.saveCard),
				consumerId,
				merchantId: normalizedMerchantId,
				preAuthorization: Boolean(metadata.preAuthorization),
				ttl,
				paymentLinkId,
				taxSystemCode: metadata.taxSystemCode || 'osn',
				Client: {
					name: clientName,
					email: clientEmail,
					phone: clientPhone,
				},
			}

			Object.keys(paymentData).forEach((key) => {
				if (paymentData[key] === undefined) {
					delete paymentData[key]
				}
			})

			if (config.useReceiptPayload) {
				paymentData.Items = itemsPayload
				paymentData.Supplier =
					metadata.Supplier ||
					{
						phone: supplierInfo.phone,
						name: supplierInfo.name,
						taxCode: supplierInfo.taxCode,
					}
			}

			const payload = { Data: paymentData }

			try {
				const headers: Record<string, string> = {
					'X-Request-ID': externalId,
				}

				if (config.apiKey) {
					headers['X-API-KEY'] = config.apiKey
				}

				if (process.env.TOCHKA_PAY_DEBUG === 'true') {
					strapi.log.info('Tochka Pay request', {
						endpoint: config.createPaymentEndpoint,
						payload,
					})
				}

			const response = await http.post(
					config.createPaymentEndpoint,
					payload,
					{
						headers,
					}
				)

				const rawResponse = response.data as Record<string, unknown>
				const data =
					(rawResponse?.Data as Record<string, unknown>) || rawResponse
				const paymentUrl =
					(data?.paymentLink as string) ||
					(data?.payment_url as string) ||
					(data?.redirect_url as string) ||
					(data?.formUrl as string) ||
					''
				const sessionId =
					(data?.operationId as string) ||
					(data?.session_id as string) ||
					(data?.id as string) ||
					(data?.requestId as string) ||
					externalId
				const status = (data?.status as string) || 'pending'
				const expiresAt =
					(data?.expires_at as string | undefined) ||
					(data?.expiresAt as string | undefined)

				return {
					paymentUrl,
					sessionId,
					externalId,
					status,
					expiresAt,
					raw: rawResponse,
				}
			} catch (error: any) {
				const rawError = error.response?.data || error.message
				strapi.log.error('Tochka Pay: failed to create payment session', {
					error: rawError,
					payload,
				})
				const message =
					error.response?.data?.message ||
					error.response?.data?.Errors?.[0]?.message ||
					error.message
				const details =
					typeof rawError === 'string'
						? rawError
						: JSON.stringify(rawError)
				throw new Error(
					`Tochka Pay error: ${message}. Details: ${details}`
				)
			}
	},

	async getPaymentStatus(invoiceId: string): Promise<TochkaPayStatusResponse> {
		await ensureRetailerContext()

		const endpoint = config.statusEndpoint
			.replace('{invoiceId}', invoiceId)
			.replace('{operationId}', invoiceId)
			.replace('{requestId}', invoiceId)

		try {
			const headers: Record<string, string> = {
				'X-Request-ID': randomUUID(),
			}
			if (config.apiKey) {
				headers['X-API-KEY'] = config.apiKey
			}

			if (process.env.TOCHKA_PAY_DEBUG === 'true') {
				strapi.log.info('Tochka Pay status request', {
					endpoint,
					invoiceId,
					headers: {
						'X-Request-ID': headers['X-Request-ID'],
						'X-API-KEY': headers['X-API-KEY'] ? '***' : undefined,
						Authorization: config.authToken ? 'Bearer ***' : undefined,
						'X-Client-Id': config.clientId || undefined,
					},
					config: {
						baseUrl: config.baseUrl,
						merchantId: config.merchantId || 'not set',
						customerCode: config.customerCode || 'not set',
					},
				})
			}

			const response = await http.get(endpoint, { headers })
			const rawResponse = response.data as Record<string, unknown>
			const data = (rawResponse?.Data as Record<string, unknown>) || rawResponse
			
			// Статус может быть в разных местах в зависимости от формата ответа
			let status = 'unknown'
			
			// Проверяем Operation массив (новый формат)
			if (Array.isArray(data?.Operation) && data.Operation.length > 0) {
				const operation = (data.Operation as Array<Record<string, unknown>>)[0]
				status = (operation?.status as string) || 'unknown'
			}
			// Проверяем напрямую в data
			else if (data?.status) {
				status = data.status as string
			}
			// Проверяем в корне ответа
			else if (rawResponse?.status) {
				status = rawResponse.status as string
			}
			
			return {
				status: status,
				raw: rawResponse,
			}
		} catch (error: any) {
			const errorDetails = error.response?.data || error.message
			const errorMessage = error.response?.data?.message || 
				error.response?.data?.error?.message ||
				error.response?.data?.Errors?.[0]?.message ||
				error.message ||
				'Что-то пошло не так'

			strapi.log.error('Tochka Pay: failed to get payment status', {
				error: errorDetails,
				invoiceId,
				endpoint,
				statusCode: error.response?.status,
				config: {
					baseUrl: config.baseUrl,
					merchantId: config.merchantId || 'not set',
					customerCode: config.customerCode || 'not set',
					hasAuthToken: !!config.authToken,
					hasClientId: !!config.clientId,
					hasApiKey: !!config.apiKey,
				},
			})
			throw new Error(`Tochka Pay status error: ${errorMessage}`)
		}
	},

	async createRefund(options: CreateRefundOptions): Promise<TochkaPayRefundResponse> {
		await ensureRetailerContext()

		const operationId = String(options.operationId || '').trim()
		const amount = Number(options.amount || 0)

		if (!operationId) {
			throw new Error('Tochka Pay refund error: operationId is required')
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Tochka Pay refund error: amount must be > 0')
		}

		const paymentData = options.paymentData || {}

		// Detect payment mode: if lastSession has paymentMode/paymentModes === ['sbp'] then prefer SBP refund endpoint.
		const lastSession = (paymentData as any)?.lastSession as any
		const modeFromSession =
			(lastSession?.Data?.paymentMode as unknown) ||
			(lastSession?.data?.paymentMode as unknown) ||
			(lastSession?.Data?.paymentModes as unknown) ||
			(lastSession?.data?.paymentModes as unknown)

		const paymentModes = Array.isArray(modeFromSession)
			? (modeFromSession as string[])
			: typeof modeFromSession === 'string'
			? parsePaymentModes(modeFromSession, [])
			: []

		const preferSbp =
			paymentModes.length === 1 && String(paymentModes[0]).toLowerCase() === 'sbp'

		const headers: Record<string, string> = {
			'X-Request-ID': randomUUID(),
		}
		if (config.apiKey) {
			headers['X-API-KEY'] = config.apiKey
		}

		const attemptAcquiringRefund = async () => {
			const endpoint = `/acquiring/v1.0/payments/${encodeURIComponent(operationId)}/refund`
			const payload = {
				Data: {
					amount: formatAmount(amount),
					purpose: options.reason || undefined,
				},
			}
			if (process.env.TOCHKA_PAY_DEBUG === 'true') {
				strapi.log.info('Tochka Pay refund request (acquiring)', {
					endpoint,
					operationId,
					payload,
				})
			}

			const response = await http.post(endpoint, payload, { headers })
			const rawResponse = response.data as Record<string, unknown>
			const data = (rawResponse?.Data as Record<string, unknown>) || rawResponse
			const refundId =
				(data?.refundId as string) ||
				(data?.refund_id as string) ||
				(data?.requestId as string) ||
				(data?.request_id as string) ||
				operationId
			const status = (data?.status as string) || 'pending'
			return { refundId, status, raw: rawResponse }
		}

		const attemptSbpRefund = async () => {
			const endpoint = `/sbp/v1.0/refund`
			const payload = {
				Data: {
					transactionId: operationId,
					amount: formatAmount(amount),
					purpose: options.reason || undefined,
				},
			}
			if (process.env.TOCHKA_PAY_DEBUG === 'true') {
				strapi.log.info('Tochka Pay refund request (sbp)', {
					endpoint,
					operationId,
					payload,
				})
			}
			const response = await http.post(endpoint, payload, { headers })
			const rawResponse = response.data as Record<string, unknown>
			const data = (rawResponse?.Data as Record<string, unknown>) || rawResponse
			const refundId =
				(data?.requestId as string) ||
				(data?.request_id as string) ||
				(data?.refundId as string) ||
				operationId
			const status = (data?.status as string) || 'pending'
			return { refundId, status, raw: rawResponse }
		}

		try {
			// For SBP-only sessions try SBP endpoint first, then acquiring; otherwise reverse.
			const primary = preferSbp ? attemptSbpRefund : attemptAcquiringRefund
			const secondary = preferSbp ? attemptAcquiringRefund : attemptSbpRefund

			try {
				return await primary()
			} catch (primaryError: any) {
				const primaryDetails = primaryError?.response?.data || primaryError?.message
				strapi.log.warn('Tochka Pay refund primary attempt failed, trying fallback', {
					preferSbp,
					operationId,
					primaryDetails,
				})
				return await secondary()
			}
		} catch (error: any) {
			const rawError = error.response?.data || error.message
			strapi.log.error('Tochka Pay: failed to create refund', {
				error: rawError,
				operationId,
				amount,
				preferSbp,
			})
			const details =
				typeof rawError === 'string' ? rawError : JSON.stringify(rawError)
			throw new Error(`Tochka Pay refund error. Details: ${details}`)
		}
	},

	/**
	 * Получить актуальный статус возврата.
	 * В API Точки явный GET /refund может отсутствовать, поэтому используем общий статус операции.
	 */
	async getRefundStatus(operationId: string): Promise<TochkaRefundStatusResult> {
		const result = await this.getPaymentStatus(operationId)
		return { status: result.status, raw: result.raw }
	},

	mapWebhookEvent(body: Record<string, unknown>): TochkaWebhookEvent {
		const eventType = (body?.event as string) || (body?.event_type as string) || 'unknown'
		const payload = (body?.data as Record<string, unknown>) || body
		return {
			eventType,
			payload,
		}
	},
};
}