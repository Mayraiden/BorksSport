/**
 * CommerceML Sync Routes
 * Роуты для приема XML данных от Saby (СБИС)
 */

export default {
	routes: [
		{
			method: 'POST',
			path: '/commerceml-sync/catalog',
			handler: 'commerceml-sync.processCatalog',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/offers',
			handler: 'commerceml-sync.processOffers',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/rests',
			handler: 'commerceml-sync.processRests',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/commerceml-sync/test',
			handler: 'commerceml-sync.test',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/upload',
			handler: 'commerceml-sync.upload',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
