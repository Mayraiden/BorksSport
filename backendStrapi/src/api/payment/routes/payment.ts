import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/payments',
			handler: 'payment.find',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/payments',
			handler: 'payment.create',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'PUT',
			path: '/payments/:id',
			handler: 'payment.update',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/payments/tochka/session',
			handler: 'payment.createTochkaSession',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/payments/tochka/:id/status',
			handler: 'payment.getTochkaStatus',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/payments/tochka/webhook',
			handler: 'payment.tochkaWebhook',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
