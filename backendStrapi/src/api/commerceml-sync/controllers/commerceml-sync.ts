/**
 * CommerceML Sync Controller
 * Обрабатывает HTTP запросы от Saby (СБИС) с XML данными
 */

import type { Core } from '@strapi/strapi'
import { randomUUID } from 'crypto'
import { verifyBasicAuth } from '../utils/auth-middleware'
import AdmZip from 'adm-zip'
import * as fs from 'fs'
import * as path from 'path'

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
				const firstBytes = Array.from(zipBuffer.slice(0, 10))
					.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' ')
				const lastBytes = zipBuffer.length > 10 
					? Array.from(zipBuffer.slice(-10))
						.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' ')
					: 'N/A'
				
				strapi.log.info(`[CommerceML Controller] ZIP buffer created: ${zipBuffer.length} bytes`)
				strapi.log.info(`[CommerceML Controller] First bytes: ${firstBytes}`)
				strapi.log.info(`[CommerceML Controller] Last bytes: ${lastBytes}`)
				strapi.log.info(`[CommerceML Controller] ZIP signature: ${zipBuffer.length >= 4 && zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4B ? 'YES' : 'NO'}`)
				
				// Проверяем, что ZIP файл полный (должен заканчиваться на END header)
				if (zipBuffer.length < 22) {
					throw new Error(`ZIP buffer too small: ${zipBuffer.length} bytes (minimum 22 bytes required)`)
				}
				
				// Проверяем END header в конце файла (должен быть 0x06054b50)
				// END header может быть в разных местах в зависимости от размера ZIP comment
				const endHeaderOffset = zipBuffer.length - 22
				const endHeader = zipBuffer.readUInt32LE(endHeaderOffset)
				const endHeaderBE = zipBuffer.readUInt32BE(endHeaderOffset)
				
				// Логируем последние 100 байтов для анализа
				const last100Bytes = Array.from(zipBuffer.slice(-100))
					.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' ')
				strapi.log.info(`[CommerceML Controller] Last 100 bytes: ${last100Bytes}`)
				
				if (endHeader !== 0x06054b50 && endHeaderBE !== 0x06054b50) {
					strapi.log.warn(`[CommerceML Controller] ZIP END header not found at expected position. Found LE: 0x${endHeader.toString(16)}, BE: 0x${endHeaderBE.toString(16)} at offset ${endHeaderOffset}`)
					
					// Попробуем найти END header в последних 65557 байтах (максимальный размер ZIP comment)
					// Но также проверим, может быть файл обрезан и END header находится раньше
					let foundEndHeader = false
					let foundOffset = -1
					
					// Ищем с конца файла (более эффективно)
					// Проверяем последние 65557 байтов, но также проверяем весь файл на случай обрезанного архива
					const searchStart = Math.max(0, zipBuffer.length - 65557)
					const searchEnd = zipBuffer.length - 22
					
					strapi.log.info(`[CommerceML Controller] Searching for END header from offset ${searchStart} to ${searchEnd}`)
					
					// Сначала ищем с конца (стандартное место)
					for (let i = searchEnd; i >= searchStart; i--) {
						const headerLE = zipBuffer.readUInt32LE(i)
						const headerBE = zipBuffer.readUInt32BE(i)
						if (headerLE === 0x06054b50 || headerBE === 0x06054b50) {
							strapi.log.info(`[CommerceML Controller] Found END header at offset ${i} (${headerLE === 0x06054b50 ? 'LE' : 'BE'})`)
							foundEndHeader = true
							foundOffset = i
							break
						}
					}
					
					// Если не нашли, попробуем найти в любом месте файла (может быть файл обрезан)
					if (!foundEndHeader) {
						strapi.log.warn(`[CommerceML Controller] END header not found in standard location, searching entire file...`)
						// Ищем с конца файла до начала (но не дальше чем 1MB от конца для производительности)
						const wideSearchStart = Math.max(0, zipBuffer.length - 1048576) // 1MB от конца
						for (let i = zipBuffer.length - 22; i >= wideSearchStart; i--) {
							const headerLE = zipBuffer.readUInt32LE(i)
							const headerBE = zipBuffer.readUInt32BE(i)
							if (headerLE === 0x06054b50 || headerBE === 0x06054b50) {
								strapi.log.info(`[CommerceML Controller] Found END header at offset ${i} (${headerLE === 0x06054b50 ? 'LE' : 'BE'}) in wide search`)
								foundEndHeader = true
								foundOffset = i
								break
							}
						}
					}
					
					if (!foundEndHeader) {
						strapi.log.error(`[CommerceML Controller] END header not found anywhere in file. File may be corrupted or incomplete.`)
						strapi.log.error(`[CommerceML Controller] File size: ${zipBuffer.length} bytes, suspiciously exactly 5MB+1 byte`)
						
						// Попробуем найти центральный directory header (0x02014b50) - может быть файл обрезан после него
						let foundCentralDir = false
						for (let i = zipBuffer.length - 1000; i >= Math.max(0, zipBuffer.length - 100000); i--) {
							const headerLE = zipBuffer.readUInt32LE(i)
							if (headerLE === 0x02014b50) {
								strapi.log.warn(`[CommerceML Controller] Found Central Directory header at offset ${i}, but no END header. File may be truncated.`)
								foundCentralDir = true
								break
							}
						}
						
						if (!foundCentralDir) {
							strapi.log.error(`[CommerceML Controller] No Central Directory header found either. File structure is severely corrupted.`)
						}
						
						// Все равно попробуем распарсить - может быть adm-zip сможет что-то сделать
						strapi.log.warn(`[CommerceML Controller] Attempting to parse ZIP anyway despite missing END header...`)
					}
				} else {
					strapi.log.info(`[CommerceML Controller] ZIP END header found at expected position`)
				}
				
				// Пробуем распарсить ZIP (даже если END header не найден в ожидаемом месте)
				let zip: any
				try {
					zip = new AdmZip(zipBuffer)
				} catch (zipError: any) {
					// Если adm-zip не может распарсить, попробуем альтернативный подход
					strapi.log.error(`[CommerceML Controller] adm-zip failed: ${zipError.message}`)
					
					// Попробуем найти XML напрямую в буфере (может быть это не ZIP, а просто XML с ZIP signature)
					// Или попробуем найти XML файл по паттерну
					const xmlStartPattern = Buffer.from('<?xml', 'utf-8')
					const xmlStartIndex = zipBuffer.indexOf(xmlStartPattern)
					
					if (xmlStartIndex !== -1) {
						strapi.log.info(`[CommerceML Controller] Found XML start pattern at offset ${xmlStartIndex}, trying to extract XML directly`)
						// Попробуем извлечь XML напрямую
						const xmlBuffer = zipBuffer.slice(xmlStartIndex)
						const xmlString = xmlBuffer.toString('utf-8')
						if (xmlString.includes('<?xml') && xmlString.includes('</')) {
							strapi.log.info(`[CommerceML Controller] Successfully extracted XML directly from buffer`)
							return xmlString
						}
					}
					
					throw new Error(`Failed to parse ZIP: ${zipError.message}. File may be corrupted or incomplete.`)
				}
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

		// POST запрос с mode=file - сохранение чанка файла
		if (ctx.request.method === 'POST' && mode === 'file') {
			return this.handleFile(ctx, strapi, 'catalog')
		}

		// GET запрос с mode=success или mode=import - файл полностью загружен, можно обрабатывать
		if (ctx.request.method === 'GET' && (mode === 'success' || mode === 'import')) {
			return this.handleSuccess(ctx, strapi, 'catalog')
		}

		// POST запрос без mode - обработка XML напрямую (legacy или тестирование)
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
			return this.handleFile(ctx, strapi, 'offers')
		}

		if (ctx.request.method === 'GET' && (mode === 'success' || mode === 'import')) {
			return this.handleSuccess(ctx, strapi, 'offers')
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
			return this.handleFile(ctx, strapi, 'rests')
		}

		if (ctx.request.method === 'GET' && (mode === 'success' || mode === 'import')) {
			return this.handleSuccess(ctx, strapi, 'rests')
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
		// zip - поддержка zip (yes/no) - ВАЖНО: если Saby шлёт ZIP, нужно yes!
		// file_limit - максимальный размер файла в байтах (50MB)
		// step_time - задержка между запросами в секундах
		ctx.status = 200
		ctx.body = '2.08;yes;52428800;0' // zip=yes, т.к. Saby шлёт ZIP архивы
		ctx.type = 'text/plain'
		strapi.log.info(`[CommerceML] Init for ${type} successful, response: ${ctx.body}`)
		
		// Логируем ожидание POST запроса
		strapi.log.info(`[CommerceML] Waiting for POST request with ${type} data...`)
	},

	/**
	 * Обрабатывает mode=file - получение файла (POST - сохранение чанка)
	 * CommerceML протокол: Saby шлёт файл чанками, нужно сохранять на диск
	 */
	async handleFile(ctx: any, strapi: Core.Strapi, type: string) {
		const hasBasicAuth = verifyBasicAuth(ctx, strapi)
		const hasSessionCookie = !!ctx.cookies.get('commerceml_session')

		if (!hasBasicAuth && !hasSessionCookie) {
			ctx.status = 200
			ctx.body = 'failure\nUnauthorized'
			ctx.type = 'text/plain'
			return
		}

		const filename = ctx.query.filename || ctx.query.file

		// GET запрос - Saby запрашивает файл (мы не отдаём файлы)
		if (ctx.request.method === 'GET') {
			if (!filename) {
				ctx.status = 200
				ctx.body = 'failure\nФайл не указан'
				ctx.type = 'text/plain'
				return
			}
			ctx.status = 200
			ctx.body = 'failure\nФайл не найден'
			ctx.type = 'text/plain'
			strapi.log.info(`[CommerceML] File request for ${type}: ${filename}`)
			return
		}

		// POST запрос - Saby отправляет чанк файла
		if (ctx.request.method === 'POST') {
			if (!filename) {
				ctx.status = 200
				ctx.body = 'failure\nФайл не указан'
				ctx.type = 'text/plain'
				return
			}

			// Получаем данные из body
			let chunkData: Buffer
			if (Buffer.isBuffer(ctx.request.body)) {
				chunkData = ctx.request.body
			} else if ((ctx.request as any).rawBody && Buffer.isBuffer((ctx.request as any).rawBody)) {
				chunkData = (ctx.request as any).rawBody
			} else {
				ctx.status = 200
				ctx.body = 'failure\nInvalid body format'
				ctx.type = 'text/plain'
				return
			}

			// Создаём директорию для временных файлов CommerceML
			const tempDir = path.join(process.cwd(), 'data', 'commerceml')
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true })
			}

			// Путь к файлу
			const filePath = path.join(tempDir, filename)

			// Сохраняем чанк (append mode)
			try {
				fs.appendFileSync(filePath, chunkData)
				const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null
				
				strapi.log.info(`[CommerceML] Chunk saved for ${type}: ${filename}, chunk size: ${chunkData.length} bytes, total size: ${fileStats?.size || 0} bytes`)
				
				// CommerceML протокол требует plain text "success" после получения чанка
				ctx.status = 200
				ctx.body = 'success'
				ctx.type = 'text/plain'
			} catch (error: any) {
				strapi.log.error(`[CommerceML] Failed to save chunk for ${type}: ${filename}`, {
					message: error.message,
					stack: error.stack,
				})
				ctx.status = 200
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
			}
			return
		}

		// Fallback
		ctx.status = 200
		ctx.body = 'failure\nInvalid request'
		ctx.type = 'text/plain'
	},

	/**
	 * Обрабатывает mode=success - файл полностью загружен, можно обрабатывать
	 * GET /api/commerceml-sync/{type}?mode=success&filename=import0_1.zip
	 */
	async handleSuccess(ctx: any, strapi: Core.Strapi, type: string) {
		const hasBasicAuth = verifyBasicAuth(ctx, strapi)
		const hasSessionCookie = !!ctx.cookies.get('commerceml_session')

		if (!hasBasicAuth && !hasSessionCookie) {
			ctx.status = 200
			ctx.body = 'failure\nUnauthorized'
			ctx.type = 'text/plain'
			return
		}

		const filename = ctx.query.filename || ctx.query.file

		if (!filename) {
			ctx.status = 200
			ctx.body = 'failure\nФайл не указан'
			ctx.type = 'text/plain'
			return
		}

		// Путь к сохранённому файлу
		// Saby может отправлять filename как .xml, но файл сохранён как .zip
		const tempDir = path.join(process.cwd(), 'data', 'commerceml')
		let filePath = path.join(tempDir, filename)
		
		// Если файл не найден и filename заканчивается на .xml, пробуем найти .zip версию
		if (!fs.existsSync(filePath) && filename.endsWith('.xml')) {
			const zipFilename = filename.replace(/\.xml$/, '.zip')
			const zipFilePath = path.join(tempDir, zipFilename)
			if (fs.existsSync(zipFilePath)) {
				strapi.log.info(`[CommerceML] File ${filename} not found, using ${zipFilename} instead`)
				filePath = zipFilePath
			}
		}

		if (!fs.existsSync(filePath)) {
			strapi.log.error(`[CommerceML] File not found: ${filePath}`)
			// Пробуем найти любой файл с похожим именем
			try {
				const files = fs.readdirSync(tempDir)
				const matchingFiles = files.filter(f => f.startsWith(filename.split('.')[0]))
				if (matchingFiles.length > 0) {
					strapi.log.info(`[CommerceML] Found similar files: ${matchingFiles.join(', ')}`)
					filePath = path.join(tempDir, matchingFiles[0])
					strapi.log.info(`[CommerceML] Using file: ${filePath}`)
				} else {
					ctx.status = 200
					ctx.body = 'failure\nФайл не найден'
					ctx.type = 'text/plain'
					return
				}
			} catch (dirError: any) {
				strapi.log.error(`[CommerceML] Failed to read temp directory: ${dirError.message}`)
				ctx.status = 200
				ctx.body = 'failure\nФайл не найден'
				ctx.type = 'text/plain'
				return
			}
		}

		const fileStats = fs.statSync(filePath)
		strapi.log.info(`[CommerceML] Processing complete file for ${type}: ${filename}, size: ${fileStats.size} bytes`)

		try {
			// Читаем файл
			const fileBuffer = fs.readFileSync(filePath)

			// Проверяем, что это ZIP (по первым байтам)
			if (fileBuffer.length < 4 || fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4B) {
				strapi.log.error(`[CommerceML] File is not a ZIP archive: ${filename}`)
				ctx.status = 200
				ctx.body = 'failure\nФайл не является ZIP архивом'
				ctx.type = 'text/plain'
				return
			}

			// Распаковываем ZIP
			const zip = new AdmZip(fileBuffer)
			const zipEntries = zip.getEntries()

			strapi.log.info(`[CommerceML] ZIP entries found: ${zipEntries.length}`, {
				entries: zipEntries.map(e => e.entryName),
			})

			// Ищем XML файл
			let xmlEntry = zipEntries.find((entry) => 
				entry.entryName.toLowerCase().endsWith('.xml') && 
				(entry.entryName.toLowerCase().includes('catalog') || 
				 entry.entryName.toLowerCase().includes('offers') ||
				 entry.entryName.toLowerCase().includes('rests') ||
				 entry.entryName.toLowerCase().includes('import'))
			)

			if (!xmlEntry) {
				xmlEntry = zipEntries.find((entry) => entry.entryName.toLowerCase().endsWith('.xml'))
			}

			if (!xmlEntry) {
				strapi.log.error(`[CommerceML] No XML file found in ZIP: ${filename}`)
				ctx.status = 200
				ctx.body = 'failure\nXML файл не найден в архиве'
				ctx.type = 'text/plain'
				return
			}

			// Извлекаем XML
			const xmlString = xmlEntry.getData().toString('utf8')
			strapi.log.info(`[CommerceML] Extracted XML from ZIP: ${xmlEntry.entryName}, length: ${xmlString.length} bytes`)

			// Определяем тип по имени файла, если не указан явно
			// Saby может отправлять offers на catalog эндпоинт
			let actualType = type
			const xmlFileName = xmlEntry.entryName.toLowerCase()
			const zipFileName = filename.toLowerCase()
			
			if (xmlFileName.includes('offers') || zipFileName.includes('offers')) {
				actualType = 'offers'
				strapi.log.info(`[CommerceML] Detected offers file by name: ${xmlFileName} / ${zipFileName}`)
			} else if (xmlFileName.includes('rests') || zipFileName.includes('rests')) {
				actualType = 'rests'
				strapi.log.info(`[CommerceML] Detected rests file by name: ${xmlFileName} / ${zipFileName}`)
			} else if (xmlFileName.includes('catalog') || zipFileName.includes('catalog') || zipFileName.includes('import')) {
				actualType = 'catalog'
				strapi.log.info(`[CommerceML] Detected catalog file by name: ${xmlFileName} / ${zipFileName}`)
			}

			// Обрабатываем XML в зависимости от типа
			let result
			if (actualType === 'catalog') {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processCatalog(xmlString)
			} else if (actualType === 'offers') {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processOffers(xmlString)
			} else if (actualType === 'rests') {
				result = await strapi
					.service('api::commerceml-sync.commerceml-sync')
					.processRests(xmlString)
			} else {
				ctx.status = 200
				ctx.body = 'failure\nНеизвестный тип'
				ctx.type = 'text/plain'
				return
			}

			// Удаляем временный файл после успешной обработки
			try {
				fs.unlinkSync(filePath)
				strapi.log.info(`[CommerceML] Temporary file deleted: ${filename}`)
			} catch (deleteError: any) {
				strapi.log.warn(`[CommerceML] Failed to delete temporary file: ${filename}`, {
					message: deleteError.message,
				})
			}

			// Возвращаем успех
			ctx.status = 200
			ctx.body = 'success'
			ctx.type = 'text/plain'
			strapi.log.info(`[CommerceML] Successfully processed ${type} from ${filename}`)
		} catch (error: any) {
			strapi.log.error(`[CommerceML] Failed to process ${type} from ${filename}:`, {
				message: error.message,
				stack: error.stack,
			})
			ctx.status = 200
			ctx.body = `failure\n${error.message || 'Ошибка обработки файла'}`
			ctx.type = 'text/plain'
		}
	},

	/**
	 * Обрабатывает catalog.xml (POST запрос напрямую - для legacy или тестирования)
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
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				strapi.log.warn('[CommerceML Controller] XML string is empty after processing')
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
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
			// CommerceML протокол требует 200 OK даже при ошибках обработки
			ctx.status = 200
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
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
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
			// CommerceML протокол требует 200 OK даже при ошибках обработки
			ctx.status = 200
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
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
				ctx.body = `failure\n${error.message}`
				ctx.type = 'text/plain'
				return
			}

			if (!xmlString || xmlString.trim().length === 0) {
				// CommerceML протокол требует 200 OK даже при ошибках
				ctx.status = 200
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
			// CommerceML протокол требует 200 OK даже при ошибках обработки
			ctx.status = 200
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
