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
	],
}
