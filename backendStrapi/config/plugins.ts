export default ({ env }) => {
	return {
		'users-permissions': {
			config: {
				jwtSecret: env('JWT_SECRET'),
				jwtExpiration: '1h', // Access token живет 1 час
				register: {
					allowedFields: ['firstName', 'phone'],
				},
			},
		},
		email: {
			config: {
				provider: 'mailgun',
				providerOptions: {
					key: env('MAILGUN_API_KEY'),
					domain: env('MAILGUN_DOMAIN'),
					url: env('MAILGUN_URL', 'https://api.mailgun.net'),
				},
				settings: {
					defaultFrom: env('MAILGUN_DEFAULT_FROM'),
					defaultReplyTo: env('MAILGUN_DEFAULT_REPLY_TO'),
				},
				ratelimit: {
					enabled: env.bool('EMAIL_RATELIMIT_ENABLED', true),
					interval: env.int('EMAIL_RATELIMIT_INTERVAL_MINUTES', 5),
					max: env.int('EMAIL_RATELIMIT_MAX', 5),
					delayAfter: env.int('EMAIL_RATELIMIT_DELAY_AFTER', 1),
					timeWait: env.int('EMAIL_RATELIMIT_TIME_WAIT_MS', 3000),
				},
			},
		},
	}
}
