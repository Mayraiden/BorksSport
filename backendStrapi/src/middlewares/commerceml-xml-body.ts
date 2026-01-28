/**
 * CommerceML XML Body Parser Middleware
 * Обрабатывает raw XML body для CommerceML запросов
 * 
 * Этот middleware должен быть ДО strapi::body в config/middlewares.ts
 * Он логирует все CommerceML запросы для отладки
 */

export default (config: any, { strapi }: any) => {
	return async (ctx: any, next: any) => {
		// Проверяем, является ли запрос CommerceML запросом
		const isCommerceMLRequest = ctx.request.path?.includes('/commerceml-sync/')

		if (isCommerceMLRequest) {
			// Логируем все CommerceML запросы для отладки
			strapi.log.info('[CommerceML Middleware] Request intercepted', {
				method: ctx.request.method,
				path: ctx.request.path,
				url: ctx.request.url,
				query: ctx.query,
				contentType: ctx.request.headers['content-type'],
				contentLength: ctx.request.headers['content-length'],
				userAgent: ctx.request.headers['user-agent'],
				ip: ctx.request.ip,
				allHeaders: Object.keys(ctx.request.headers),
			})

			// Для POST/PUT запросов с ZIP или binary данными, сохраняем raw body ДО обработки body parser
			const contentType = ctx.request.headers['content-type'] || ''
			const isBinaryRequest = 
				(ctx.request.method === 'POST' || ctx.request.method === 'PUT') &&
				(contentType.includes('zip') || 
				 contentType.includes('application/octet-stream') ||
				 contentType.includes('binary') ||
				 ctx.request.url?.includes('mode=file'))

			if (isBinaryRequest) {
				// Сохраняем raw body до обработки body parser
				// Используем Koa's raw body stream
				return new Promise((resolve, reject) => {
					const chunks: Buffer[] = []
					
					ctx.req.on('data', (chunk: Buffer) => {
						chunks.push(chunk)
					})
					
					ctx.req.on('end', async () => {
						const rawBody = Buffer.concat(chunks)
						;(ctx.request as any).rawBody = rawBody
						
						strapi.log.info('[CommerceML Middleware] Raw body saved', {
							length: rawBody.length,
							expectedLength: ctx.request.headers['content-length'],
							firstBytes: Array.from(rawBody.slice(0, 10))
								.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' '),
							lastBytes: rawBody.length > 10 
								? Array.from(rawBody.slice(-10))
									.map((b: number) => '0x' + Number(b).toString(16).padStart(2, '0')).join(' ')
								: 'N/A',
							isZipSignature: rawBody.length >= 4 && rawBody[0] === 0x50 && rawBody[1] === 0x4B,
						})
						
						// Устанавливаем body напрямую, чтобы body parser не пытался читать stream
						ctx.request.body = rawBody
						
						try {
							await next()
							resolve(undefined)
						} catch (err) {
							reject(err)
						}
					})
					
					ctx.req.on('error', (err: Error) => {
						reject(err)
					})
				})
			}

			// Для POST/PUT запросов с XML, устанавливаем правильный Content-Type
			// чтобы стандартный body parser обработал его как текст
			// НО НЕ меняем Content-Type для ZIP файлов!
			if (
				(ctx.request.method === 'POST' || ctx.request.method === 'PUT') &&
				!contentType.includes('application/json') &&
				!contentType.includes('application/x-www-form-urlencoded') &&
				!contentType.includes('zip') &&
				!contentType.includes('application/octet-stream')
			) {
				// Если Content-Type не указан или это XML, устанавливаем text/plain
				// чтобы body parser обработал как raw text
				if (!contentType || contentType.includes('xml')) {
					ctx.request.headers['content-type'] = 'text/plain; charset=utf-8'
					strapi.log.debug('[CommerceML Middleware] Set content-type to text/plain for XML parsing')
				}
			}
		}

		await next()
	}
}
