export default {
	routes: [
		{
			method: 'GET',
			path: '/brands/home',
			handler: 'brand.findHome',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
