export default ({ env }) => {
	const isDevelopment = env('NODE_ENV') === 'development'
	
	return {
		auth: {
			secret: env('ADMIN_JWT_SECRET'),
			sessions: {
				cookie: {
					// secure: true для HTTPS (production), false для localhost (development)
					secure: !isDevelopment,
					httpOnly: true,
					sameSite: 'lax',
				},
			},
		},
		apiToken: {
			salt: env('API_TOKEN_SALT'),
		},
		transfer: {
			token: {
				salt: env('TRANSFER_TOKEN_SALT'),
			},
		},
		secrets: {
			encryptionKey: env('ENCRYPTION_KEY'),
		},
		flags: {
			nps: env.bool('FLAG_NPS', false), // Отключаем NPS опросы
			promoteEE: env.bool('FLAG_PROMOTE_EE', false), // Отключаем рекламу Enterprise версии
		},
		// Отключаем телеметрию Strapi
		telemetry: {
			disabled: env.bool('STRAPI_TELEMETRY_DISABLED', true),
		},
		url: env(
			'PUBLIC_URL',
			isDevelopment ? 'http://localhost:1337' : 'https://api.borkssport.ru'
		),
		serveAdminPanel: env.bool('SERVE_ADMIN', true),
		path: '/admin',
	}
}
