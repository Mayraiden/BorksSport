import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/cart-items',
			handler: 'cart-item.find',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/cart-items',
			handler: 'cart-item.create',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'PUT',
			path: '/cart-items/:id',
			handler: 'cart-item.update',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'DELETE',
			path: '/cart-items/:id',
			handler: 'cart-item.delete',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'DELETE',
			path: '/cart-items',
			handler: 'cart-item.deleteMany',
			config: {
				// auth: false для отладки, контроллер сам проверяет токен
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
