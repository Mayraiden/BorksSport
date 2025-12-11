export default {
	routes: [
		{
			method: 'POST',
			path: '/maintenance/clear/:uid',
			handler: 'maintenance.clearByUid',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
