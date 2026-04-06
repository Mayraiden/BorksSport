export default {
	routes: [
		{
			method: 'GET',
			path: '/footer-settings/public',
			handler: 'footer-settings.findPublic',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
