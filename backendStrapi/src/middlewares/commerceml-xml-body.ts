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

			// Для POST/PUT запросов с XML, устанавливаем правильный Content-Type
			// чтобы стандартный body parser обработал его как текст
			// НО НЕ меняем Content-Type для ZIP файлов!
			const contentType = ctx.request.headers['content-type'] || ''
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
