/**
 * CommerceML Sync Controller
 * Обрабатывает HTTP запросы от Saby (СБИС) с XML данными
 */

import type { Core } from '@strapi/strapi'
import { randomUUID } from 'crypto'
import { verifyBasicAuth } from '../utils/auth-middleware'

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	/**
	 * Обрабатывает catalog (GET с mode или POST с XML)
	 * GET /api/commerceml-sync/catalog?mode=checkauth
	 * POST /api/commerceml-sync/catalog
	 */
	async handleCatalog(ctx: any) {
		const mode = ctx.query.mode || ctx.request.body?.mode

		// GET запрос с mode=checkauth - проверка авторизации
		if (ctx.request.method === 'GET' && mode === 'checkauth') {
			return this.handleCheckAuth(ctx, strapi)
		}

		// GET запрос с mode=init - инициализация обмена
		if (ctx.request.method === 'GET' && mode === 'init') {
			return this.handleInit(ctx, strapi, 'catalog')
		}

		// GET запрос с mode=file - получение файла
		if (ctx.request.method === 'GET' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'catalog')
		}

		// POST запрос - обработка XML
		return this.processCatalog(ctx)
	},

	/**
	 * Обрабатывает offers (GET с mode или POST с XML)
	 * GET /api/commerceml-sync/offers?mode=checkauth
	 * POST /api/commerceml-sync/offers
	 */
	async handleOffers(ctx: any) {
		const mode = ctx.query.mode || ctx.request.body?.mode

		if (ctx.request.method === 'GET' && mode === 'checkauth') {
			return this.handleCheckAuth(ctx, strapi)
		}
		if (ctx.request.method === 'GET' && mode === 'init') {
			return this.handleInit(ctx, strapi, 'offers')
		}
		if (ctx.request.method === 'GET' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'offers')
		}

		return this.processOffers(ctx)
	},

	/**
	 * Обрабатывает rests (GET с mode или POST с XML)
	 * GET /api/commerceml-sync/rests?mode=checkauth
	 * POST /api/commerceml-sync/rests
	 */
	async handleRests(ctx: any) {
		const mode = ctx.query.mode || ctx.request.body?.mode

		if (ctx.request.method === 'GET' && mode === 'checkauth') {
			return this.handleCheckAuth(ctx, strapi)
		}
		if (ctx.request.method === 'GET' && mode === 'init') {
			return this.handleInit(ctx, strapi, 'rests')
		}
		if (ctx.request.method === 'GET' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'rests')
		}

		return this.processRests(ctx)
	},

	/**
	 * Обрабатывает mode=checkauth - проверка авторизации
	 * CommerceML протокол требует вернуть "success" при успешной авторизации
	 */
	handleCheckAuth(ctx: any, strapi: Core.Strapi) {
		// Проверка Basic Auth
		if (!verifyBasicAuth(ctx, strapi)) {
			ctx.status = 401
			ctx.body = 'failure'
			ctx.type = 'text/plain'
			strapi.log.warn('[CommerceML] CheckAuth failed')
			return
		}

		// Saby ожидает Set-Cookie на checkauth и будет присылать Cookie дальше
		const cookieName = 'commerceml_session'
		const sessionToken = randomUUID()
		const isSecure = !!ctx.request?.secure
		ctx.cookies.set(cookieName, sessionToken, {
			httpOnly: true,
			secure: isSecure,
			sameSite: isSecure ? 'none' : 'lax',
			maxAge: 60 * 60 * 1000, // 1 hour
			path: '/',
		})

		// Успешная авторизация
		ctx.status = 200
		// Классический формат CommerceML/1C: success + cookieName + cookieValue (в body)
		// Некоторые клиенты (в т.ч. СБИС) валидируют cookie именно по body, а не по Set-Cookie.
		ctx.body = `success\n${cookieName}\n${sessionToken}`
		ctx.type = 'text/plain'
		strapi.log.info('[CommerceML] CheckAuth successful')
	},

	/**
	 * Обрабатывает mode=init - инициализация обмена
	 * Возвращает параметры для обмена
	 */
	handleInit(ctx: any, strapi: Core.Strapi, type: string) {
		const hasBasicAuth = verifyBasicAuth(ctx, strapi)
		const hasSessionCookie = !!ctx.cookies.get('commerceml_session')

		if (!hasBasicAuth && !hasSessionCookie) {
			ctx.status = 401
			ctx.body = 'failure'
			ctx.type = 'text/plain'
			return
		}

		// CommerceML протокол: возвращаем параметры обмена
		// Формат: version;zip;file_limit;step_time
		// version - версия протокола (обычно 2.08)
		// zip - поддержка zip (yes/no)
		// file_limit - максимальный размер файла в байтах (50MB)
		// step_time - задержка между запросами в секундах
		ctx.status = 200
		ctx.body = '2.08;no;52428800;0'
		ctx.type = 'text/plain'
		strapi.log.info(`[CommerceML] Init for ${type} successful`)
	},

	/**
	 * Обрабатывает mode=file - получение файла
	 * Saby запрашивает файл для загрузки
	 */
	handleFile(ctx: any, strapi: Core.Strapi, type: string) {
		const hasBasicAuth = verifyBasicAuth(ctx, strapi)
		const hasSessionCookie = !!ctx.cookies.get('commerceml_session')

		if (!hasBasicAuth && !hasSessionCookie) {
			ctx.status = 401
			ctx.body = 'failure'
			ctx.type = 'text/plain'
			return
		}

		const filename = ctx.query.filename || ctx.query.file

		// Если файл не указан, возвращаем список доступных файлов
		if (!filename) {
			ctx.status = 200
			ctx.body = 'failure\nФайл не указан'
			ctx.type = 'text/plain'
			return
		}

		// Для CommerceML мы только принимаем файлы, не отдаем
		// Поэтому возвращаем failure
		ctx.status = 200
		ctx.body = 'failure\nФайл не найден'
		ctx.type = 'text/plain'
		strapi.log.info(`[CommerceML] File request for ${type}: ${filename}`)
	},

	/**
	 * Обрабатывает catalog.xml (POST запрос)
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
