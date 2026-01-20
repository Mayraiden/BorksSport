export default {
	routes: [
		{
			method: 'POST',
			path: '/maintenance/clear/:uid',
			handler: 'maintenance.clearByUid',
			config: {
				// Отключаем стандартную проверку auth, проверяем вручную в контроллере
				// Это позволяет использовать JWT токен из Authorization header
				auth: false,
				policies: [],
				middlewares: [],
			},
		},
	],
}
