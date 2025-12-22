export default ({ env }) => {
	// Определяем, должен ли cookie быть secure
	// Если PUBLIC_URL начинается с https, используем secure cookies
	const publicUrl = env('PUBLIC_URL', 'https://api.borkssport.ru')
	const isHttps = publicUrl.startsWith('https://')

	// Используем переменную окружения, но если не установлена, определяем по URL
	const cookieSecure = env.bool('ADMIN_COOKIE_SECURE', isHttps)

	return {
		auth: {
			secret: env('ADMIN_JWT_SECRET'),
			// Настройка cookies для работы за reverse proxy
			sessions: {
				cookie: {
					secure: cookieSecure,
					sameSite: 'lax',
					httpOnly: true, // Добавляем для безопасности
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
			nps: env.bool('FLAG_NPS', true),
			promoteEE: env.bool('FLAG_PROMOTE_EE', true),
		},
		// Настройки для работы за reverse proxy с HTTPS
		url: publicUrl,
		serveAdminPanel: env.bool('SERVE_ADMIN', true),
		// Явно указываем путь к админ-панели для избежания проблем с pathname
		path: '/admin',
	}
}
