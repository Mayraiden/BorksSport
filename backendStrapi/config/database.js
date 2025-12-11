'use strict'

const path = require('path')

module.exports = ({ env }) => {
	const client = env('DATABASE_CLIENT', 'sqlite')

	if (client === 'postgres') {
		return {
			client: 'postgres',
			connection: {
				host: env('DATABASE_HOST', 'localhost'),
				port: env.int('DATABASE_PORT', 5432),
				database: env('DATABASE_NAME', 'strapi'),
				user: env('DATABASE_USERNAME', 'strapi'),
				password: env('DATABASE_PASSWORD', 'strapi'),
				ssl: env.bool('DATABASE_SSL', false),
			},
			pool: {
				min: env.int('DATABASE_POOL_MIN', 2),
				max: env.int('DATABASE_POOL_MAX', 10),
			},
		}
	}

	if (client === 'mysql') {
		return {
			client: 'mysql',
			connection: {
				host: env('DATABASE_HOST'),
				port: env.int('DATABASE_PORT', 3306),
				database: env('DATABASE_NAME'),
				user: env('DATABASE_USERNAME'),
				password: env('DATABASE_PASSWORD'),
				ssl: env.bool('DATABASE_SSL', false),
			},
		}
	}

	return {
		client: 'sqlite',
		connection: {
			filename: path.join(
				__dirname,
				'..',
				'..',
				env('DATABASE_FILENAME', '.tmp/data.db')
			),
		},
		useNullAsDefault: true,
	}
}
