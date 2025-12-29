export default ({ env }) => {
	const isDevelopment = env('NODE_ENV') === 'development'

	return {
		host: env('HOST', '0.0.0.0'),
		port: env.int('PORT', 1337),
		app: {
			keys: env.array('APP_KEYS'),
		},
		webhooks: {
			populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
		},
		// proxy: true для production (за reverse proxy), false для development
		proxy: !isDevelopment,
		url: env(
			'PUBLIC_URL',
			isDevelopment ? 'http://localhost:1337' : 'https://api.borkssport.ru'
		),
		allowedHosts: isDevelopment
			? [
					'localhost',
					'127.0.0.1',
					'api.borkssport.ru',
					'borkssport.ru',
					'www.borkssport.ru',
				]
			: ['api.borkssport.ru', 'borkssport.ru', 'www.borkssport.ru'],
	}
}
