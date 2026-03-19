/**
 * Product router
 */

import { factories } from '@strapi/strapi'

export default {
	routes: [
		{
			method: 'GET',
			path: '/products',
			handler: 'product.find',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		// Специфичные роуты должны быть ПЕРЕД параметризованными
		{
			method: 'GET',
			path: '/products/popular',
			handler: 'product.getPopular',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/new',
			handler: 'product.getNew',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/filter-options',
			handler: 'product.getFilterOptions',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/test-sbis-auth',
			handler: 'product.testSbisAuth',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/products/sync-from-sbis',
			handler: 'product.syncFromSbis',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/sync-from-sbis',
			handler: 'product.syncFromSbis',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'DELETE',
			path: '/products/clear-all',
			handler: 'product.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'POST',
			path: '/products/clear-all',
			handler: 'product.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/clear-all-now',
			handler: 'product.clearAll',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		// Параметризованный роут должен быть ПОСЛЕДНИМ
		{
			method: 'GET',
			path: '/products/image-proxy',
			handler: 'product.imageProxy',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'GET',
			path: '/products/:id',
			handler: 'product.findOne',
			config: {
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
