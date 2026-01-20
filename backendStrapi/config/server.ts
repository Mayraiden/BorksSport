export default ({ env }) => {
	const isDevelopment = env('NODE_ENV') === 'development'

	return {
		host: env('HOST', '0.0.0.0'),
		port: env.int('PORT', 1337),
		app: {
			keys: env.array('APP_KEYS'),
		},
		// Настройки для production (за reverse proxy)
		// В development не используем proxy, чтобы не было проблем с cookie и сессиями
		...(isDevelopment
			? {}
			: {
					proxy: true,
					url: env('PUBLIC_URL', 'https://api.borkssport.ru'),
					allowedHosts: ['api.borkssport.ru', 'borkssport.ru', 'www.borkssport.ru'],
				}),
	}
}
