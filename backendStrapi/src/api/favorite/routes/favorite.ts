import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/favorites',
			handler: 'favorite.find',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/favorites',
			handler: 'favorite.create',
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
			path: '/favorites/:id',
			handler: 'favorite.delete',
			config: {
				auth: {
					scope: ['authenticated'],
				},
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/favorites/check/:productId',
			handler: 'favorite.checkByProductId',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/favorites/toggle',
			handler: 'favorite.toggle',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
