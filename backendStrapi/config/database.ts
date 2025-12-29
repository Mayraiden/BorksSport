import path from 'path'

const databaseConfig = ({ env }) => {
	// Убеждаемся, что env функция доступна
	if (!env) {
		throw new Error('Environment function is not available')
	}

	const client = env('DATABASE_CLIENT', 'sqlite')

	if (client === 'postgres') {
		// Убираем кавычки и пробелы из значений (на случай если они есть в .env)
		const rawDatabaseName = env('DATABASE_NAME', 'strapi')
		const databaseName =
			typeof rawDatabaseName === 'string'
				? rawDatabaseName.replace(/^["']|["']$/g, '').trim()
				: rawDatabaseName

		const dbConfig = {
			host: env('DATABASE_HOST', 'localhost'),
			port: env.int('DATABASE_PORT', 5432),
			database: databaseName,
			user: env('DATABASE_USERNAME', 'strapi'),
			password: env('DATABASE_PASSWORD', 'strapi'),
			ssl: env.bool('DATABASE_SSL', false),
			schema: env('DATABASE_SCHEMA', 'public'),
		}

		const config = {
			connection: {
				client: 'postgres',
				connection: dbConfig,
				pool: {
					min: env.int('DATABASE_POOL_MIN', 2),
					max: env.int('DATABASE_POOL_MAX', 10),
				},
				acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
			},
		}
		return config
	}

	if (client === 'mysql') {
		const config = {
			connection: {
				client: 'mysql',
				connection: {
					host: env('DATABASE_HOST', 'localhost'),
					port: env.int('DATABASE_PORT', 3306),
					database: env('DATABASE_NAME', 'strapi'),
					user: env('DATABASE_USERNAME', 'strapi'),
					password: env('DATABASE_PASSWORD', 'strapi'),
					ssl: env.bool('DATABASE_SSL', false),
				},
				pool: {
					min: env.int('DATABASE_POOL_MIN', 2),
					max: env.int('DATABASE_POOL_MAX', 10),
				},
				acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
			},
		}
		return config
	}

	// SQLite (default)
	const config = {
		connection: {
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
			acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
		},
	}
	return config
}

export default databaseConfig
