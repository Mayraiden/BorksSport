export default {
	routes: [
		{
			method: 'GET',
			path: '/management/orders',
			handler: 'management.orders',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/management/orders/:id',
			handler: 'management.orderById',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}

