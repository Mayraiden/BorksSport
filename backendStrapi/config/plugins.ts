export default ({ env }) => {
	const isDevelopment = env('NODE_ENV') === 'development'
	
	return {
		'users-permissions': {
			config: {
				jwtSecret: env('JWT_SECRET') || env('ADMIN_JWT_SECRET'),
				jwtExpiration: '15m', // Access token живет 15 минут
				register: {
					allowedFields: ['firstName', 'phone'],
				},
			},
		},
		email: {
			config: {
				provider: 'sendmail',
				providerOptions: {
					// Используем sendmail без SMTP сервера
					// Это предотвратит попытки подключения к внешним SMTP серверам
					path: '/usr/sbin/sendmail',
				},
				settings: {
					defaultFrom: env('EMAIL_FROM', 'noreply@borkssport.ru'),
					defaultReplyTo: env('EMAIL_REPLY_TO', 'noreply@borkssport.ru'),
				},
			},
		},
	}
}
