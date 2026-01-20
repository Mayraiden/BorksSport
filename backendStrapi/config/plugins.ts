export default ({ env }) => {
	const isDevelopment = env('NODE_ENV') === 'development'
	
	return {
		'users-permissions': {
			config: {
				jwtSecret: env('JWT_SECRET') || env('ADMIN_JWT_SECRET'),
				jwtExpiration: '1h', // Access token живет 1 час
				register: {
					allowedFields: ['firstName', 'phone'],
				},
			},
		},
		// Email плагин явно отключен, чтобы предотвратить попытки отправки через SMTP
		// Strapi может загружать email плагин автоматически, поэтому нужно явно отключить его
		email: {
			enabled: false, // Явно отключаем email плагин
		},
	}
}
