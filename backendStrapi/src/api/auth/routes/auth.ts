export default {
	routes: [
		{
			method: 'POST',
			path: '/auth/refresh',
			handler: 'auth.refresh',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/auth/resend-confirmation',
			handler: 'auth.resendConfirmation',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/auth/confirm-email',
			handler: 'auth.confirmEmail',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}

