export default ({ env }) => ({
	auth: {
		secret: env('ADMIN_JWT_SECRET'),
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
		nps: env.bool('FLAG_NPS', true),
		promoteEE: env.bool('FLAG_PROMOTE_EE', true),
	},
	// Настройки для работы за reverse proxy с HTTPS
	url: env('PUBLIC_URL', 'https://api.borkssport.ru'),
	serveAdminPanel: env.bool('SERVE_ADMIN', true),
	// Явно отключаем secure cookies для работы за HTTP reverse proxy
	cookie: {
		secure: env.bool('ADMIN_COOKIE_SECURE', false),
	},
})
