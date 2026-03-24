export default {
	routes: [
		{
			method: 'GET',
			path: '/homepage-settings/public',
			handler: 'homepage-settings.findPublic',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
