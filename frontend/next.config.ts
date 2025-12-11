import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	// Для деплоя на VPS/Docker - создает standalone версию
	// Раскомментируйте, если деплоите на свой сервер:
	output: 'standalone',

	images: {
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
	},
}

export default nextConfig
