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
		{
			method: 'GET',
			path: '/management/orders/:id/payments',
			handler: 'management.orderPayments',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/management/payments/:id/tochka-status-sync',
			handler: 'management.syncTochkaPaymentStatus',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}

