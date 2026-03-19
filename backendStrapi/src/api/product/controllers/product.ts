import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::product.product',
	({ strapi }) => ({
		/**
		 * Get products with filtering and pagination
		 * GET /api/products
		 */
		async find(ctx) {
			try {
				const { query } = ctx
				const start = Number(query.start) || 0
				const limit = Number(query.limit) || 20

				// Проверяем, нужно ли использовать Meilisearch
				if (query.meilisearch === 'true' && query.q) {
					try {
						// Используем прямой HTTP запрос к Meilisearch
						const axios = require('axios')

						strapi.log.info('Getting Meilisearch config...')
						const meilisearchConfig = strapi.config.get(
							'plugin::meilisearch'
						) as any

						strapi.log.info(
							'Meilisearch config:',
							JSON.stringify(meilisearchConfig, null, 2)
						)

						strapi.log.info(
							`Meilisearch search: q="${query.q}", start=${start}, limit=${limit}`
						)

						const searchUrl = `${meilisearchConfig.config.host}/indexes/product/search`
						strapi.log.info('Search URL:', searchUrl)

						const searchResponse = await axios.post(
							searchUrl,
							{
								q: query.q,
								offset: start,
								limit: limit,
								sort: query.sort ? [query.sort] : ['name:asc'],
							},
							{
								headers: {
									Authorization: `Bearer ${meilisearchConfig.config.apiKey}`,
									'Content-Type': 'application/json',
								},
							}
						)

						strapi.log.info(
							`Meilisearch response: ${searchResponse.data.hits?.length || 0} results`
						)

						ctx.body = {
							success: true,
							data: searchResponse.data.hits || [],
							meta: {
								pagination: {
									page: Math.floor(start / limit) + 1,
									pageSize: limit,
									total: searchResponse.data.estimatedTotalHits || 0,
									pageCount: Math.ceil(
										(searchResponse.data.estimatedTotalHits || 0) / limit
									),
								},
							},
						}
						return
					} catch (meilisearchError) {
						// Если Meilisearch не работает, используем обычный поиск
						strapi.log.warn(
							'Meilisearch search failed, falling back to Strapi search:',
							meilisearchError.message
						)
						strapi.log.error(
							'Meilisearch error details:',
							meilisearchError.response?.data || meilisearchError.message
						)
						strapi.log.error('Full Meilisearch error object:', meilisearchError)
					}
				}

				// Обычный поиск через Strapi
				// Детальное логирование фильтров для отладки
				strapi.log.info(
					'[Product Controller] Raw query object:',
					JSON.stringify({
						filters: query.filters,
						filtersType: typeof query.filters,
						allQueryKeys: Object.keys(query),
					}, null, 2)
				)
				
				// Ручная обработка фильтров из query string, если Strapi не парсит их автоматически
				// Проверяем, есть ли фильтры в формате filters[rootCategoryName][$eq] в query
				let parsedFilters: Record<string, any> = {}
				if (query.filters && typeof query.filters === 'object') {
					parsedFilters = query.filters
				} else {
					// Если фильтры не распарсились, пробуем извлечь их из query напрямую
					// Это может произойти, если Strapi не парсит вложенные фильтры
					for (const [key, value] of Object.entries(query)) {
						if (key.startsWith('filters[') && key.includes('rootCategoryName')) {
							// Извлекаем значение фильтра
							if (key.includes('[$eq]')) {
								parsedFilters.rootCategoryName = {
									$eq: value
								}
							}
						}
					}
				}
				
				if (parsedFilters && Object.keys(parsedFilters).length > 0) {
					strapi.log.info(
						'[Product Controller] Product filters received (parsed):',
						JSON.stringify(parsedFilters, null, 2)
					)
					
					// Проверяем наличие фильтров по категориям
					if ('category' in parsedFilters) {
						strapi.log.info(
							'[Product Controller] Category relation filter detected:',
							JSON.stringify(parsedFilters.category, null, 2)
						)
					}
					if ('rootCategoryName' in parsedFilters) {
						strapi.log.info(
							'[Product Controller] Root category name filter detected:',
							JSON.stringify(parsedFilters.rootCategoryName, null, 2)
						)
					}
				}

				// Нормализуем фильтры для корректной работы со Strapi
				// Если rootCategoryName приходит как объект { $eq: "..." }, оставляем как есть
				// Если приходит как строка, преобразуем в объект { $eq: "..." }
				if (parsedFilters.rootCategoryName && typeof parsedFilters.rootCategoryName === 'string') {
					parsedFilters.rootCategoryName = {
						$eq: parsedFilters.rootCategoryName
					}
				}

				// Трансформация фильтров для новых связей (productCategory, subcategory, brand, sportCategory)
				const andConditions: any[] = []

				// Фильтр category (дружелюбный fallback: productCategory -> subcategory.parent -> subcategory -> legacy category)
				const categoryFilter = parsedFilters.category
				if (categoryFilter && typeof categoryFilter === 'object') {
					const nameFilter = categoryFilter.name
					const eqValue = nameFilter?.$eq
					const inValues = Array.isArray(nameFilter?.$in) ? nameFilter.$in : []
					if (eqValue && typeof eqValue === 'string') {
						andConditions.push({
							$or: [
								{ productCategory: { name: { $eq: eqValue } } },
								{ subcategory: { parent: { name: { $eq: eqValue } } } },
								{ subcategory: { name: { $eq: eqValue } } },
								{ category: { name: { $eq: eqValue } } },
							],
						})
						delete parsedFilters.category
					} else if (inValues.length > 0) {
						const categoryOrItems: any[] = []
						for (const rawValue of inValues) {
							const value = String(rawValue || '').trim()
							if (!value) continue
							categoryOrItems.push(
								{ productCategory: { name: { $eq: value } } },
								{ subcategory: { parent: { name: { $eq: value } } } },
								{ subcategory: { name: { $eq: value } } },
								{ category: { name: { $eq: value } } }
							)
						}
						if (categoryOrItems.length > 0) {
							andConditions.push({ $or: categoryOrItems })
						}
						delete parsedFilters.category
					}
				}
				// Обработка filters[$or][0][category][name][$eq] (множественные category)
				if (parsedFilters.$or && Array.isArray(parsedFilters.$or)) {
					const categoryOrItems: any[] = []
					const otherOrItems: any[] = []
					for (const item of parsedFilters.$or) {
						if (item?.category?.name?.$eq) {
							const v = item.category.name.$eq
							categoryOrItems.push(
								{ productCategory: { name: { $eq: v } } },
								{ subcategory: { parent: { name: { $eq: v } } } },
								{ subcategory: { name: { $eq: v } } },
								{ category: { name: { $eq: v } } },
							)
						} else {
							otherOrItems.push(item)
						}
					}
					if (categoryOrItems.length > 0) {
						andConditions.push({ $or: categoryOrItems })
					}
					parsedFilters.$or = otherOrItems.length > 0 ? otherOrItems : undefined
					if (!parsedFilters.$or) delete parsedFilters.$or
				}

				// Фильтр sport (Бейсбол и т.д.) или rootCategoryName
				const rootFilter = parsedFilters.rootCategoryName
				const sportFilter = parsedFilters.sportCategory
				const sportValue = rootFilter
					? (typeof rootFilter === 'object' && rootFilter.$eq ? rootFilter.$eq : rootFilter)
					: sportFilter?.name?.$eq
				const sportInValues = Array.isArray(sportFilter?.name?.$in)
					? sportFilter.name.$in
					: []
				if (sportValue) {
					andConditions.push({
						$or: [
							{ sportCategory: { name: { $eq: sportValue } } },
							{ rootCategoryName: { $eq: sportValue } },
						],
					})
					delete parsedFilters.rootCategoryName
					delete parsedFilters.sportCategory
				} else if (sportInValues.length > 0) {
					const sportOrItems = sportInValues
						.map((raw: any) => String(raw || '').trim())
						.filter(Boolean)
						.flatMap((value: string) => ([
							{ sportCategory: { name: { $eq: value } } },
							{ rootCategoryName: { $eq: value } },
						]))
					if (sportOrItems.length > 0) {
						andConditions.push({ $or: sportOrItems })
					}
					delete parsedFilters.rootCategoryName
					delete parsedFilters.sportCategory
				}

				// Фильтр brand (без перехвата товарных категорий)
				const brandFilter = parsedFilters.brand
				if (brandFilter && typeof brandFilter === 'object') {
					const brandEq = brandFilter.name?.$eq
					const brandIn = Array.isArray(brandFilter.name?.$in) ? brandFilter.name.$in : []
					if (brandEq) {
						andConditions.push({ brand: { name: { $eq: brandEq } } })
						delete parsedFilters.brand
					} else if (brandIn.length > 0) {
						const brandOrItems = brandIn
							.map((raw: any) => String(raw || '').trim())
							.filter(Boolean)
							.map((value: string) => ({ brand: { name: { $eq: value } } }))
						if (brandOrItems.length > 0) {
							andConditions.push({ $or: brandOrItems })
						}
						delete parsedFilters.brand
					}
				}

				if (andConditions.length > 0) {
					parsedFilters.$and = [...(parsedFilters.$and || []), ...andConditions]
				}

				// Объединяем фильтры с фильтром published: true и stock > 0 по умолчанию
				const baseFilters: Record<string, unknown> = {
					published: true,
					stock: {
						$gt: 0,
					},
				}
				const filters = {
					...baseFilters,
					...parsedFilters,
				}
				
				// Детальное логирование итоговых фильтров
				strapi.log.info(
					'[Product Controller] Final filters that will be applied:',
					JSON.stringify(filters, null, 2)
				)

				// Проверяем общее количество товаров в базе (включая неопубликованные)
				const totalInDb = await strapi.entityService.count('api::product.product', {
					filters: {},
				})
				const totalPublished = await strapi.entityService.count('api::product.product', {
					filters: { published: true },
				})

				strapi.log.info(
					`Products in DB: total=${totalInDb}, published=${totalPublished}`
				)

				// Populate категорий для фильтрации и отображения
				const categoryPopulate = [
					'category',
					'sportCategory',
					'productCategory',
					'subcategory',
					'brand',
				]
				const needsCategoryPopulate =
					query.filters &&
					typeof query.filters === 'object' &&
					('category' in query.filters ||
						'rootCategoryName' in query.filters ||
						'brand' in query.filters ||
						'sportCategory' in query.filters ||
						Object.keys(query.filters).some((k) =>
							k.includes('category') || k.includes('Category') || k.includes('brand')
						))

				// Исправляем сортировку по цене: товары с ценой 0 или NULL должны быть в конце при сортировке по убыванию
				const sortParam = query.sort || 'name:asc'
				let allProducts: any[] = []
				
				if (sortParam === 'price:desc') {
					// При сортировке по убыванию цены сначала получаем товары с ценой > 0, потом с ценой 0 или NULL
					const filtersWithPrice = {
						...filters,
						price: {
							$gt: 0,
						},
					}
					
					// Для товаров с ценой 0 или NULL используем фильтр по цене = 0
					// NULL значения будут обработаны отдельно
					const filtersWithZeroPrice = {
						...filters,
						price: {
							$eq: 0,
						},
					}
					
					// Получаем товары с ценой > 0, отсортированные по убыванию
					const productsWithPrice = await strapi.entityService.findMany(
						'api::product.product',
						{
							filters: filtersWithPrice,
							sort: 'price:desc',
							populate: needsCategoryPopulate ? (categoryPopulate as any) : undefined,
						}
					)
					
					// Получаем товары с ценой 0 или NULL
					const productsWithZeroPrice = await strapi.entityService.findMany(
						'api::product.product',
						{
							filters: filtersWithZeroPrice,
							sort: 'name:asc', // Сортируем по имени для товаров с нулевой ценой
							populate: needsCategoryPopulate ? (categoryPopulate as any) : undefined,
						}
					)
					
					// Объединяем: сначала товары с ценой > 0, потом с ценой 0
					allProducts = [...productsWithPrice, ...productsWithZeroPrice]
				} else {
					// Для остальных видов сортировки получаем все товары без пагинации
					// Пагинация будет применена после дедупликации
					allProducts = await strapi.entityService.findMany(
						'api::product.product',
						{
							filters,
							sort: sortParam,
							populate: needsCategoryPopulate ? (categoryPopulate as any) : undefined,
						}
					)
				}

				// Используем allProducts для дальнейшей обработки
				let products = allProducts

				// Логирование результатов
				if (allProducts.length > 0) {
					const firstProduct = allProducts[0] as any
					strapi.log.info(
						`[Product Controller] Found ${allProducts.length} products before deduplication. First product: ${firstProduct.name} (published: ${firstProduct.published})`
					)
					// Логируем информацию о категории первого товара для диагностики
					if (firstProduct.category) {
						strapi.log.info(
							`[Product Controller] First product category: ${typeof firstProduct.category === 'object' ? firstProduct.category.name : firstProduct.category}`
						)
					}
					if (firstProduct.rootCategoryName) {
						strapi.log.info(
							`[Product Controller] First product rootCategoryName: ${firstProduct.rootCategoryName}`
						)
					}
				} else {
					strapi.log.warn(
						`[Product Controller] No products found. Total in DB: ${totalInDb}, Published: ${totalPublished}`
					)
					strapi.log.warn(
						`[Product Controller] Applied filters: ${JSON.stringify(filters, null, 2)}`
					)
				}

				// Подсчитываем общее количество товаров с примененными фильтрами
				// Примечание: total будет подсчитан до дедупликации, но это не критично
				// так как дедупликация происходит после получения данных
				const total = await strapi.entityService.count('api::product.product', {
					filters,
				})
				
				// Проверяем, правильно ли работает фильтр rootCategoryName
				if (filters.rootCategoryName) {
					// Делаем тестовый запрос для проверки
					const rootCategoryFilter = filters.rootCategoryName
					const testCount = await strapi.entityService.count('api::product.product', {
						filters: {
							published: true,
							rootCategoryName: rootCategoryFilter,
						},
					})
					const filterValue = typeof rootCategoryFilter === 'object' && rootCategoryFilter.$eq 
						? rootCategoryFilter.$eq 
						: JSON.stringify(rootCategoryFilter)
					strapi.log.info(
						`[Product Controller] Test count with rootCategoryName="${filterValue}": ${testCount}`
					)
				}

				// Дедупликация: группируем товары по model (CommerceML вариации).
				// Если model отсутствует — не группируем (каждый товар = отдельная карточка).
				// В каталоге показываем только один товар из группы (представитель)
				// Варианты будут подтягиваться при открытии страницы товара через findOne
				
				// Нормализуем модель для сравнения (trim, но сохраняем регистр)
				const normalizeModel = (model: string | null | undefined): string | null => {
					if (!model || typeof model !== 'string') return null
					return model.trim() || null
				}

				const productGroups = new Map<string, any>()

				for (const product of products) {
					const normalizedModel = normalizeModel(product.model)
					const groupKey = normalizedModel || `single-${product.id}`
					
					// Если группа еще не встречалась, добавляем товар как представитель
					if (!productGroups.has(groupKey)) {
						productGroups.set(groupKey, product)
					} else {
						// Если группа уже есть, заменяем только если текущий товар имеет stock > 0, а предыдущий нет
						const existingProduct = productGroups.get(groupKey)!
						if (product.stock && product.stock > 0 && (!existingProduct.stock || existingProduct.stock <= 0)) {
							productGroups.set(groupKey, product)
						}
					}
				}

				// Преобразуем Map в массив - получаем только представителей групп
				const uniqueProducts = Array.from(productGroups.values())

				strapi.log.info(
					`[Product Controller] After deduplication: ${uniqueProducts.length} unique products (grouped by model), before: ${products.length}`
				)

				// Применяем пагинацию после дедупликации
				products = uniqueProducts.slice(start, start + limit)

				// Нормализуем изображения для всех продуктов - всегда возвращаем массив
				const normalizedProducts = products.map((product: any) => {
					// Нормализуем images - всегда массив строк
					if (!product.images) {
						product.images = []
					} else if (typeof product.images === 'string') {
						// Если это строка, оборачиваем в массив
						product.images = [product.images]
					} else if (Array.isArray(product.images)) {
						// Фильтруем null/undefined значения
						product.images = product.images.filter(
							(img: any) => img !== null && img !== undefined && img !== ''
						)
					} else {
						// Если это объект или что-то другое, пытаемся преобразовать
						product.images = []
					}
					return product
				})

				// Пересчитываем total после дедупликации
				// Используем количество уникальных товаров для более точной пагинации
				const uniqueTotal = uniqueProducts.length

				// Логируем финальный ответ перед отправкой
				strapi.log.info(
					`[Product Controller] Sending response: ${normalizedProducts.length} products (page), unique total=${uniqueTotal}, original total=${total}`
				)

				ctx.body = {
					success: true,
					data: normalizedProducts,
					meta: {
						pagination: {
							page: Math.floor(start / limit) + 1,
							pageSize: limit,
							total: uniqueTotal,
							pageCount: Math.ceil(uniqueTotal / limit),
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
		 * Get product by ID
		 * GET /api/products/:id
		 */
		async findOne(ctx) {
			try {
				const { id } = ctx.params

				// Пробуем найти по id (может быть числом или строкой documentId)
				let product = await strapi.entityService.findOne(
					'api::product.product',
					id,
					{
						populate: '*',
					}
				)

				// Если не найдено и id - число, пробуем найти через query builder
				if (!product && !isNaN(Number(id))) {
					product = await strapi.db.query('api::product.product').findOne({
						where: { id: Number(id) },
					})
				}

				// Если все еще не найдено, пробуем найти по documentId через query builder
				if (!product) {
					product = await strapi.db.query('api::product.product').findOne({
						where: { documentId: id },
					})
				}

			if (!product) {
				ctx.status = 404
				ctx.body = {
					success: false,
					message: 'Product not found',
				}
				return
			}

			// Проверяем, что товар имеет stock > 0
			if (!product.stock || product.stock <= 0) {
				ctx.status = 404
				ctx.body = {
					success: false,
					message: 'Product out of stock',
				}
				return
			}

			// Получаем варианты товара (товары с тем же sbisNomNumber или article)
			const variants = await strapi
				.service('api::product.product')
				.findVariants(product)

			// Нормализуем изображения - всегда возвращаем массив
			if (!product.images) {
				product.images = []
			} else if (typeof product.images === 'string') {
				product.images = [product.images]
			} else if (Array.isArray(product.images)) {
				product.images = product.images.filter(
					(img: any) => img !== null && img !== undefined && img !== ''
				)
			} else {
				product.images = []
			}

			// Фильтруем варианты: убираем те, у которых stock = 0
			const availableVariants = (variants || []).filter(
				(variant: any) => variant.stock && variant.stock > 0
			)

			// Нормализуем изображения для вариантов
			const normalizedVariants = availableVariants.map((variant: any) => {
				if (!variant.images) {
					variant.images = []
				} else if (typeof variant.images === 'string') {
					variant.images = [variant.images]
				} else if (Array.isArray(variant.images)) {
					variant.images = variant.images.filter(
						(img: any) => img !== null && img !== undefined && img !== ''
					)
				} else {
					variant.images = []
				}
				return variant
			})

			ctx.body = {
				success: true,
				data: {
					...product,
					variants: normalizedVariants,
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
		 * Sync products from SBIS
		 * POST /api/products/sync-from-sbis
		 * Использует новый рекурсивный метод для получения всех товаров
		 */
		async syncFromSbis(ctx) {
			try {
				strapi.log.info('[Product Controller] Manual SBIS products sync requested')
				
				// Используем новый рекурсивный метод из сервиса sbis-sync
				const result = await strapi
					.service('api::sbis-sync.sbis-sync')
					.syncProducts()

				ctx.body = {
					success: true,
					...result,
				}
				return
			} catch (error: any) {
				strapi.log.error('[Product Controller] SBIS sync failed:', error.message)
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
					message: 'SBIS products sync failed',
				}
			}
		},

		/**
		 * Test SBIS authentication
		 * GET /api/products/test-sbis-auth
		 */
		async testSbisAuth(ctx) {
			try {
				strapi.log.info('Testing SBIS authentication')

				// SBIS configuration
				const config = {
					oauthUrl: 'https://online.sbis.ru/oauth/service/',
					appClientId: '7339792387629061',
					appSecret: 'TTLPJZWCFTFTYTWUYGVJFCFV',
					secretKey:
						'QqrGX48qxuP3BYCAD125C18NwRKQImkIaBysesIKWSjH0iB9pAaTei9jlnCRMO6AHvN1WEEPwoRfzkxXgsvBHSb5XYoH2h9fzqPko6FS9AuWOsv6i1pKhw',
					timeout: 30000,
				}

				// Make request to SBIS OAuth
				const axios = require('axios')
				const response = await axios.post(
					config.oauthUrl,
					{
						app_client_id: config.appClientId,
						app_secret: config.appSecret,
						secret_key: config.secretKey,
					},
					{
						headers: {
							'Content-Type': 'application/json',
						},
						timeout: config.timeout,
					}
				)

				const { access_token, sid, token } = response.data

				ctx.body = {
					success: true,
					data: {
						hasToken: !!access_token,
						tokenLength: access_token?.length || 0,
						sid: sid,
					},
					message: 'SBIS authentication successful',
				}
			} catch (error) {
				strapi.log.error('SBIS authentication test failed:', error.message)

				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
					message: 'SBIS authentication failed',
				}
			}
		},

		/**
		 * Clear all products from database
		 * DELETE /api/products/clear-all
		 */
		async clearAll(ctx) {
			try {
				strapi.log.warn('Clearing all products from database')

				const products = await strapi.entityService.findMany(
					'api::product.product',
					{
						filters: {},
					}
				)

				let deletedCount = 0
				for (const product of products) {
					await strapi.entityService.delete('api::product.product', product.id)
					deletedCount++
				}

				strapi.log.info(`Deleted ${deletedCount} products`)

				ctx.body = {
					success: true,
					message: `Successfully deleted ${deletedCount} products`,
					data: {
						deletedCount,
					},
				}
			} catch (error) {
				strapi.log.error('Failed to clear products:', error.message)

				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
					message: 'Failed to clear products',
				}
			}
		},

		/**
		 * Get popular products (хиты продаж)
		 * GET /api/products/popular?limit=15
		 */
		async getPopular(ctx) {
			try {
				const limit = Number(ctx.query.limit) || 15

				// Сначала пробуем найти товары с популярностью > 0 и stock > 0
				let products = await strapi.entityService.findMany(
					'api::product.product',
					{
						filters: {
							published: true,
							stock: {
								$gt: 0,
							},
							sbisPopularityScore: {
								$gt: 0,
							},
						},
						sort: 'sbisPopularityScore:desc',
						limit,
					}
				)

				// Если не нашли товары с популярностью, возвращаем любые опубликованные с stock > 0
				// сортируя по количеству продаж или просто по дате создания
				if (products.length === 0) {
					products = await strapi.entityService.findMany(
						'api::product.product',
						{
							filters: {
								published: true,
								stock: {
									$gt: 0,
								},
							},
							sort: ['sbisSalesCount:desc', 'createdAt:desc'],
							limit,
						}
					)
				}

				ctx.body = {
					success: true,
					data: products,
					meta: {
						count: products.length,
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
		 * Get new products (новинки)
		 * GET /api/products/new?limit=15
		 */
		async getNew(ctx) {
			try {
				const limit = Number(ctx.query.limit) || 15

				// Сначала пробуем найти товары, синхронизированные за последние 30 дней с stock > 0
				const thirtyDaysAgo = new Date()
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

				let products = await strapi.entityService.findMany(
					'api::product.product',
					{
						filters: {
							published: true,
							stock: {
								$gt: 0,
							},
							lastSyncAt: {
								$gte: thirtyDaysAgo.toISOString(),
							},
						},
						sort: 'lastSyncAt:desc',
						limit,
					}
				)

				// Если не нашли недавно синхронизированные товары,
				// возвращаем любые опубликованные с stock > 0, сортируя по дате создания (новые первыми)
				if (products.length === 0) {
					products = await strapi.entityService.findMany(
						'api::product.product',
						{
							filters: {
								published: true,
								stock: {
									$gt: 0,
								},
							},
							sort: 'createdAt:desc',
							limit,
						}
					)
				}

				ctx.body = {
					success: true,
					data: products,
					meta: {
						count: products.length,
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
		 * Прокси для загрузки изображений из SBIS
		 * GET /api/products/image-proxy?url=...
		 */
		async imageProxy(ctx: any) {
			try {
				const imageUrl = ctx.query.url

				if (!imageUrl || typeof imageUrl !== 'string') {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Missing or invalid url parameter',
					}
					return
				}

				// Проверяем, что URL принадлежит SBIS (безопасность)
				const allowedDomains = ['api.sbis.ru', 'disk.sbis.ru']
				let urlObj: URL
				try {
					urlObj = new URL(imageUrl)
				} catch {
					ctx.status = 400
					ctx.body = {
						success: false,
						error: 'Invalid URL format',
					}
					return
				}

				if (!allowedDomains.includes(urlObj.hostname)) {
					ctx.status = 403
					ctx.body = {
						success: false,
						error: 'URL not allowed',
					}
					return
				}

				// Загружаем изображение с SBIS
				const axios = require('axios')
				const response = await axios.get(imageUrl, {
					responseType: 'arraybuffer',
					timeout: 10000,
					headers: {
						'User-Agent': 'BorksSport-Backend/1.0',
					},
				})

				// Определяем content-type из ответа или по расширению файла
				let contentType = response.headers['content-type'] || 'image/jpeg'
				if (!contentType.startsWith('image/')) {
					// Пробуем определить по расширению
					const ext = imageUrl.split('.').pop()?.toLowerCase()
					const mimeTypes: Record<string, string> = {
						jpg: 'image/jpeg',
						jpeg: 'image/jpeg',
						png: 'image/png',
						webp: 'image/webp',
						gif: 'image/gif',
					}
					if (ext && mimeTypes[ext]) {
						contentType = mimeTypes[ext]
					}
				}

				// Устанавливаем заголовки и отправляем изображение
				ctx.set('Content-Type', contentType)
				ctx.set('Cache-Control', 'public, max-age=31536000') // Кешируем на год
				ctx.body = Buffer.from(response.data)
			} catch (error: any) {
				strapi.log.error('[Product Controller] Failed to proxy image:', error.message)
				ctx.status = error.response?.status || 500
				ctx.body = {
					success: false,
					error: 'Failed to load image',
				}
			}
		},
	})
)

