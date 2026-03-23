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

				const queryType = String(query.type || '')
				const isBrandLevel = levelNumber === 2 && queryType === 'brand'
				const shouldPopulateLogo =
					isBrandLevel || String(query.home || '').toLowerCase() === 'true'
				const populateParam = query.populate || []
				const populate = shouldPopulateLogo
					? Array.isArray(populateParam)
						? Array.from(new Set([...populateParam, 'logo']))
						: ['logo']
					: populateParam

				const categories = await strapi.entityService.findMany(
					'api::category.category',
					{
						filters,
						sort: query.sort || 'sortOrder:asc,name:asc',
						populate,
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

				// Гибридная выдача для блока "Популярные бренды":
				// 1) ручные бренды showOnHome=true (homeSort ASC)
				// 2) автодобор брендами с товарным покрытием/популярностью
				const isHomeRequest = String(query.home || '').toLowerCase() === 'true'
				if (isBrandLevel && isHomeRequest) {
					const parsedLimit = parseInt(String(query.limit || '10'), 10)
					const limit = Number.isNaN(parsedLimit)
						? 10
						: Math.max(1, Math.min(parsedLimit, 50))

					const normalizedName = (name: string) =>
						String(name || '')
							.trim()
							.toLowerCase()
							.replace(/\s+/g, ' ')

					const manualBrands = [...processedCategories]
						.filter((brand: any) => Boolean(brand.showOnHome))
						.sort((a: any, b: any) => {
							const aSort = Number(a.homeSort || 0)
							const bSort = Number(b.homeSort || 0)
							if (aSort !== bSort) return aSort - bSort
							return String(a.name || '').localeCompare(String(b.name || ''), 'ru')
						})

					const selected: any[] = []
					const selectedKeys = new Set<string>()
					const selectedIds = new Set<number>()

					const tryPushBrand = (brand: any) => {
						if (!brand) return
						const key = normalizedName(brand.name)
						if (!key || selectedKeys.has(key) || selectedIds.has(brand.id)) return
						selected.push(brand)
						selectedKeys.add(key)
						selectedIds.add(brand.id)
					}

					for (const brand of manualBrands) {
						if (selected.length >= limit) break
						tryPushBrand(brand)
					}

					const needsAutoFill = selected.length < limit
					if (needsAutoFill) {
						const autoCandidates = processedCategories.filter(
							(brand: any) => !selectedIds.has(brand.id)
						)
						const autoCandidateIds = autoCandidates.map((brand: any) => brand.id)

						if (autoCandidateIds.length > 0) {
							const products = await strapi.entityService.findMany(
								'api::product.product',
								{
									filters: {
										brand: { id: { $in: autoCandidateIds } },
										published: true,
									},
									fields: [
										'id',
										'stock',
										'sbisPopularityScore',
										'sbisSalesCount',
										'sbisTotalQuantitySold',
									],
									populate: {
										brand: {
											fields: ['id'],
										},
									},
									limit: -1,
								}
							)

							const brandStats = new Map<
								number,
								{
									brandId: number
									productsCount: number
									inStockCount: number
									popularityScore: number
									salesCount: number
									quantitySold: number
								}
							>()

							for (const product of products as any[]) {
								const brandId = product?.brand?.id
								if (typeof brandId !== 'number') continue

								const current = brandStats.get(brandId) || {
									brandId,
									productsCount: 0,
									inStockCount: 0,
									popularityScore: 0,
									salesCount: 0,
									quantitySold: 0,
								}

								current.productsCount += 1
								if (Number(product.stock || 0) > 0) {
									current.inStockCount += 1
								}
								current.popularityScore += Number(product.sbisPopularityScore || 0)
								current.salesCount += Number(product.sbisSalesCount || 0)
								current.quantitySold += Number(product.sbisTotalQuantitySold || 0)

								brandStats.set(brandId, current)
							}

							const autoSorted = autoCandidates
								.map((brand: any) => ({
									brand,
									stats: brandStats.get(brand.id),
								}))
								.filter((item) => Boolean(item.stats && item.stats.productsCount > 0))
								.sort((a, b) => {
									const sa = a.stats!
									const sb = b.stats!
									if (sb.popularityScore !== sa.popularityScore) {
										return sb.popularityScore - sa.popularityScore
									}
									if (sb.salesCount !== sa.salesCount) {
										return sb.salesCount - sa.salesCount
									}
									if (sb.quantitySold !== sa.quantitySold) {
										return sb.quantitySold - sa.quantitySold
									}
									if (sb.inStockCount !== sa.inStockCount) {
										return sb.inStockCount - sa.inStockCount
									}
									if (sb.productsCount !== sa.productsCount) {
										return sb.productsCount - sa.productsCount
									}
									return String(a.brand.name || '').localeCompare(
										String(b.brand.name || ''),
										'ru'
									)
								})

							for (const item of autoSorted) {
								if (selected.length >= limit) break
								tryPushBrand(item.brand)
							}
						}
					}

					processedCategories = selected.slice(0, limit)
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
