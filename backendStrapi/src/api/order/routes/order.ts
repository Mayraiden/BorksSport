import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/orders',
			handler: 'order.find',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/orders',
			handler: 'order.create',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/orders/:id',
			handler: 'order.findOne',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
