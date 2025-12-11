import type { Core } from '@strapi/strapi'
import axios from 'axios'

/**
 * Интерфейсы для работы с API СДЭК
 */
interface CDEKAccessToken {
	access_token: string
	token_type: string
	expires_in: number
	scope: string
	jti: string
}

interface CDEKLocation {
	code?: number
	city?: string
	address?: string
	postal_code?: string
}

interface CDEKPackage {
	weight: number
	length?: number
	width?: number
	height?: number
	comment?: string
}

interface CDEKCalculationRequest {
	from_location?: CDEKLocation
	to_location: CDEKLocation
	packages: CDEKPackage[]
	tariff_code?: number
}

interface CDEKCalculationResponse {
	tariff_codes: Array<{
		tariff_code: number
		tariff_name: string
		tariff_description: string
		delivery_mode: number
		delivery_sum: number
		period_min: number
		period_max: number
	}>
}

interface CDEKCity {
	code: number
	city: string
	city_uuid?: string
	kladr: string
	fias: string
	region: string
	region_code: number
	country: string
	country_code: string
	longitude?: number
	latitude?: number
	postal_codes?: string[]
}

interface CDEKPVZ {
	code: string
	name: string
	location: {
		address: string
		address_full: string
		city: string
		region: string
		country: string
		postal_code: string
		latitude: number
		longitude: number
	}
	work_time: string
	phones?: Array<{
		number: string
	}>
	email?: string
	note?: string
	type?: string
	owner_code?: string
	address_comment?: string
}

interface CDEKOrderRequest {
	type: number
	number?: string
	tariff_code: number
	comment?: string
	from_location: CDEKLocation
	to_location: CDEKLocation
	recipient: {
		name: string
		phones: Array<{
			number: string
		}>
		email?: string
	}
	seller?: {
		name: string
		inn?: string
		phone?: string
		address?: string
	}
	packages: Array<{
		number?: string
		weight: number
		length?: number
		width?: number
		height?: number
		comment?: string
		items?: Array<{
			name: string
			ware_key: string
			payment: {
				value: number
			}
			weight: number
			amount: number
		}>
	}>
}

interface CDEKOrderResponse {
	entity: {
		uuid: string
		requests: Array<{
			request_uuid: string
			type: string
			state: string
			date_time: string
			errors?: Array<{
				code: string
				message: string
			}>
		}>
	}
}

interface CDEKTokenCache {
	token: string
	expiresAt: number
}

/**
 * Сервис для работы с API СДЭК
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
	// Конфигурация из переменных окружения
	const config = {
		apiUrl: process.env.CDEK_API_URL || 'https://api.edu.cdek.ru/v2',
		clientId: process.env.CDEK_CLIENT_ID || '',
		clientSecret: process.env.CDEK_CLIENT_SECRET || '',
		testMode: process.env.CDEK_TEST_MODE === 'true',
		timeout: 30000,
		// Тестовые данные склада
		warehouse: {
			address: 'г. Москва, ул. Тестовая, д. 1',
			city: 'Москва',
			phone: '+79999999999',
			name: 'Тестовый склад',
		},
	}

	// Кэш для токена доступа
	let tokenCache: CDEKTokenCache | null = null

	/**
	 * Получение токена доступа (вспомогательная функция)
	 */
	async function getAccessTokenInternal(): Promise<string> {
		// Проверяем кэш
		if (tokenCache && tokenCache.expiresAt > Date.now()) {
			return tokenCache.token
		}

		try {
			const response = await axios.post<CDEKAccessToken>(
				`${config.apiUrl}/oauth/token`,
				{
					grant_type: 'client_credentials',
					client_id: config.clientId,
					client_secret: config.clientSecret,
				},
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					timeout: config.timeout,
				}
			)

			const { access_token, expires_in } = response.data

			// Сохраняем в кэш (оставляем запас 5 минут до истечения)
			tokenCache = {
				token: access_token,
				expiresAt: Date.now() + (expires_in - 300) * 1000,
			}

			return access_token
		} catch (error: any) {
			strapi.log.error('CDEK: Error getting access token', error)
			throw new Error(
				`Failed to get CDEK access token: ${error.response?.data?.error_description || error.message}`
			)
		}
	}

	/**
	 * Выполнение запроса к API СДЭК с автоматической авторизацией
	 */
	async function apiRequest<T>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		endpoint: string,
		data?: any
	): Promise<T> {
		const token = await getAccessTokenInternal()

		try {
			const response = await axios.request<T>({
				method,
				url: `${config.apiUrl}${endpoint}`,
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				data,
				timeout: config.timeout,
			})

			return response.data
		} catch (error: any) {
			strapi.log.error(`CDEK: API request failed ${method} ${endpoint}`, {
				error: error.response?.data || error.message,
				data,
			})
			throw new Error(
				`CDEK API error: ${error.response?.data?.error_description || error.message}`
			)
		}
	}

	/**
	 * Поиск города (вспомогательная функция)
	 */
	async function searchCitiesInternal(query: string): Promise<CDEKCity[]> {
		if (!query || query.length < 2) {
			return []
		}

		try {
			const cities = await apiRequest<CDEKCity[]>(
				'GET',
				`/location/cities?${new URLSearchParams({ city: query })}`
			)
			return cities || []
		} catch (error: any) {
			strapi.log.error('CDEK: Error searching cities', error)
			return []
		}
	}

	return {
		config,

		/**
		 * Получение токена доступа OAuth 2.0
		 * Кэширует токен до истечения срока действия
		 */
		async getAccessToken(): Promise<string> {
			return getAccessTokenInternal()
		},

		/**
		 * Поиск города по названию
		 */
		async searchCities(query: string): Promise<CDEKCity[]> {
			return searchCitiesInternal(query)
		},

		/**
		 * Получение списка ПВЗ по коду города
		 */
		async getPvzList(cityCode: number): Promise<CDEKPVZ[]> {
			if (!cityCode) {
				return []
			}

			try {
				const pvzList = await apiRequest<CDEKPVZ[]>(
					'GET',
					`/deliverypoints?city_code=${cityCode}`
				)
				return pvzList || []
			} catch (error: any) {
				strapi.log.error('CDEK: Error getting PVZ list', error)
				return []
			}
		},

		/**
		 * Расчет стоимости доставки
		 */
		async calculateDelivery(
			toLocation: CDEKLocation,
			packages: CDEKPackage[],
			tariffCode?: number
		): Promise<CDEKCalculationResponse> {
			// Если передан только название города, нужно найти код города
			let toLocationWithCode = { ...toLocation }
			if (toLocation.city && !toLocation.code) {
				const cities = await searchCitiesInternal(toLocation.city)
				if (cities.length > 0) {
					// Берем первый найденный город
					toLocationWithCode.code = cities[0].code
					toLocationWithCode.city = cities[0].city
				}
			}

			// Подготовка локации отправителя (склад)
			// Нужно найти код города склада
			let fromLocation: CDEKLocation = {
				city: config.warehouse.city,
				address: config.warehouse.address,
			}
			const warehouseCities = await searchCitiesInternal(config.warehouse.city)
			if (warehouseCities.length > 0) {
				fromLocation.code = warehouseCities[0].code
				fromLocation.city = warehouseCities[0].city
			}

			const request: CDEKCalculationRequest = {
				from_location: fromLocation,
				to_location: toLocationWithCode,
				packages,
				tariff_code: tariffCode,
			}

			try {
				const response = await apiRequest<CDEKCalculationResponse>(
					'POST',
					'/calculator/tarifflist',
					request
				)
				return response
			} catch (error: any) {
				strapi.log.error('CDEK: Error calculating delivery', {
					error: error.response?.data || error.message,
					request,
				})
				throw new Error(
					`Failed to calculate delivery: ${error.response?.data?.error_description || error.message}`
				)
			}
		},

		/**
		 * Создание заказа в СДЭК
		 */
		async createOrder(orderData: CDEKOrderRequest): Promise<CDEKOrderResponse> {
			try {
				const response = await apiRequest<CDEKOrderResponse>(
					'POST',
					'/orders',
					orderData
				)
				return response
			} catch (error: any) {
				strapi.log.error('CDEK: Error creating order', {
					error: error.response?.data || error.message,
					orderData,
				})
				throw new Error(
					`Failed to create CDEK order: ${error.response?.data?.error_description || error.message}`
				)
			}
		},

		/**
		 * Отслеживание заказа по трек-номеру
		 */
		async trackOrder(trackNumber: string): Promise<any> {
			if (!trackNumber) {
				throw new Error('Track number is required')
			}

			try {
				const response = await apiRequest<any>(
					'GET',
					`/orders?cdek_number=${trackNumber}`
				)
				return response
			} catch (error: any) {
				strapi.log.error('CDEK: Error tracking order', error)
				throw new Error(
					`Failed to track order: ${error.response?.data?.error_description || error.message}`
				)
			}
		},

		/**
		 * Получение конфигурации (для тестирования)
		 */
		getConfig() {
			return {
				apiUrl: config.apiUrl,
				testMode: config.testMode,
				hasCredentials: !!config.clientId && !!config.clientSecret,
			}
		},
	}
}
