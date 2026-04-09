import type { NextConfig } from 'next'
import path from 'path'

const isDevelopment = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
	// Для деплоя на VPS/Docker - создает standalone версию
	// Включается только в production режиме
	...(isDevelopment ? {} : { output: 'standalone' }),

	// Явная настройка webpack для правильного разрешения путей
	webpack: (config) => {
		// Убеждаемся, что пути из tsconfig.json правильно разрешаются
		config.resolve.alias = {
			...config.resolve.alias,
			'@': path.resolve(__dirname, './src'),
			'@features': path.resolve(__dirname, './src/features'),
			'@widgets': path.resolve(__dirname, './src/widgets'),
			'@shared': path.resolve(__dirname, './src/shared'),
		}
		// Улучшаем разрешение модулей для SSR импортов
		config.resolve.extensionAlias = {
			'.js': ['.js', '.ts', '.tsx'],
			'.jsx': ['.jsx', '.tsx'],
		}
		return config
	},

	images: {
		// Временно отключаем оптимизацию для api.sbis.ru чтобы избежать бесконечных 404 ошибок
		unoptimized: false,
		remotePatterns: [
			{
				protocol: 'http',
				hostname: 'localhost',
				port: '1337',
				pathname: '/uploads/**',
			},
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
				pathname: '/uploads/**',
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
				pathname: '/uploads/**',
			},
			{
				protocol: 'http',
				hostname: 'api.borkssport.ru',
				pathname: '/img**',
			},
			{
				protocol: 'https',
				hostname: 'api.borkssport.ru',
				pathname: '/uploads/**',
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
			{
				protocol: 'https',
				hostname: 'disk.sbis.ru',
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
