export default (config: any, { strapi }: any) => {
	return async (ctx: any, next: any) => {
		// Исправляем пустой или некорректный pathname
		// Это критично для работы админ-панели за reverse proxy
		
		// Получаем pathname из разных источников
		let pathname = ctx.path || ctx.request?.path || ctx.url || ctx.originalUrl || '';
		
		// Обрабатываем случай, когда pathname может быть null/undefined
		// или пустая строка, или только слэш
		if (!pathname || pathname === '' || pathname === '/') {
			// Определяем, это API запрос или нет
			// Проверяем разные источники URL
			const requestUrl = ctx.url || ctx.request?.url || ctx.originalUrl || '';
			const isApiRequest = requestUrl.startsWith('/api') || 
			                     ctx.path?.startsWith('/api') ||
			                     ctx.request?.path?.startsWith('/api');
			
			// Для API запросов с пустым pathname - сохраняем оригинальный URL из requestUrl
			// или оставляем пустым (Strapi должен обработать сам)
			if (isApiRequest) {
				// Для API запросов используем оригинальный URL, если он есть
				pathname = requestUrl && requestUrl !== '/' ? requestUrl : pathname;
			} else if (ctx.method === 'GET') {
				// Для не-API GET запросов без pathname - админка
				pathname = '/admin';
			} else {
				// Для других методов используем оригинальный URL или /admin как fallback
				pathname = (requestUrl && requestUrl !== '/') ? requestUrl : '/admin';
			}
		}
		
		// Устанавливаем pathname во все необходимые места
		// Это критично для корректной работы Strapi
		ctx.path = pathname;
		
		if (ctx.request) {
			ctx.request.path = pathname;
			if (!ctx.request.url || ctx.request.url === '' || ctx.request.url === '/') {
				ctx.request.url = pathname;
			}
		}
		
		if (!ctx.url || ctx.url === '' || ctx.url === '/') {
			ctx.url = pathname;
		}
		
		if (!ctx.originalUrl || ctx.originalUrl === '' || ctx.originalUrl === '/') {
			ctx.originalUrl = pathname;
		}

		await next();
	};
};

