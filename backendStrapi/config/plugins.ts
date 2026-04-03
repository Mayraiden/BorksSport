const isEmailAuthDisabled = (env: (key: string, defaultValue?: string) => string | undefined) => {
	const raw = env('EMAIL_AUTH_DISABLED')
	return raw === '1' || raw === 'true' || raw === 'yes'
}

export default ({ env }) => {
	const usersPermissions = {
		'users-permissions': {
			config: {
				jwtSecret: env('JWT_SECRET'),
				jwtExpiration: '1h', // Access token живет 1 час
				register: {
					allowedFields: ['firstName', 'phone'],
				},
			},
		},
	}

	// При EMAIL_AUTH_DISABLED плагин email не грузим — иначе Mailgun-провайдер падает без API key при старте.
	if (isEmailAuthDisabled(env)) {
		return {
			...usersPermissions,
			email: {
				enabled: false,
			},
		}
	}

	return {
		...usersPermissions,
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
