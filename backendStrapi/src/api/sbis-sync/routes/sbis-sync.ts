export default {
	routes: [
		{
			method: 'POST',
			path: '/sbis-sync/sync-products',
			handler: 'sbis-sync.syncProducts',
			config: { 
				// Отключаем стандартную проверку auth, проверяем вручную в контроллере
				// Это позволяет использовать JWT токен из Authorization header
				auth: false,
				policies: [],
				middlewares: [] 
			},
		},
		{
			method: 'GET',
			path: '/sbis-sync/sync-products',
			handler: 'sbis-sync.syncProducts',
			config: { 
				// Отключаем стандартную проверку auth, проверяем вручную в контроллере
				// Это позволяет использовать JWT токен из Authorization header
				auth: false,
				policies: [],
				middlewares: [] 
			},
		},
		{
			method: 'GET',
			path: '/sbis-sync/fetch-products',
			handler: 'sbis-sync.fetchProducts',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/test-auth',
			handler: 'sbis-sync.testAuth',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/status',
			handler: 'sbis-sync.status',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/sample-products',
			handler: 'sbis-sync.getSampleProducts',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/test-sales',
			handler: 'sbis-sync.testSales',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'POST',
			path: '/sbis-sync/sync-sales-stats',
			handler: 'sbis-sync.syncSalesStats',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/sync-sales-stats',
			handler: 'sbis-sync.syncSalesStats',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'POST',
			path: '/sbis-sync/clear-all',
			handler: 'sbis-sync.clearAll',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/clear-all',
			handler: 'sbis-sync.clearAll',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/analyze-price-list',
			handler: 'sbis-sync.analyzePriceList',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'POST',
			path: '/sbis-sync/publish-all-products',
			handler: 'sbis-sync.publishAllProducts',
			config: { auth: false, policies: [], middlewares: [] },
		},
		{
			method: 'GET',
			path: '/sbis-sync/publish-all-products',
			handler: 'sbis-sync.publishAllProducts',
			config: { auth: false, policies: [], middlewares: [] },
		},
	],
}
