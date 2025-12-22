export default ({ env }) => ({
	host: env('HOST', '0.0.0.0'),
	port: env.int('PORT', 1337),
	app: {
		keys: env.array('APP_KEYS'),
	},
	webhooks: {
		populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
	},
	proxy: true, // ОБЯЗАТЕЛЬНО для работы за reverse proxy
	url: env('PUBLIC_URL', 'https://api.borkssport.ru'),
	allowedHosts: ['api.borkssport.ru', 'borkssport.ru', 'www.borkssport.ru'],
})
