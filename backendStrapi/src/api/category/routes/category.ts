import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/categories',
			handler: 'category.find',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/categories/main',
			handler: 'category.findMain',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/categories/by-level/:level',
			handler: 'category.findByLevel',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/categories/:id',
			handler: 'category.findOne',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'DELETE',
			path: '/categories/clear-all',
			handler: 'category.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/categories/clear-all',
			handler: 'category.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/categories/clear-all-now',
			handler: 'category.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
