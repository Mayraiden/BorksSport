# Docker Deployment Status

## Current Status

### Working Services

- ✅ **PostgreSQL**: Running successfully on port 5433 (mapped from container port 5432)

  - Container: `sportmagazine-postgres`
  - Database: `strapi`
  - User: `strapi`
  - Status: Healthy

- ✅ **Frontend (Next.js)**: Running successfully on port 3000
  - Container: `sportmagazine-frontend`
  - Status: Running

### Issues

- ❌ **Backend (Strapi)**: Failing to start
  - Container: `sportmagazine-backend`
  - Status: Restarting (crash loop)
  - Error: `Cannot destructure property 'client' of 'db.config.connection' as it is undefined`

## Problem Description

The Strapi backend container is unable to start due to a database configuration loading issue. The error occurs when Strapi tries to initialize the database connection:

```
TypeError: Cannot destructure property 'client' of 'db.config.connection' as it is undefined.
    at Object.getDialect (/app/node_modules/@strapi/database/dist/dialects/index.js:36:13)
    at new Database (/app/node_modules/@strapi/database/dist/index.js:145:32)
```

### Root Cause Analysis

1. **Configuration File Structure**: The database configuration file (`dist/config/database.js`) exists and has the correct structure when tested locally.

2. **Local Testing**: When tested outside Docker with a mock environment object, the configuration returns the correct structure:

   ```json
   {
   	"connection": {
   		"client": "postgres",
   		"connection": {
   			"host": "postgres",
   			"port": 5432,
   			"database": "strapi",
   			"user": "strapi",
   			"password": "strapi",
   			"ssl": false,
   			"schema": "public"
   		},
   		"pool": { "min": 2, "max": 10 },
   		"acquireConnectionTimeout": 60000
   	}
   }
   ```

3. **Docker Environment**: In the Docker container, Strapi cannot properly load the database configuration, resulting in `db.config.connection` being `undefined`.

## Configuration Details

### Database Configuration File

- **Location**: `backendStrapi/config/database.ts` (source)
- **Compiled**: `backendStrapi/dist/config/database.js` (production)
- **Format**: TypeScript compiled to CommonJS with `exports.default`

### Current Configuration Structure

```typescript
export default ({ env }) => {
	const client = env('DATABASE_CLIENT', 'sqlite')

	if (client === 'postgres') {
		return {
			connection: {
				client: 'postgres',
				connection: {
					host: env('DATABASE_HOST', 'localhost'),
					port: env.int('DATABASE_PORT', 5432),
					database: env('DATABASE_NAME', 'strapi'),
					user: env('DATABASE_USERNAME', 'strapi'),
					password: env('DATABASE_PASSWORD', 'strapi'),
					ssl: env.bool('DATABASE_SSL', false),
					schema: env('DATABASE_SCHEMA', 'public'),
				},
				pool: {
					min: env.int('DATABASE_POOL_MIN', 2),
					max: env.int('DATABASE_POOL_MAX', 10),
				},
				acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
			},
		}
	}
	// ... mysql and sqlite configurations
}
```

### Environment Variables (docker-compose.yml)

```yaml
environment:
  DATABASE_CLIENT: postgres
  DATABASE_HOST: postgres
  DATABASE_PORT: 5432
  DATABASE_NAME: ${DATABASE_NAME:-strapi}
  DATABASE_USERNAME: ${DATABASE_USERNAME:-strapi}
  DATABASE_PASSWORD: ${DATABASE_PASSWORD:-strapi}
  DATABASE_SSL: 'false'
  NODE_ENV: production
```

## Attempted Solutions

### 1. Configuration Structure Fixes

- ✅ Simplified configuration structure to use explicit if/else instead of object spreading
- ✅ Ensured proper nested `connection` structure
- ✅ Verified configuration returns correct structure locally

### 2. Dockerfile Adjustments

- ✅ Removed source TypeScript config files from production image (Strapi can't load `.ts` in production)
- ✅ Ensured only compiled `.js` files from `dist/config/` are included
- ✅ Verified file exists in container: `/app/dist/config/database.js`

### 3. Module Export Format

- ❌ Attempted to add `module.exports` compatibility (overwritten during build)
- ✅ Confirmed other config files use same `exports.default` format

## Docker Setup

### Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - '5433:5432' # External port 5433 to avoid conflict with local PostgreSQL
    environment:
      POSTGRES_USER: strapi
      POSTGRES_PASSWORD: strapi
      POSTGRES_DB: strapi

  backend:
    build:
      context: ./backendStrapi
      dockerfile: Dockerfile
    env_file:
      - ./backendStrapi/.env
    environment:
      DATABASE_CLIENT: postgres
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      # ... other variables
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://backend:1337
    depends_on:
      - backend
```

### Dockerfile Structure (Backend)

- Multi-stage build: `deps` → `builder` → `runner`
- Production image includes:
  - `/app/dist` (compiled TypeScript)
  - `/app/node_modules`
  - `/app/public`
  - `/app/database`
  - Excludes: source `config/`, `src/`, `types/`

## Next Steps / Potential Solutions

### 1. Debug Strapi Configuration Loading

- Add debug logging to see what Strapi receives when loading config
- Check if Strapi is looking in the correct path for config files
- Verify environment variables are properly passed to Strapi

### 2. Alternative Configuration Approach

- Try using `.js` config file directly instead of compiled TypeScript
- Use `module.exports` format instead of `exports.default`
- Check Strapi 5 documentation for production config loading requirements

### 3. Environment Variable Verification

- Add startup script to verify all environment variables are set
- Check if `env` function is properly available in production mode
- Verify NODE_ENV doesn't affect config loading

### 4. Strapi Version Specific Issues

- Check if Strapi 5.25.0 has known issues with config loading in Docker
- Review Strapi production deployment documentation
- Consider testing with development mode in Docker first

### 5. File System Permissions

- Verify file permissions in container
- Check if Strapi user can read config files
- Ensure proper ownership of files

## Local Development Status

- ✅ **Local Strapi**: Works correctly with PostgreSQL on port 5433
- ✅ **Database Migration**: Successfully switched from SQLite to PostgreSQL
- ✅ **Configuration**: Database config works in local development mode

## Files Modified

1. `backendStrapi/config/database.ts` - Simplified configuration structure
2. `backendStrapi/Dockerfile` - Multi-stage build, excludes source config files
3. `docker-compose.yml` - PostgreSQL port changed to 5433, environment variables configured
4. `backendStrapi/.env` - Updated for PostgreSQL (port 5433 for local development)

## Commands

### Check Container Status

```bash
docker-compose ps
```

### View Backend Logs

```bash
docker-compose logs backend --tail=50
```

### Rebuild Backend

```bash
docker-compose up -d --build backend
```

### Access Backend Container

```bash
docker-compose exec backend sh
```

## Notes

- PostgreSQL container is healthy and accessible
- Frontend container is running and waiting for backend
- Backend configuration structure is correct when tested locally
- Issue appears to be specific to how Strapi loads configuration in Docker production mode
- All environment variables are properly set in docker-compose.yml
