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
	],
}

