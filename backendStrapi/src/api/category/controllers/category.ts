import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::category.category',
	({ strapi }) => ({
		/**
		 * Get categories with hierarchy
		 * GET /api/categories
		 */
		async find(ctx) {
			try {
				const { query } = ctx
				const start = Number(query.start) || 0
				const limit = Number(query.limit) || 50

				const categories = await strapi.entityService.findMany(
					'api::category.category',
					{
						filters: query.filters || {},
						sort: query.sort || 'sortOrder:asc,name:asc',
						start,
						limit,
						populate: ['parent', 'children', 'products'],
					}
				)

				const total = await strapi.entityService.count(
					'api::category.category',
					{
						filters: query.filters || {},
					}
				)

				ctx.body = {
					success: true,
					data: categories,
					meta: {
						pagination: {
							page: Math.floor(start / limit) + 1,
							pageSize: limit,
							total,
							pageCount: Math.ceil(total / limit),
						},
					},
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Clear all categories
		 * DELETE/POST/GET /api/categories/clear-all[(-now)]
		 */
		async clearAll(ctx) {
			try {
				strapi.log.warn('Clearing all categories from database')

				const beforeCount = await strapi.entityService.count(
					'api::category.category'
				)

				const categories = await strapi.entityService.findMany(
					'api::category.category',
					{
						fields: ['id', 'level'],
						sort: ['level:desc', 'id:desc'],
						limit: -1,
					}
				)

				let deleted = 0
				for (const category of categories) {
					await strapi.entityService.delete(
						'api::category.category',
						category.id
					)
					deleted++
				}

				const afterCount = await strapi.entityService.count(
					'api::category.category'
				)
				strapi.log.info(
					`[Category Controller] clearAll completed: before=${beforeCount}, deleted=${deleted}, after=${afterCount}`
				)

				ctx.body = {
					success: true,
					message: `Successfully deleted ${deleted} categories`,
					data: { before: beforeCount, deleted, after: afterCount },
				}
			} catch (error) {
				strapi.log.error('Failed to clear categories:', error.message)
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
					message: 'Failed to clear categories',
				}
			}
		},

		/**
		 * Get category by ID
		 * GET /api/categories/:id
		 */
		async findOne(ctx) {
			try {
				const { id } = ctx.params

				const category = await strapi.entityService.findOne(
					'api::category.category',
					id,
					{
						populate: ['parent', 'children', 'products'],
					}
				)

				if (!category) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Category not found',
					}
					return
				}

				ctx.body = {
					success: true,
					data: category,
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Get main categories (level = 0)
		 * GET /api/categories/main
		 */
		async findMain(ctx) {
			try {
				const { query } = ctx

				const filters: any = {
					level: 0,
					isActive: true,
					type: 'sport',
				}

				// Merge additional filters if provided
				if (query.filters && typeof query.filters === 'object') {
					Object.assign(filters, query.filters)
				}

				const categories = await strapi.entityService.findMany(
					'api::category.category',
					{
						filters,
						sort: query.sort || 'sortOrder:asc,name:asc',
						populate: ['children'],
					}
				)

				ctx.body = {
					success: true,
					data: categories,
					meta: {
						count: categories.length,
					},
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Get categories by level
		 * GET /api/categories/by-level/:level
		 * Used for filters:
		 * - level 0: Sport types (main categories)
		 * - level 1: Product categories (bags, balls, etc.)
		 * - level 2: Brands
		 */
		async findByLevel(ctx) {
			try {
				const { level } = ctx.params
				const { query } = ctx

				const levelNumber = parseInt(level, 10)
				if (isNaN(levelNumber) || levelNumber < 0) {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Invalid level parameter. Must be a non-negative integer.',
					}
					return
				}

				const filters: any = {
					level: levelNumber,
					isActive: true,
				}

				// Опционально: фильтр по типу категории (sport, productType, subcategory, brand)
				if (query.type && ['sport', 'productType', 'subcategory', 'brand'].includes(String(query.type))) {
					filters.type = query.type
				}

				// Scoping для уровня 1 (productType) по выбранным видам спорта (level 0).
				// Если пользователь выбрал один или несколько sport'ов, показываем только категории
				// с parent sport в соответствующем наборе.
				if (levelNumber === 1 && query.sports) {
					const sports = String(query.sports)
						.split(',')
						.map((s) => s.trim())
						.filter(Boolean)

					if (sports.length > 0) {
						filters.parent = {
							name: { $in: sports },
						}
					}
				}

				// Merge additional filters if provided
				if (query.filters && typeof query.filters === 'object') {
					Object.assign(filters, query.filters)
				}

				const categories = await strapi.entityService.findMany(
					'api::category.category',
					{
						filters,
						sort: query.sort || 'sortOrder:asc,name:asc',
						populate: query.populate || [],
					}
				)

				// Для уровня 2 (бренды) применяем дедупликацию и фильтрацию
				let processedCategories = categories
				if (levelNumber === 2 && query.type !== 'brand') {
					// Нормализуем имена для дедупликации (приводим к нижнему регистру, убираем лишние пробелы)
					const normalizeName = (name: string) => {
						return name.trim().toLowerCase().replace(/\s+/g, ' ')
					}

					// Словарь для отслеживания уникальных брендов (ключ - нормализованное имя)
					const uniqueBrandsMap = new Map<string, typeof categories[0]>()

					// Список паттернов, которые указывают на то, что это не бренд, а категория
					const nonBrandPatterns = [
						/сумки?\s/i, // "Сумки", "Сумка"
						/базы?\s/i, // "Базы"
						/пластины?\s/i, // "Пластины", "Пластина"
						/аксессуары?\s/i, // "Аксессуары"
						/экипировка\s/i, // "Экипировка"
						/оборудование\s/i, // "Оборудование"
						/\/\s*пластины?/i, // "Базы/Пластины"
					]

					for (const category of categories) {
						const name = category.name || ''
						const normalizedName = normalizeName(name)

						// Пропускаем категории, которые не являются брендами
						const isNonBrand = nonBrandPatterns.some((pattern) =>
							pattern.test(name)
						)
						if (isNonBrand) {
							continue
						}

						// Если бренд с таким нормализованным именем уже есть, оставляем первый найденный
						if (!uniqueBrandsMap.has(normalizedName)) {
							uniqueBrandsMap.set(normalizedName, category)
						}
					}

					// Преобразуем Map обратно в массив и сортируем по имени
					processedCategories = Array.from(uniqueBrandsMap.values()).sort(
						(a, b) => {
							const nameA = (a.name || '').toLowerCase()
							const nameB = (b.name || '').toLowerCase()
							return nameA.localeCompare(nameB, 'ru')
						}
					)

					strapi.log.info(
						`[Category Controller] Level 2: ${categories.length} categories → ${processedCategories.length} unique brands after deduplication`
					)
				}

				ctx.body = {
					success: true,
					data: processedCategories,
					meta: {
						count: processedCategories.length,
						level: levelNumber,
						originalCount: categories.length,
					},
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},
	})
)
