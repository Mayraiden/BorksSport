export default (config: any, { strapi }: any) => {
	return async (ctx: any, next: any) => {
		console.log('--- DEBUG PROTOCOL ---')
		console.log('protocol:', ctx.request.protocol)
		console.log('secure:', ctx.request.secure)
		console.log('x-forwarded-proto:', ctx.request.headers['x-forwarded-proto'])
		console.log('host:', ctx.request.headers['host'])
		console.log('x-forwarded-host:', ctx.request.headers['x-forwarded-host'])
		console.log('----------------------')
		await next()
	}
}

