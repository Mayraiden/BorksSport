/**
 * CommerceML Sync Controller
 * Обрабатывает HTTP запросы от Saby (СБИС) с XML данными
 */

import type { Core } from '@strapi/strapi'
import { verifyBasicAuth } from '../utils/auth-middleware'

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	/**
	 * Обрабатывает catalog.xml
	 * POST /api/commerceml-sync/catalog
	 */
	async processCatalog(ctx: any) {
		try {
			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = {
					success: false,
					message: 'Unauthorized: Invalid Basic Auth credentials',
				}
				return
			}

			// Получаем XML из body (raw text или из поля xml)
			let xmlString: string

			// Пробуем разные способы получения XML
			// 1. Raw body (если Content-Type: text/xml или application/xml)
			if (typeof ctx.request.body === 'string') {
				xmlString = ctx.request.body
			}
			// 2. Из поля xml (для JSON запросов)
			else if (ctx.request.body?.xml && typeof ctx.request.body.xml === 'string') {
				xmlString = ctx.request.body.xml
			}
			// 3. Из поля data
			else if (ctx.request.body?.data && typeof ctx.request.body.data === 'string') {
				xmlString = ctx.request.body.data
			}
			// 4. Пробуем rawBody если доступен (для некоторых middleware)
			else if ((ctx.request as any).rawBody && typeof (ctx.request as any).rawBody === 'string') {
				xmlString = (ctx.request as any).rawBody
			}
			// 5. Если body это объект, пробуем преобразовать в строку
			else if (ctx.request.body && typeof ctx.request.body === 'object') {
				// Может быть уже распарсен как объект, пробуем преобразовать обратно
				strapi.log.warn('[CommerceML Controller] Body is object, trying to stringify...')
				xmlString = JSON.stringify(ctx.request.body)
			}
			else {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string expected in body. Send XML as raw text with Content-Type: text/xml or application/xml',
				}
				return
			}

			if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length === 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string is empty',
				}
				return
			}

			// Обрабатываем catalog
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processCatalog(xmlString)

			ctx.status = 200
			ctx.body = result
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Catalog processing failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to process catalog',
			}
		}
	},

	/**
	 * Обрабатывает offers.xml (цены)
	 * POST /api/commerceml-sync/offers
	 */
	async processOffers(ctx: any) {
		try {
			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = {
					success: false,
					message: 'Unauthorized: Invalid Basic Auth credentials',
				}
				return
			}

			// Получаем XML из body (raw text или из поля xml)
			let xmlString: string

			// Пробуем разные способы получения XML
			// 1. Raw body (если Content-Type: text/xml или application/xml)
			if (typeof ctx.request.body === 'string') {
				xmlString = ctx.request.body
			}
			// 2. Из поля xml (для JSON запросов)
			else if (ctx.request.body?.xml && typeof ctx.request.body.xml === 'string') {
				xmlString = ctx.request.body.xml
			}
			// 3. Из поля data
			else if (ctx.request.body?.data && typeof ctx.request.body.data === 'string') {
				xmlString = ctx.request.body.data
			}
			// 4. Пробуем rawBody если доступен (для некоторых middleware)
			else if ((ctx.request as any).rawBody && typeof (ctx.request as any).rawBody === 'string') {
				xmlString = (ctx.request as any).rawBody
			}
			// 5. Если body это объект, пробуем преобразовать в строку
			else if (ctx.request.body && typeof ctx.request.body === 'object') {
				// Может быть уже распарсен как объект, пробуем преобразовать обратно
				strapi.log.warn('[CommerceML Controller] Body is object, trying to stringify...')
				xmlString = JSON.stringify(ctx.request.body)
			}
			else {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string expected in body. Send XML as raw text with Content-Type: text/xml or application/xml',
				}
				return
			}

			if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length === 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string is empty',
				}
				return
			}

			// Обрабатываем offers
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processOffers(xmlString)

			ctx.status = 200
			ctx.body = result
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Offers processing failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to process offers',
			}
		}
	},

	/**
	 * Обрабатывает rests.xml (остатки)
	 * POST /api/commerceml-sync/rests
	 */
	async processRests(ctx: any) {
		try {
			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = {
					success: false,
					message: 'Unauthorized: Invalid Basic Auth credentials',
				}
				return
			}

			// Получаем XML из body (raw text или из поля xml)
			let xmlString: string

			// Пробуем разные способы получения XML
			// 1. Raw body (если Content-Type: text/xml или application/xml)
			if (typeof ctx.request.body === 'string') {
				xmlString = ctx.request.body
			}
			// 2. Из поля xml (для JSON запросов)
			else if (ctx.request.body?.xml && typeof ctx.request.body.xml === 'string') {
				xmlString = ctx.request.body.xml
			}
			// 3. Из поля data
			else if (ctx.request.body?.data && typeof ctx.request.body.data === 'string') {
				xmlString = ctx.request.body.data
			}
			// 4. Пробуем rawBody если доступен (для некоторых middleware)
			else if ((ctx.request as any).rawBody && typeof (ctx.request as any).rawBody === 'string') {
				xmlString = (ctx.request as any).rawBody
			}
			// 5. Если body это объект, пробуем преобразовать в строку
			else if (ctx.request.body && typeof ctx.request.body === 'object') {
				// Может быть уже распарсен как объект, пробуем преобразовать обратно
				strapi.log.warn('[CommerceML Controller] Body is object, trying to stringify...')
				xmlString = JSON.stringify(ctx.request.body)
			}
			else {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string expected in body. Send XML as raw text with Content-Type: text/xml or application/xml',
				}
				return
			}

			if (!xmlString || typeof xmlString !== 'string' || xmlString.trim().length === 0) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: XML string is empty',
				}
				return
			}

			// Обрабатываем rests
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processRests(xmlString)

			ctx.status = 200
			ctx.body = result
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Rests processing failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to process rests',
			}
		}
	},

	/**
	 * Тестовый эндпоинт для проверки подключения
	 * GET /api/commerceml-sync/test
	 */
	async test(ctx: any) {
		try {
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.testConnection()

			ctx.status = 200
			ctx.body = result
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Test failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Test failed',
			}
		}
	},

	/**
	 * Ручная загрузка XML для тестирования
	 * POST /api/commerceml-sync/upload
	 * Body: { type: 'catalog' | 'offers' | 'rests', xml: '<xml>...</xml>' }
	 */
	async upload(ctx: any) {
		try {
			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = {
					success: false,
					message: 'Unauthorized: Invalid Basic Auth credentials',
				}
				return
			}

			const { type, xml } = ctx.request.body

			if (!type || !xml) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid request: type and xml fields required',
				}
				return
			}

			if (!['catalog', 'offers', 'rests'].includes(type)) {
				ctx.status = 400
				ctx.body = {
					success: false,
					message: 'Invalid type: must be catalog, offers, or rests',
				}
				return
			}

			let result
			if (type === 'catalog') {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processCatalog(xml)
			} else if (type === 'offers') {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processOffers(xml)
			} else {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processRests(xml)
			}

			ctx.status = 200
			ctx.body = result
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Upload failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message || 'Failed to process upload',
			}
		}
	},
})
