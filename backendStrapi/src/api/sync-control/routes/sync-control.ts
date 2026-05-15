export default {
	routes: [
		{
			method: 'POST',
			path: '/sync-control/sbis/run',
			handler: 'sync-control.runSbisSync',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/sync-control/sbis/orders/:id/retry',
			handler: 'sync-control.retrySbisOrderSync',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/sync-control/sbis/orders/:id/register-payment',
			handler: 'sync-control.registerSbisOrderPayment',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
