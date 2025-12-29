import type { NextConfig } from 'next'

const isDevelopment = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
	// Для деплоя на VPS/Docker - создает standalone версию
	// Включается только в production режиме
	...(isDevelopment ? {} : { output: 'standalone' }),

	images: {
		// Временно отключаем оптимизацию для api.sbis.ru чтобы избежать бесконечных 404 ошибок
		unoptimized: false,
		remotePatterns: [
			{
				protocol: 'http',
				hostname: 'localhost',
				port: '1337',
				pathname: '/img**',
			},
			{
				protocol: 'http',
				hostname: 'backend',
				port: '1337',
				pathname: '/img**',
			},
			{
				protocol: 'http',
				hostname: 'api.borkssport.ru',
				pathname: '/img**',
			},
			{
				protocol: 'https',
				hostname: 'api.borkssport.ru',
				pathname: '/img**',
			},
			{
				protocol: 'https',
				hostname: 'api.sbis.ru',
				pathname: '/disk/api/v1/**',
			},
		],
		// Добавляем обработку ошибок для изображений
		dangerouslyAllowSVG: true,
		contentDispositionType: 'attachment',
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},
}

export default nextConfig
