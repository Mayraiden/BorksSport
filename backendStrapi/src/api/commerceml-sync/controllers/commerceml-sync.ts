/**
 * CommerceML Sync Controller
 * Обрабатывает HTTP запросы от Saby (СБИС) с XML данными
 */

import type { Core } from '@strapi/strapi'
import { randomUUID } from 'crypto'
import { verifyBasicAuth } from '../utils/auth-middleware'
import AdmZip from 'adm-zip'

export default ({ strapi }: { strapi: Core.Strapi }) => {
	/**
	 * Извлекает XML из body (может быть ZIP архив или обычный XML)
	 * @param ctx - Koa context
	 * @returns XML строка
	 */
	function extractXMLFromBody(ctx: any): string {
		// Детальное логирование для отладки
		strapi.log.info('[CommerceML Controller] Extracting XML from body', {
			bodyType: typeof ctx.request.body,
			bodyIsBuffer: Buffer.isBuffer(ctx.request.body),
			bodyLength: ctx.request.body ? (Buffer.isBuffer(ctx.request.body) ? ctx.request.body.length : String(ctx.request.body).length) : 0,
			contentType: ctx.request.headers['content-type'],
			contentLength: ctx.request.headers['content-length'],
			hasRawBody: !!(ctx.request as any).rawBody,
			rawBodyType: typeof (ctx.request as any).rawBody,
			rawBodyLength: (ctx.request as any).rawBody ? (Buffer.isBuffer((ctx.request as any).rawBody) ? (ctx.request as any).rawBody.length : String((ctx.request as any).rawBody).length) : 0,
		})

		// Получаем данные из body (может быть XML или ZIP архив)
		let bodyData: Buffer | string

		// Пробуем разные способы получения данных
		// 1. Raw body как Buffer (для ZIP)
		if (Buffer.isBuffer(ctx.request.body)) {
			strapi.log.info('[CommerceML Controller] Body is Buffer')
			bodyData = ctx.request.body
		}
		// 2. Raw body как string (для XML)
		else if (typeof ctx.request.body === 'string') {
			strapi.log.info('[CommerceML Controller] Body is string')
			bodyData = ctx.request.body
		}
		// 3. Из поля xml (для JSON запросов)
		else if (ctx.request.body?.xml && typeof ctx.request.body.xml === 'string') {
			strapi.log.info('[CommerceML Controller] Body has xml field')
			bodyData = ctx.request.body.xml
		}
		// 4. Из поля data
		else if (ctx.request.body?.data) {
			strapi.log.info('[CommerceML Controller] Body has data field')
			if (Buffer.isBuffer(ctx.request.body.data)) {
				bodyData = ctx.request.body.data
			} else if (typeof ctx.request.body.data === 'string') {
				bodyData = ctx.request.body.data
			} else {
				bodyData = String(ctx.request.body.data)
			}
		}
		// 5. Пробуем rawBody если доступен
		else if ((ctx.request as any).rawBody) {
			strapi.log.info('[CommerceML Controller] Using rawBody')
			if (Buffer.isBuffer((ctx.request as any).rawBody)) {
				bodyData = (ctx.request as any).rawBody
			} else {
				bodyData = String((ctx.request as any).rawBody)
			}
		}
		// 6. Если body это объект, пробуем преобразовать в строку
		else if (ctx.request.body && typeof ctx.request.body === 'object') {
			strapi.log.warn('[CommerceML Controller] Body is object, trying to stringify...', {
				bodyKeys: Object.keys(ctx.request.body),
				bodyStringified: JSON.stringify(ctx.request.body).substring(0, 200),
			})
			bodyData = JSON.stringify(ctx.request.body)
		}
		else {
			strapi.log.error('[CommerceML Controller] Cannot extract data from body', {
				bodyType: typeof ctx.request.body,
				bodyValue: ctx.request.body ? String(ctx.request.body).substring(0, 200) : 'null/undefined',
			})
			throw new Error('Cannot extract data from body')
		}

		if (!bodyData || (typeof bodyData === 'string' && bodyData.trim().length === 0)) {
			strapi.log.error('[CommerceML Controller] Body data is empty', {
				bodyDataType: typeof bodyData,
				bodyDataLength: bodyData ? (typeof bodyData === 'string' ? bodyData.length : bodyData.length) : 0,
			})
			throw new Error('Body data is empty')
		}

		strapi.log.info('[CommerceML Controller] Body data extracted', {
			type: typeof bodyData,
			isBuffer: Buffer.isBuffer(bodyData),
			length: Buffer.isBuffer(bodyData) ? bodyData.length : bodyData.length,
			firstBytes: Buffer.isBuffer(bodyData) 
				? Array.from(bodyData.slice(0, 10)).map((b: number) => '0x' + Number(b).toString(16)).join(' ')
				: bodyData.substring(0, 50),
		})

		// Проверяем, является ли это ZIP архивом
		const contentType = ctx.request.headers['content-type'] || ''
		const isZipContentType = contentType.includes('zip') || contentType.includes('application/octet-stream')
		
		// Проверяем по первым байтам (ZIP signature: PK\x03\x04)
		const isZipBuffer = Buffer.isBuffer(bodyData) && bodyData.length >= 4 && bodyData[0] === 0x50 && bodyData[1] === 0x4B
		const isZipString = typeof bodyData === 'string' && bodyData.length >= 4 && bodyData.charCodeAt(0) === 0x50 && bodyData.charCodeAt(1) === 0x4B

		strapi.log.info('[CommerceML Controller] ZIP detection', {
			isZipContentType,
			isZipBuffer,
			isZipString,
			contentType,
		})

		if (isZipContentType || isZipBuffer || isZipString) {
			strapi.log.info('[CommerceML Controller] Detected ZIP archive, extracting...')
			try {
				// Преобразуем в Buffer если нужно
				const zipBuffer = Buffer.isBuffer(bodyData) ? bodyData : Buffer.from(bodyData, 'binary')
			strapi.log.info('[CommerceML Controller] ZIP buffer created', {
				bufferLength: zipBuffer.length,
				firstBytes: Array.from(zipBuffer.slice(0, 10))
					.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' '),
				lastBytes: zipBuffer.length > 10 
					? Array.from(zipBuffer.slice(-10))
						.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' ')
					: 'N/A',
				hasZipSignature: zipBuffer.length >= 4 && zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4B,
			})
				
				const zip = new AdmZip(zipBuffer)
				const zipEntries = zip.getEntries()
				
				strapi.log.info('[CommerceML Controller] ZIP entries found', {
					count: zipEntries.length,
					entries: zipEntries.map(e => e.entryName),
				})

				// Ищем XML файл (catalog.xml, offers.xml, rests.xml или любой .xml)
				let xmlEntry = zipEntries.find((entry) => 
					entry.entryName.toLowerCase().endsWith('.xml') && 
					(entry.entryName.toLowerCase().includes('catalog') || 
					 entry.entryName.toLowerCase().includes('offers') ||
					 entry.entryName.toLowerCase().includes('rests') ||
					 entry.entryName.toLowerCase().includes('import'))
				)

				// Если не нашли, берем первый XML файл
				if (!xmlEntry) {
					xmlEntry = zipEntries.find((entry) => entry.entryName.toLowerCase().endsWith('.xml'))
				}

				if (!xmlEntry) {
					strapi.log.error('[CommerceML Controller] No XML file found in ZIP', {
						entries: zipEntries.map(e => e.entryName),
					})
					throw new Error('No XML file found in ZIP archive')
				}

				const xmlString = xmlEntry.getData().toString('utf8')
				strapi.log.info(`[CommerceML Controller] Extracted XML from ZIP: ${xmlEntry.entryName}, length: ${xmlString.length} bytes`)
				return xmlString
			} catch (error: any) {
				strapi.log.error('[CommerceML Controller] Failed to extract ZIP:', {
					message: error.message,
					stack: error.stack,
				})
				throw new Error(`Failed to extract ZIP: ${error.message}`)
			}
		} else {
			// Это обычный XML
			const xmlString = Buffer.isBuffer(bodyData) ? bodyData.toString('utf8') : String(bodyData)
			strapi.log.info(`[CommerceML Controller] XML received (not ZIP), length: ${xmlString.length} bytes`)
			return xmlString
		}
	}

	return {
	/**
	 * Обрабатывает catalog (GET с mode или POST с XML)
	 * GET /api/commerceml-sync/catalog?mode=checkauth
	 * POST /api/commerceml-sync/catalog
	 */
	async handleCatalog(ctx: any) {
		// Логируем ВСЕ запросы для отладки
		strapi.log.info('[CommerceML Controller] handleCatalog called', {
			method: ctx.request.method,
			path: ctx.request.path,
			query: ctx.query,
			contentType: ctx.request.headers['content-type'],
			contentLength: ctx.request.headers['content-length'],
			hasBody: !!ctx.request.body,
			bodyType: typeof ctx.request.body,
			hasRawBody: !!(ctx.request as any).rawBody,
		})

		const mode = ctx.query.mode || ctx.request.body?.mode || ctx.request.query?.mode

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

		// POST запрос с mode=file - отправка файла (Saby отправляет ZIP архив)
		if (ctx.request.method === 'POST' && mode === 'file') {
			strapi.log.info('[CommerceML Controller] POST with mode=file, treating as ZIP/XML upload')
			// Обрабатываем как обычный POST с XML (может быть ZIP)
			return this.processCatalog(ctx)
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
		// Логируем ВСЕ запросы для отладки
		strapi.log.info('[CommerceML Controller] handleOffers called', {
			method: ctx.request.method,
			path: ctx.request.path,
			query: ctx.query,
			contentType: ctx.request.headers['content-type'],
			contentLength: ctx.request.headers['content-length'],
			hasBody: !!ctx.request.body,
			bodyType: typeof ctx.request.body,
			hasRawBody: !!(ctx.request as any).rawBody,
		})

		const mode = ctx.query.mode || ctx.request.body?.mode || ctx.request.query?.mode

		if (ctx.request.method === 'GET' && mode === 'checkauth') {
			return this.handleCheckAuth(ctx, strapi)
		}
		if (ctx.request.method === 'GET' && mode === 'init') {
			return this.handleInit(ctx, strapi, 'offers')
		}
		if (ctx.request.method === 'GET' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'offers')
		}
		if (ctx.request.method === 'POST' && mode === 'file') {
			strapi.log.info('[CommerceML Controller] POST offers with mode=file, treating as XML upload')
			return this.processOffers(ctx)
		}

		return this.processOffers(ctx)
	},

	/**
	 * Обрабатывает rests (GET с mode или POST с XML)
	 * GET /api/commerceml-sync/rests?mode=checkauth
	 * POST /api/commerceml-sync/rests
	 */
	async handleRests(ctx: any) {
		// Логируем ВСЕ запросы для отладки
		strapi.log.info('[CommerceML Controller] handleRests called', {
			method: ctx.request.method,
			path: ctx.request.path,
			query: ctx.query,
			contentType: ctx.request.headers['content-type'],
			contentLength: ctx.request.headers['content-length'],
			hasBody: !!ctx.request.body,
			bodyType: typeof ctx.request.body,
			hasRawBody: !!(ctx.request as any).rawBody,
		})

		const mode = ctx.query.mode || ctx.request.body?.mode || ctx.request.query?.mode

		if (ctx.request.method === 'GET' && mode === 'checkauth') {
			return this.handleCheckAuth(ctx, strapi)
		}
		if (ctx.request.method === 'GET' && mode === 'init') {
			return this.handleInit(ctx, strapi, 'rests')
		}
		if (ctx.request.method === 'GET' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'rests')
		}
		if (ctx.request.method === 'POST' && mode === 'file') {
			strapi.log.info('[CommerceML Controller] POST rests with mode=file, treating as XML upload')
			return this.processRests(ctx)
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
		strapi.log.info(`[CommerceML] Init for ${type} successful, response: ${ctx.body}`)
		
		// Логируем ожидание POST запроса
		strapi.log.info(`[CommerceML] Waiting for POST request with ${type} data...`)
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
			strapi.log.info('[CommerceML Controller] POST catalog request received')
			strapi.log.debug('[CommerceML Controller] Request headers:', {
				'content-type': ctx.request.headers['content-type'],
				'content-length': ctx.request.headers['content-length'],
			})

			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = 'failure'
				ctx.type = 'text/plain'
				return
			}

			// Извлекаем XML из body (может быть ZIP или обычный XML)
			let xmlString: string
			try {
				xmlString = extractXMLFromBody(ctx)
			} catch (error: any) {
				strapi.log.error('[CommerceML Controller] Failed to extract XML:', {
					message: error.message,
					stack: error.stack,
					errorType: error.constructor.name,
				})
				ctx.status = 400
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				strapi.log.warn('[CommerceML Controller] XML string is empty after processing')
				ctx.status = 400
				ctx.body = 'failure\nInvalid request: XML string is empty'
				ctx.type = 'text/plain'
				return
			}

			// Обрабатываем catalog
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processCatalog(xmlString)

			// CommerceML протокол требует plain text ответ "success" после получения файла
			// Не JSON!
			ctx.status = 200
			ctx.body = 'success'
			ctx.type = 'text/plain'
			
			// Логируем результат для отладки
			strapi.log.info(
				`[CommerceML Controller] Catalog processed: ${result.stats?.saved || 0} saved, ${result.stats?.updated || 0} updated, ${result.stats?.errors || 0} errors`
			)
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Catalog processing failed:', error.message)
			strapi.log.error('[CommerceML Controller] Error stack:', error.stack)
			ctx.status = 500
			ctx.body = `failure\n${error.message || 'Failed to process catalog'}`
			ctx.type = 'text/plain'
		}
	},

	/**
	 * Обрабатывает offers.xml (цены)
	 * POST /api/commerceml-sync/offers
	 */
	async processOffers(ctx: any) {
		try {
			strapi.log.info('[CommerceML Controller] POST offers request received')

			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = 'failure'
				ctx.type = 'text/plain'
				return
			}

			// Извлекаем XML из body (может быть ZIP или обычный XML)
			let xmlString: string
			try {
				xmlString = extractXMLFromBody(ctx)
			} catch (error: any) {
				strapi.log.error('[CommerceML Controller] Failed to extract XML:', {
					message: error.message,
					stack: error.stack,
					errorType: error.constructor.name,
				})
				ctx.status = 400
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				ctx.status = 400
				ctx.body = 'failure\nInvalid request: XML string is empty'
				ctx.type = 'text/plain'
				return
			}

			// Обрабатываем offers
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processOffers(xmlString)

			// CommerceML протокол требует plain text ответ "success" после получения файла
			ctx.status = 200
			ctx.body = 'success'
			ctx.type = 'text/plain'
			
			// Логируем результат для отладки
			strapi.log.info(
				`[CommerceML Controller] Offers processed: ${result.stats?.updated || 0} prices updated, ${result.stats?.errors || 0} errors`
			)
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Offers processing failed:', error.message)
			ctx.status = 500
			ctx.body = `failure\n${error.message || 'Failed to process offers'}`
			ctx.type = 'text/plain'
		}
	},

	/**
	 * Обрабатывает rests.xml (остатки)
	 * POST /api/commerceml-sync/rests
	 */
	async processRests(ctx: any) {
		try {
			strapi.log.info('[CommerceML Controller] POST rests request received')

			// Проверка Basic Auth
			if (!verifyBasicAuth(ctx, strapi)) {
				ctx.status = 401
				ctx.body = 'failure'
				ctx.type = 'text/plain'
				return
			}

			// Извлекаем XML из body (может быть ZIP или обычный XML)
			let xmlString: string
			try {
				xmlString = extractXMLFromBody(ctx)
			} catch (error: any) {
				strapi.log.error('[CommerceML Controller] Failed to extract XML:', {
					message: error.message,
					stack: error.stack,
					errorType: error.constructor.name,
				})
				ctx.status = 400
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				ctx.status = 400
				ctx.body = 'failure\nInvalid request: XML string is empty'
				ctx.type = 'text/plain'
				return
			}

			strapi.log.info(`[CommerceML Controller] Rests XML received, length: ${xmlString.length} bytes`)

			// Обрабатываем rests
			const result = await strapi
				.service('api::commerceml-sync.commerceml-sync')
				.processRests(xmlString)

			// CommerceML протокол требует plain text ответ "success" после получения файла
			ctx.status = 200
			ctx.body = 'success'
			ctx.type = 'text/plain'
			
			// Логируем результат для отладки
			strapi.log.info(
				`[CommerceML Controller] Rests processed: ${result.stats?.updated || 0} updated, ${result.stats?.errors || 0} errors`
			)
		} catch (error: any) {
			strapi.log.error('[CommerceML Controller] Rests processing failed:', error.message)
			ctx.status = 500
			ctx.body = `failure\n${error.message || 'Failed to process rests'}`
			ctx.type = 'text/plain'
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
	}
}
