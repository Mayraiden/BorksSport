export default {
	routes: [
		{
			method: 'GET',
			path: '/users/me',
			handler: 'user.me',
			config: {
				auth: false, // Отключаем стандартную проверку auth, проверяем вручную в контроллере
				policies: [],
				middlewares: [],
			},
		},
		{
			method: 'PUT',
			path: '/users/me',
			handler: 'user.updateMe',
			config: {
				auth: false, // Отключаем стандартную проверку auth, проверяем вручную в контроллере
				policies: [],
				middlewares: [],
			},
		},
	],
}

