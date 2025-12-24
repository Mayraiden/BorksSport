export default (config: any, { strapi }: any) => {
	return async (ctx: any, next: any) => {
		// Исправляем протокол на основе X-Forwarded-Proto для работы за reverse proxy
		const forwardedProto = ctx.request.headers['x-forwarded-proto']
		if (forwardedProto === 'https') {
			ctx.request.protocol = 'https'
			ctx.request.secure = true
			// Также устанавливаем для app.proxy
			ctx.app.proxy = true
		}
		
		console.log('--- DEBUG PROTOCOL ---')
		console.log('protocol:', ctx.request.protocol)
		console.log('secure:', ctx.request.secure)
		console.log('x-forwarded-proto:', forwardedProto)
		console.log('host:', ctx.request.headers['host'])
		console.log('x-forwarded-host:', ctx.request.headers['x-forwarded-host'])
		console.log('----------------------')
		
		await next()
	}
}

