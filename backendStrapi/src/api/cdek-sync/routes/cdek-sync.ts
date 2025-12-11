export default {
	routes: [
		{
			method: 'GET',
			path: '/cdek-sync/test-auth',
			handler: 'cdek-sync.testAuth',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/cdek-sync/cities',
			handler: 'cdek-sync.searchCities',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/cdek-sync/pvz-list',
			handler: 'cdek-sync.getPvzList',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/cdek-sync/calculate',
			handler: 'cdek-sync.calculate',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/cdek-sync/create-order',
			handler: 'cdek-sync.createOrder',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/cdek-sync/track/:trackNumber',
			handler: 'cdek-sync.track',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/cdek-sync/webhook',
			handler: 'cdek-sync.webhook',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}

