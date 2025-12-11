import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/addresses',
			handler: 'address.find',
			config: {
				auth: {
					scope: ['authenticated'],
				},
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/addresses',
			handler: 'address.create',
			config: {
				auth: {
					scope: ['authenticated'],
				},
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'PUT',
			path: '/addresses/:id',
			handler: 'address.update',
			config: {
				auth: {
					scope: ['authenticated'],
				},
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'DELETE',
			path: '/addresses/:id',
			handler: 'address.delete',
			config: {
				auth: {
					scope: ['authenticated'],
				},
				policies: [],
				middlewares: [],
			},
		},
	],
}
