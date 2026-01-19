export default [
	// Middleware для диагностики протокола (временно)
	{
		name: 'global::debug-proto',
		config: {},
	},
	'strapi::logger',
	'strapi::errors',
	// Middleware для исправления пустых pathname (должен быть рано в цепочке)
	{
		name: 'global::pathname-fix',
		config: {},
	},
	'strapi::security',
	{
		name: 'strapi::cors',
		config: {
			// Если установлена переменная CORS_ORIGIN, она будет использоваться вместо дефолтных значений
			// Для доступа с телефона убедитесь, что CORS_ORIGIN включает http://192.168.0.18:3000
			origin: process.env.CORS_ORIGIN
				? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
				: process.env.NODE_ENV === 'development'
					? [
							'http://localhost:3000',
							'http://127.0.0.1:3000',
							'http://frontend:3000',
						]
					: [
							'http://borkssport.ru',
							'http://www.borkssport.ru',
							'https://borkssport.ru',
							'https://www.borkssport.ru',
							'http://api.borkssport.ru',
							'https://api.borkssport.ru',
						],
			headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
			credentials: true,
		},
	},
	'strapi::poweredBy',
	'strapi::query',
	'strapi::body',
	'strapi::session',
	'strapi::favicon',
	'strapi::public',
]
