/**
 * CommerceML Sync Routes
 * Роуты для приема XML данных от Saby (СБИС)
 */

export default {
	routes: [
		// GET и POST для catalog (CommerceML протокол)
		{
			method: 'GET',
			path: '/commerceml-sync/catalog',
			handler: 'commerceml-sync.handleCatalog',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/catalog',
			handler: 'commerceml-sync.handleCatalog',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		// GET и POST для offers
		{
			method: 'GET',
			path: '/commerceml-sync/offers',
			handler: 'commerceml-sync.handleOffers',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/offers',
			handler: 'commerceml-sync.handleOffers',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		// GET и POST для rests
		{
			method: 'GET',
			path: '/commerceml-sync/rests',
			handler: 'commerceml-sync.handleRests',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/commerceml-sync/rests',
			handler: 'commerceml-sync.handleRests',
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
