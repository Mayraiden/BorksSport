import type { Core } from '@strapi/strapi'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

export default ({ strapi }: { strapi: Core.Strapi }) => {
	const getConfig = () => {
		return {
			oauthUrl:
				process.env.SBIS_OAUTH_URL || 'https://online.sbis.ru/oauth/service/',
			apiUrl: process.env.SBIS_API_URL || 'https://api.sbis.ru/retail/v2',
			appClientId: process.env.SBIS_APP_CLIENT_ID || '',
			appSecret: process.env.SBIS_APP_SECRET || '',
			secretKey: process.env.SBIS_SECRET_KEY || '',
			pointId: parseInt(process.env.SBIS_POINT_ID || '201', 10),
			priceListId: parseInt(process.env.SBIS_PRICE_LIST_ID || '24', 10),
			timeout: parseInt(process.env.SBIS_TIMEOUT || '30000', 10),
		}
	}

	return {
		get config() {
			return getConfig()
		},

		async getAccessToken() {
			const response = await axios.post(
				this.config.oauthUrl,
				{
					app_client_id: this.config.appClientId,
					app_secret: this.config.appSecret,
					secret_key: this.config.secretKey,
				},
				{
					headers: { 'Content-Type': 'application/json' },
					timeout: this.config.timeout,
				}
			)
			const { access_token, sid, token } = response.data
			return { accessToken: access_token, sid, token }
		},

		async clearProducts() {
			const beforeCount = await strapi.entityService.count(
				'api::product.product'
			)
			const result = await strapi.db
				.query('api::product.product')
				.deleteMany({ where: {} })
			const deleted = typeof result === 'number' ? result : (result?.count ?? 0)
			const afterCount = await strapi.entityService.count(
				'api::product.product'
			)
			return { before: beforeCount, deleted, after: afterCount }
		},

		async clearCategories() {
			const beforeCount = await strapi.entityService.count(
				'api::category.category'
			)
			const result = await strapi.db
				.query('api::category.category')
				.deleteMany({ where: {} })
			const deleted = typeof result === 'number' ? result : (result?.count ?? 0)
			const afterCount = await strapi.entityService.count(
				'api::category.category'
			)
			return { before: beforeCount, deleted, after: afterCount }
		},

		async clearAll() {
			const productsResult = await this.clearProducts()
			const categoriesResult = await this.clearCategories()
			return {
				products: productsResult,
				categories: categoriesResult,
				message: 'All products and categories cleared',
			}
		},

		async fetchProducts(accessToken: string, page = 0, pageSize = 100) {
			const response = await axios.get(
				`${this.config.apiUrl}/nomenclature/list`,
				{
					params: {
						pointID: this.config.pointId,
						priceListId: this.config.priceListId,
						page,
						pageSize,
					},
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					timeout: this.config.timeout,
				}
			)
			const { nomenclatures, outcome } = response.data
			return { items: nomenclatures, hasMore: outcome.hasMore, page, pageSize }
		},

		async getSampleProducts(count = 5, includeCategories = true) {
			const { accessToken } = await this.getAccessToken()
			// Берем больше товаров с нескольких страниц
			const allItems: any[] = []
			let page = 0
			const maxPages = 5 // Проверяем первые 5 страниц

			while (page < maxPages && allItems.length < count * 20) {
				const result = await this.fetchProducts(accessToken, page, 100)
				allItems.push(...result.items)
				if (!result.hasMore) break
				page++
			}

			// Разделяем на товары и категории
			const products = allItems.filter(
				(item: any) => !item.isParent && item.published && item.id !== null
			)
			const categories = allItems.filter((item: any) => item.isParent === true)

			// Приоритетно возвращаем товары с модификаторами
			const withModifiers = products.filter(
				(p: any) =>
					p.modifiers && Array.isArray(p.modifiers) && p.modifiers.length > 0
			)
			const withoutModifiers = products.filter(
				(p: any) =>
					!p.modifiers ||
					!Array.isArray(p.modifiers) ||
					p.modifiers.length === 0
			)

			// Группируем товары по hierarchicalParent для поиска вариантов
			const productsByParent = new Map<number, any[]>()
			products.forEach((p: any) => {
				const parentId = p.hierarchicalParent
				if (parentId) {
					if (!productsByParent.has(parentId)) {
						productsByParent.set(parentId, [])
					}
					productsByParent.get(parentId)!.push(p)
				}
			})

			// Находим товары, у которых есть "братья" с тем же родителем (возможно варианты)
			const productsWithSiblings = products.filter((p: any) => {
				if (!p.hierarchicalParent) return false
				const siblings = productsByParent.get(p.hierarchicalParent)
				return siblings && siblings.length > 1
			})

			// Сначала товары с модификаторами, потом с братьями, потом остальные
			const sorted = [
				...withModifiers,
				...productsWithSiblings.filter((p) => !withModifiers.includes(p)),
				...withoutModifiers.filter((p) => !productsWithSiblings.includes(p)),
			]

			return {
				products: sorted.slice(0, count),
				allProducts: products,
				categories: includeCategories ? categories.slice(0, 10) : [],
				productsByParent: Array.from(productsByParent.entries())
					.filter(([_, items]) => items.length > 1)
					.slice(0, 5)
					.map(([parentId, items]) => ({
						parentId,
						products: items.slice(0, 5), // Первые 5 товаров из группы
						count: items.length,
					})),
			}
		},

		/**
		 * Получить все товары и категории через правильную пагинацию
		 * Использует position и order для пагинации (не для фильтрации по категориям)
		 * Согласно документации: https://saby.ru/help/integration/api/app_sale/sale_delyvery/catalog?tb=tab2
		 */
		async getAllProductsRecursively() {
			const { accessToken } = await this.getAccessToken()
			const startTime = Date.now()

			// Собираем все элементы через пагинацию
			const allItems: any[] = []
			let position: number | null = null
			let hasMore = true
			let pageNumber = 0

			strapi.log.info('[SBIS Sync] Starting pagination-based product fetch...')
			strapi.log.info(
				'[SBIS Sync] Using pageSize=1000 (maximum) for optimal performance'
			)

			// Создаем директорию для логов, если не существует
			const logsDir = path.join(process.cwd(), 'logs', 'sbis-sync')
			if (!fs.existsSync(logsDir)) {
				fs.mkdirSync(logsDir, { recursive: true })
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			const logFilePath = path.join(logsDir, `sbis-response-${timestamp}.json`)

			// Массив для хранения всех ответов
			const allResponses: any[] = []

			// Пагинация: получаем все элементы через position и order
			// Продолжаем запросы даже если hasMore=false, пока не получим пустой ответ
			while (hasMore || pageNumber === 0) {
				try {
					const params: any = {
						pointID: this.config.pointId,
						priceListId: this.config.priceListId, // Возвращаем priceListId: 24
						pageSize: 1000, // Максимальный размер страницы согласно документации
						withBalance: false, // Получаем ВСЕ товары, не только с остатками
						withBarcode: true,
					}

					// Для последующих страниц используем position (hierarchicalId последнего элемента)
					if (position !== null) {
						params.position = position
						params.order = 'after' // Записи после указанной позиции
					}

					strapi.log.info(
						`[SBIS Sync] Fetching page ${pageNumber + 1}${position ? ` (position=${position})` : ' (first page)'}...`
					)

					const response = await axios.get(
						`${this.config.apiUrl}/nomenclature/list`,
						{
							params,
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json',
							},
							timeout: this.config.timeout,
						}
					)

					const { nomenclatures, outcome } = response.data

					// Обрабатываем случай, когда nomenclatures может быть объектом {} вместо массива
					let nomenclaturesArray: any[] = []
					if (Array.isArray(nomenclatures)) {
						nomenclaturesArray = nomenclatures
					} else if (nomenclatures && typeof nomenclatures === 'object') {
						// Если это объект (например, {}), значит данных больше нет
						nomenclaturesArray = []
						strapi.log.info(
							`[SBIS Sync] Page ${pageNumber + 1}: nomenclatures is an object (not array), treating as empty`
						)
					} else {
						strapi.log.warn(
							`[SBIS Sync] Invalid response format on page ${pageNumber + 1}`
						)
						strapi.log.warn(
							`[SBIS Sync] Response data:`,
							JSON.stringify(response.data, null, 2)
						)
						break
					}

					// Сохраняем полный ответ для анализа
					const responseData = {
						page: pageNumber + 1,
						params: params,
						response: {
							nomenclaturesCount: nomenclaturesArray.length,
							nomenclaturesType: Array.isArray(nomenclatures)
								? 'array'
								: typeof nomenclatures,
							outcome: outcome,
							outcomeKeys: outcome ? Object.keys(outcome) : [],
							outcomeFull: JSON.parse(JSON.stringify(outcome)), // Глубокая копия
							responseKeys: Object.keys(response.data),
							fullResponse: response.data, // Полный ответ
						},
					}
					allResponses.push(responseData)

					// Детальное логирование структуры outcome
					strapi.log.info(
						`[SBIS Sync] Page ${pageNumber + 1} - Outcome structure:`,
						JSON.stringify(
							{
								hasMore: outcome?.hasMore,
								hasMoreType: typeof outcome?.hasMore,
								outcomeKeys: outcome ? Object.keys(outcome) : [],
								outcomeFull: outcome,
							},
							null,
							2
						)
					)

					// Логируем все ключи ответа
					strapi.log.info(
						`[SBIS Sync] Page ${pageNumber + 1} - Response keys:`,
						Object.keys(response.data).join(', ')
					)

					if (nomenclaturesArray.length === 0) {
						strapi.log.info(
							`[SBIS Sync] No items on page ${pageNumber + 1}, stopping pagination`
						)
						hasMore = false
						break
					}

					allItems.push(...nomenclaturesArray)

					// Берем hierarchicalId последнего элемента для следующей страницы
					const lastItem = nomenclaturesArray[nomenclaturesArray.length - 1]
					position = lastItem.hierarchicalId

					// Проверяем hasMore
					const reportedHasMore = outcome?.hasMore === true

					// Используем ту же логику фильтрации, что и в основном коде
					const productsInPage = nomenclaturesArray.filter((i: any) => {
						const isNotCategory =
							!i.isParent || i.isParent === false || i.isParent === 0
						const hasId = i.id !== null && i.id !== undefined
						return isNotCategory && hasId
					}).length
					strapi.log.info(
						`[SBIS Sync] Page ${pageNumber + 1}: received ${nomenclaturesArray.length} items`
					)

					pageNumber++

					// Защита от бесконечного цикла
					if (pageNumber > 100) {
						strapi.log.warn(
							'[SBIS Sync] Reached maximum pages limit (100), stopping'
						)
						break
					}

					// Определяем, продолжать ли пагинацию
					// ВАЖНО: hasMore может быть неточным, поэтому продолжаем запросы пока получаем данные
					// Останавливаемся только когда получили пустой ответ (nomenclatures.length === 0)
					hasMore = reportedHasMore || nomenclaturesArray.length > 0
				} catch (error: any) {
					strapi.log.error(
						`[SBIS Sync] Error fetching page ${pageNumber + 1}:`,
						error.message
					)
					break
				}
			}

			strapi.log.info(
				`[SBIS Sync] Fetched ${allItems.length} total items in ${pageNumber} pages`
			)

			// Разделяем на категории и товары
			const categories = allItems.filter(
				(item: any) => item.isParent === true || item.isParent === 1
			)
			const products = allItems.filter((item: any) => {
				const isNotCategory =
					!item.isParent || item.isParent === false || item.isParent === 0
				const hasId = item.id !== null && item.id !== undefined
				return isNotCategory && hasId
			})

			// Строим дерево категорий и определяем уровни
			const categoryMap = new Map<number, any>()
			const categoryLevelMap = new Map<number, number>() // hierarchicalId -> level

			// Сначала создаем мапу всех категорий
			for (const category of categories) {
				categoryMap.set(category.hierarchicalId, category)
			}

			// Функция для определения уровня категории (рекурсивно)
			const getCategoryLevel = (
				hierarchicalId: number,
				visited = new Set<number>()
			): number => {
				if (visited.has(hierarchicalId)) {
					// Циклическая ссылка - возвращаем 0
					return 0
				}
				visited.add(hierarchicalId)

				if (categoryLevelMap.has(hierarchicalId)) {
					return categoryLevelMap.get(hierarchicalId)!
				}

				const category = categoryMap.get(hierarchicalId)
				if (!category || !category.hierarchicalParent) {
					// Корневая категория
					categoryLevelMap.set(hierarchicalId, 0)
					return 0
				}

				const parentLevel = getCategoryLevel(
					category.hierarchicalParent,
					visited
				)
				const level = parentLevel + 1
				categoryLevelMap.set(hierarchicalId, level)
				return level
			}

			// Определяем уровни для всех категорий
			for (const category of categories) {
				const level = getCategoryLevel(category.hierarchicalId)
				category.level = level
			}

			// Функция для поиска корневой категории (Level 0)
			const findRootCategory = (
				hierarchicalId: number,
				visited = new Set<number>()
			): number | null => {
				if (visited.has(hierarchicalId)) {
					return null
				}
				visited.add(hierarchicalId)

				const category = categoryMap.get(hierarchicalId)
				if (!category) {
					return null
				}

				if (category.level === 0) {
					return hierarchicalId
				}

				if (category.hierarchicalParent) {
					return findRootCategory(category.hierarchicalParent, visited)
				}

				return null
			}

			// Привязываем товары к категориям
			const processedProductIds = new Set<number>()
			const enrichedProducts: any[] = []
			const rootCategoryStats = new Map<string, number>() // Статистика по корневым категориям
			const productsWithoutRootCategory: any[] = [] // Товары без корневой категории
			const sportTypeStats = new Map<string, number>() // Статистика по атрибуту "Вид спорта"

			for (const product of products) {
				// Дедупликация по ID товара
				if (processedProductIds.has(product.id)) {
					continue
				}
				processedProductIds.add(product.id)

				// Проверяем атрибут "Вид спорта" для определения корневой категории
				const attributes = product.attributes || {}
				const sportType =
					attributes['Вид спорта'] || attributes['Вид спорт'] || null

				// Собираем статистику по атрибуту "Вид спорта"
				if (sportType) {
					sportTypeStats.set(
						sportType,
						(sportTypeStats.get(sportType) || 0) + 1
					)
				}

				// Нормализуем значение атрибута "Вид спорта" для сопоставления с корневыми категориями
				let normalizedSportType: string | null = null
				if (sportType) {
					const sportTypeLower = sportType.toLowerCase().trim()
					// Маппинг различных вариантов названий на стандартные корневые категории
					if (
						sportTypeLower.includes('хоккей на траве') ||
						sportTypeLower === 'хоккей на траве'
					) {
						normalizedSportType = 'Хоккей на траве'
					} else if (
						sportTypeLower.includes('бейсбол') ||
						sportTypeLower.includes('софтбол') ||
						sportTypeLower.includes('baseball') ||
						sportTypeLower.includes('softball')
					) {
						normalizedSportType = 'Бейсбол и Софтбол'
					}
				}

				// Находим категорию товара
				if (product.hierarchicalParent) {
					const category = categoryMap.get(product.hierarchicalParent)
					if (category) {
						product.categorySbisId = product.hierarchicalParent
						product.categoryName = category.name

						// Находим корневую категорию через hierarchicalParent
						const rootCategoryId = findRootCategory(product.hierarchicalParent)
						if (rootCategoryId) {
							const rootCategory = categoryMap.get(rootCategoryId)
							if (rootCategory) {
								// Если есть атрибут "Вид спорта" и он не совпадает с корневой категорией из hierarchicalParent,
								// используем атрибут как приоритетный источник
								if (
									normalizedSportType &&
									normalizedSportType !== rootCategory.name
								) {
									// Ищем корневую категорию по атрибуту "Вид спорта"
									const sportCategory = Array.from(categoryMap.values()).find(
										(c) => c.level === 0 && c.name === normalizedSportType
									)
									if (sportCategory) {
										product.rootCategorySbisId = sportCategory.hierarchicalId
										product.rootCategoryName = sportCategory.name
										const rootName = sportCategory.name || 'Unknown'
										rootCategoryStats.set(
											rootName,
											(rootCategoryStats.get(rootName) || 0) + 1
										)
									} else {
										// Если категория по атрибуту не найдена, используем категорию из hierarchicalParent
										product.rootCategorySbisId = rootCategoryId
										product.rootCategoryName = rootCategory.name
										const rootName = rootCategory.name || 'Unknown'
										rootCategoryStats.set(
											rootName,
											(rootCategoryStats.get(rootName) || 0) + 1
										)
									}
								} else {
									// Используем корневую категорию из hierarchicalParent
									product.rootCategorySbisId = rootCategoryId
									product.rootCategoryName = rootCategory.name

									// Собираем статистику
									const rootName = rootCategory.name || 'Unknown'
									rootCategoryStats.set(
										rootName,
										(rootCategoryStats.get(rootName) || 0) + 1
									)
								}
							} else {
								// Если rootCategoryId найден, но категория не найдена в мапе,
								// пробуем использовать атрибут "Вид спорта"
								if (sportType) {
									const sportCategory = Array.from(categoryMap.values()).find(
										(c) => c.level === 0 && c.name === sportType
									)
									if (sportCategory) {
										product.rootCategorySbisId = sportCategory.hierarchicalId
										product.rootCategoryName = sportCategory.name
										const rootName = sportCategory.name || 'Unknown'
										rootCategoryStats.set(
											rootName,
											(rootCategoryStats.get(rootName) || 0) + 1
										)
									} else {
										productsWithoutRootCategory.push({
											id: product.id,
											name: product.name,
											categoryName: category.name,
											rootCategoryId: rootCategoryId,
											sportType: sportType,
											reason:
												'Root category not found, sportType also not found',
										})
									}
								} else {
									productsWithoutRootCategory.push({
										id: product.id,
										name: product.name,
										categoryName: category.name,
										rootCategoryId: rootCategoryId,
									})
								}
							}
						} else {
							// Если rootCategoryId не найден, пробуем использовать атрибут "Вид спорта"
							if (sportType) {
								const sportCategory = Array.from(categoryMap.values()).find(
									(c) => c.level === 0 && c.name === sportType
								)
								if (sportCategory) {
									product.rootCategorySbisId = sportCategory.hierarchicalId
									product.rootCategoryName = sportCategory.name
									const rootName = sportCategory.name || 'Unknown'
									rootCategoryStats.set(
										rootName,
										(rootCategoryStats.get(rootName) || 0) + 1
									)
								} else {
									productsWithoutRootCategory.push({
										id: product.id,
										name: product.name,
										categoryName: category.name,
										hierarchicalParent: product.hierarchicalParent,
										sportType: sportType,
										reason:
											'Root category not found, sportType category not found',
									})
								}
							} else {
								productsWithoutRootCategory.push({
									id: product.id,
									name: product.name,
									categoryName: category.name,
									hierarchicalParent: product.hierarchicalParent,
								})
							}
						}
					} else {
						// Категория не найдена в мапе, пробуем использовать атрибут "Вид спорта"
						if (sportType) {
							const sportCategory = Array.from(categoryMap.values()).find(
								(c) => c.level === 0 && c.name === sportType
							)
							if (sportCategory) {
								product.rootCategorySbisId = sportCategory.hierarchicalId
								product.rootCategoryName = sportCategory.name
								const rootName = sportCategory.name || 'Unknown'
								rootCategoryStats.set(
									rootName,
									(rootCategoryStats.get(rootName) || 0) + 1
								)
							} else {
								productsWithoutRootCategory.push({
									id: product.id,
									name: product.name,
									hierarchicalParent: product.hierarchicalParent,
									sportType: sportType,
									reason:
										'Category not found in map, sportType category not found',
								})
							}
						} else {
							productsWithoutRootCategory.push({
								id: product.id,
								name: product.name,
								hierarchicalParent: product.hierarchicalParent,
								reason: 'Category not found in map',
							})
						}
					}
				} else {
					// Товар без родительской категории
					// Пытаемся определить корневую категорию по названию товара
					let guessedRootCategory: string | null = null

					// Простая эвристика: ищем ключевые слова в названии
					const productName = (product.name || '').toLowerCase()
					if (
						productName.includes('хоккей') ||
						productName.includes('hockey')
					) {
						guessedRootCategory = 'Хоккей на траве'
					} else if (
						productName.includes('бейсбол') ||
						productName.includes('baseball') ||
						productName.includes('софтбол') ||
						productName.includes('softball')
					) {
						guessedRootCategory = 'Бейсбол и Софтбол'
					}

					if (guessedRootCategory) {
						// Находим категорию по имени
						const rootCategory = Array.from(categoryMap.values()).find(
							(c) => c.level === 0 && c.name === guessedRootCategory
						)
						if (rootCategory) {
							product.rootCategorySbisId = rootCategory.hierarchicalId
							product.rootCategoryName = rootCategory.name

							// Собираем статистику
							const rootName = rootCategory.name || 'Unknown'
							rootCategoryStats.set(
								rootName,
								(rootCategoryStats.get(rootName) || 0) + 1
							)
						} else {
							productsWithoutRootCategory.push({
								id: product.id,
								name: product.name,
								reason: 'No hierarchicalParent, guessed but not found',
								guessedCategory: guessedRootCategory,
							})
						}
					} else {
						productsWithoutRootCategory.push({
							id: product.id,
							name: product.name,
							reason: 'No hierarchicalParent, cannot guess',
						})
					}
				}

				enrichedProducts.push(product)
			}

			const elapsedTime = Date.now() - startTime

			// Статистика по уровням категорий
			const levelStats = new Map<number, number>()
			for (const category of categories) {
				const level = category.level || 0
				levelStats.set(level, (levelStats.get(level) || 0) + 1)
			}
			const maxLevel = Math.max(...Array.from(levelStats.keys()), 0)

			// Статистика по корневым категориям
			const distribution = Array.from(rootCategoryStats.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([name, count]) => `${name}: ${count}`)
				.join(', ')

			strapi.log.info(
				`[SBIS Sync] Completed: ${enrichedProducts.length} unique products, ${categories.length} categories in ${Math.round(elapsedTime / 1000)}s`
			)
			if (distribution) {
				strapi.log.info(
					`[SBIS Sync] Products by root category: ${distribution}`
				)
			}

			return {
				products: enrichedProducts,
				categories: Array.from(categoryMap.values()),
				stats: {
					productsCount: enrichedProducts.length,
					categoriesCount: categories.length,
					maxReachedLevel: maxLevel,
					elapsedTime: Math.round(elapsedTime / 1000),
					pagesFetched: pageNumber,
					totalItems: allItems.length,
				},
			}
		},

		/**
		 * Старый метод - оставлен для обратной совместимости
		 * @deprecated Используйте getAllProductsRecursively()
		 */
		async getAllProducts() {
			const { accessToken } = await this.getAccessToken()
			const allProducts: any[] = []
			let page = 0
			let hasMore = true
			let firstProductLogged = false
			while (hasMore) {
				const result = await this.fetchProducts(accessToken, page, 100)
				const products = result.items.filter(
					(item: any) => !item.isParent && item.published && item.id !== null
				)

				// Логируем структуру первого товара для анализа полей
				if (products.length > 0 && !firstProductLogged) {
					const firstProduct = products[0]
					strapi.log.info('=== SBIS PRODUCT STRUCTURE ANALYSIS ===')
					strapi.log.info(
						'All keys in product object:',
						Object.keys(firstProduct)
					)
					strapi.log.info(
						'Full product structure:',
						JSON.stringify(firstProduct, null, 2)
					)

					// Проверяем наличие полей, связанных с цветом и размером
					const colorSizeFields = [
						'color',
						'colors',
						'Color',
						'Colors',
						'size',
						'sizes',
						'Size',
						'Sizes',
						'variant',
						'variants',
						'Variant',
						'Variants',
						'attributes',
						'characteristics',
						'properties',
						'options',
						'modifications',
					]
					const foundFields: string[] = []
					colorSizeFields.forEach((field) => {
						if (firstProduct.hasOwnProperty(field)) {
							foundFields.push(field)
							strapi.log.info(
								`Found field "${field}":`,
								JSON.stringify(firstProduct[field], null, 2)
							)
						}
					})
					if (foundFields.length === 0) {
						strapi.log.warn(
							'No color/size related fields found in product structure'
						)
					}
					firstProductLogged = true
				}

				allProducts.push(...products)
				hasMore = result.hasMore
				page++
			}
			return allProducts
		},

		/**
		 * Сохранить категории в Strapi
		 * @returns Объект со статистикой и мапой для связи sbisId -> strapiId
		 */
		async saveCategories(categories: any[]) {
			let savedCount = 0
			let updatedCount = 0

			// Сначала создаем все категории без связей
			// ID в Strapi может быть number или string
			const categoryStrapiIdMap = new Map<number, number | string>()

			for (const categoryData of categories) {
				try {
					const existingCategory = await strapi.entityService.findMany(
						'api::category.category',
						{ filters: { sbisId: categoryData.hierarchicalId } }
					)

					// ID в Strapi может быть number или string
					let categoryStrapiId: number | string
					if (existingCategory.length > 0) {
						categoryStrapiId = existingCategory[0].id
						updatedCount++
					} else {
						const category = await strapi.entityService.create(
							'api::category.category',
							{
								data: {
									name: categoryData.name,
									sbisId: categoryData.hierarchicalId,
									sbisParentId: categoryData.hierarchicalParent,
									isActive: true,
									level: categoryData.level || 0,
								},
							}
						)
						categoryStrapiId = category.id
						savedCount++
					}
					categoryStrapiIdMap.set(categoryData.hierarchicalId, categoryStrapiId)
				} catch (error: any) {
					strapi.log.error(
						`[SBIS Sync] Failed to save category ${categoryData.name}:`,
						error.message
					)
				}
			}

			// Затем устанавливаем связи parent-child
			for (const categoryData of categories) {
				if (categoryData.hierarchicalParent) {
					const categoryStrapiId = categoryStrapiIdMap.get(
						categoryData.hierarchicalId
					)
					const parentStrapiId = categoryStrapiIdMap.get(
						categoryData.hierarchicalParent
					)

					if (categoryStrapiId && parentStrapiId) {
						try {
							await strapi.entityService.update(
								'api::category.category',
								categoryStrapiId,
								{
									data: {
										parent: parentStrapiId,
									},
								}
							)
						} catch (error: any) {
							strapi.log.error(
								`[SBIS Sync] Failed to set parent for category ${categoryData.name}:`,
								error.message
							)
						}
					}
				}
			}

			return {
				saved: savedCount,
				updated: updatedCount,
				total: categories.length,
				categoryStrapiIdMap, // Возвращаем мапу для использования в saveProducts
			}
		},

		async saveProducts(
			products: any[],
			categoryStrapiIdMap?: Map<number, number | string>
		) {
			let savedCount = 0
			let updatedCount = 0

			for (const productData of products) {
				try {
					const existingProduct = await strapi.entityService.findMany(
						'api::product.product',
						{ filters: { sbisId: productData.id } }
					)

					// Извлекаем размер и цвет из атрибутов
					const attributes = productData.attributes || {}
					const size = attributes['Размер'] || attributes['size'] || null
					const color = attributes['Цвет'] || attributes['color'] || null

					// Находим категорию для товара
					let categoryStrapiId = null
					if (categoryStrapiIdMap && productData.categorySbisId) {
						categoryStrapiId =
							categoryStrapiIdMap.get(productData.categorySbisId) || null
					}

					const productPayload: any = {
						name: productData.name,
						description: productData.description,
						price: productData.cost,
						article: productData.article,
						unit: productData.unit,
						length:
							productData.length ??
							productData.Length ??
							productData.dimensions?.length ??
							null,
						width:
							productData.width ??
							productData.Width ??
							productData.dimensions?.width ??
							null,
						height:
							productData.height ??
							productData.Height ??
							productData.dimensions?.height ??
							null,
						weight:
							productData.weight ??
							productData.Weight ??
							productData.dimensions?.weight ??
							null,
						images: productData.images,
						// Всегда устанавливаем published: true по умолчанию для всех товаров из SBIS
						// Товары из прайс-листа должны быть доступны на сайте
						// Если товар не должен быть опубликован, это можно изменить вручную в админке
						published: true,
						sbisId: productData.id,
						sbisExternalId: productData.externalId,
						sbisNomNumber: productData.nomNumber,
						categoryName:
							productData.categoryName ||
							(productData.hierarchicalParent ? 'Unknown' : 'Root'),
						rootCategoryName: productData.rootCategoryName || null,
						lastSyncAt: new Date(),
						size: size,
						color: color,
					}

					// Связываем с категорией, если найдена
					if (categoryStrapiId) {
						productPayload.category = categoryStrapiId
					}

					if (existingProduct.length > 0) {
						await strapi.entityService.update(
							'api::product.product',
							existingProduct[0].id,
							{ data: productPayload }
						)
						updatedCount++
					} else {
						await strapi.entityService.create('api::product.product', {
							data: productPayload,
						})
						savedCount++
					}
				} catch (error: any) {
					strapi.log.error(
						`[SBIS Sync] Failed to save product ${productData.name}:`,
						error.message
					)
				}
			}
			return {
				saved: savedCount,
				updated: updatedCount,
				total: products.length,
			}
		},

		/**
		 * Опубликовать все товары (установить published: true)
		 * Используется для исправления товаров, которые были синхронизированы с published: false
		 */
		async publishAllProducts() {
			try {
				strapi.log.info('[SBIS Sync] Publishing all products...')

				const allProducts = await strapi.entityService.findMany(
					'api::product.product',
					{
						filters: { published: false },
						limit: -1, // Получить все
					}
				)

				let publishedCount = 0
				for (const product of allProducts) {
					try {
						await strapi.entityService.update(
							'api::product.product',
							product.id,
							{
								data: { published: true },
							}
						)
						publishedCount++
					} catch (error: any) {
						strapi.log.error(
							`[SBIS Sync] Failed to publish product ${product.id}:`,
							error.message
						)
					}
				}

				strapi.log.info(`[SBIS Sync] Published ${publishedCount} products`)

				return {
					success: true,
					message: `Published ${publishedCount} products`,
					published: publishedCount,
					total: allProducts.length,
				}
			} catch (error: any) {
				strapi.log.error(
					'[SBIS Sync] Failed to publish products:',
					error.message
				)
				throw error
			}
		},

		/**
		 * Синхронизация товаров через правильную пагинацию
		 * Использует position и order для пагинации (не для фильтрации по категориям)
		 * См. документацию: SBIS_API_DOCUMENTATION.md
		 */
		async syncProducts() {
			try {
				strapi.log.info('[SBIS Sync] Starting products synchronization...')

				// Получаем все товары и категории через правильную пагинацию
				const result = await this.getAllProductsRecursively()
				const { products, categories, stats } = result

				// Сохраняем категории
				const categoriesResult = await this.saveCategories(categories)

				// Сохраняем товары (используем мапу из saveCategories)
				const productsResult = await this.saveProducts(
					products,
					categoriesResult.categoryStrapiIdMap
				)

				strapi.log.info(
					`[SBIS Sync] Synchronization completed: ${productsResult.saved} new products, ${productsResult.updated} updated products, ${categoriesResult.saved} new categories, ${categoriesResult.updated} updated categories`
				)

				return {
					success: true,
					message: 'Products synced successfully',
					stats: {
						products: productsResult,
						categories: categoriesResult,
						fetch: stats,
					},
				}
			} catch (error: any) {
				strapi.log.error('[SBIS Sync] Sync failed:', error.message)
				throw error
			}
		},

		/**
		 * Получить продажи из СБИС для анализа структуры данных
		 * @param fromDate - Дата начала в формате YYYY-MM-DD hh:mm:ss
		 * @param toDate - Дата окончания (опционально)
		 * @param page - Номер страницы (по умолчанию 0)
		 * @param pageSize - Размер страницы (по умолчанию 30)
		 */
		async fetchSales(
			fromDate: string,
			toDate?: string,
			page = 0,
			pageSize = 30
		) {
			try {
				const { accessToken } = await this.getAccessToken()

				// URL для продаж отличается от товаров - без /v2
				const salesApiUrl = 'https://api.sbis.ru/retail/order/list'

				const params: any = {
					pointId: this.config.pointId,
					fromDateTime: fromDate,
					page,
					pageSize,
				}

				if (toDate) {
					params.toDateTime = toDate
				}

				strapi.log.info('Fetching sales from SBIS:', {
					url: salesApiUrl,
					params,
				})

				const response = await axios.get(salesApiUrl, {
					params,
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					timeout: this.config.timeout,
				})

				const orders = response.data?.orders || []

				// Логируем структуру для анализа
				if (orders.length > 0) {
					const firstOrder = orders[0]
					strapi.log.info('=== SBIS SALES STRUCTURE ANALYSIS ===')
					strapi.log.info('Total orders received:', orders.length)
					strapi.log.info('First order keys:', Object.keys(firstOrder))
					strapi.log.info(
						'First order structure:',
						JSON.stringify(firstOrder, null, 2)
					)

					// Анализируем позиции продажи
					if (
						firstOrder.SaleNomenclatures &&
						Array.isArray(firstOrder.SaleNomenclatures)
					) {
						const firstPosition = firstOrder.SaleNomenclatures[0]
						if (firstPosition) {
							strapi.log.info('=== SALE POSITION STRUCTURE ===')
							strapi.log.info(
								'First position keys:',
								Object.keys(firstPosition)
							)
							strapi.log.info(
								'First position structure:',
								JSON.stringify(firstPosition, null, 2)
							)

							// Проверяем ключевые поля для статистики
							const keyFields = [
								'Nomenclature',
								'Quantity',
								'TotalPrice',
								'CheckSum',
								'CheckPrice',
								'IsReturn',
								'DateWTZ',
							]

							const foundFields: Record<string, any> = {}
							keyFields.forEach((field) => {
								if (firstPosition.hasOwnProperty(field)) {
									foundFields[field] = firstPosition[field]
								}
							})

							strapi.log.info(
								'Key fields for statistics:',
								JSON.stringify(foundFields, null, 2)
							)
						}
					}
				}

				return {
					orders,
					total: orders.length,
					page,
					pageSize,
					hasMore: orders.length === pageSize, // Предполагаем, что если получили полную страницу, есть еще
				}
			} catch (error: any) {
				strapi.log.error('Failed to fetch sales from SBIS:', {
					message: error.message,
					response: error.response?.data,
					status: error.response?.status,
				})
				throw error
			}
		},

		/**
		 * Получить все продажи за период (с пагинацией)
		 */
		async getAllSales(fromDate: string, toDate?: string) {
			const allOrders: any[] = []
			let page = 0
			const pageSize = 100 // Максимальный размер страницы для быстрой загрузки
			let hasMore = true

			while (hasMore) {
				const result = await this.fetchSales(fromDate, toDate, page, pageSize)
				allOrders.push(...result.orders)
				hasMore = result.hasMore && result.orders.length > 0
				page++

				// Защита от бесконечного цикла
				if (page > 100) {
					strapi.log.warn('Reached maximum pages limit (100) for sales fetch')
					break
				}
			}

			return allOrders
		},

		/**
		 * Синхронизировать статистику продаж из СБИС в товары Strapi
		 * @param days - Количество дней назад для анализа (по умолчанию 30)
		 */
		async syncSalesStatistics(days = 30) {
			try {
				strapi.log.info(`Starting sales statistics sync for last ${days} days`)

				// Формируем даты
				const toDate = new Date()
				const fromDate = new Date()
				fromDate.setDate(fromDate.getDate() - days)

				// Форматируем даты в формат СБИС: YYYY-MM-DD hh:mm:ss
				const formatDate = (date: Date) => {
					const year = date.getFullYear()
					const month = String(date.getMonth() + 1).padStart(2, '0')
					const day = String(date.getDate()).padStart(2, '0')
					const hours = String(date.getHours()).padStart(2, '0')
					const minutes = String(date.getMinutes()).padStart(2, '0')
					const seconds = String(date.getSeconds()).padStart(2, '0')
					return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
				}

				const fromDateTime = formatDate(fromDate)
				const toDateTime = formatDate(toDate)

				// Получаем все продажи за период
				const allOrders = await this.getAllSales(fromDateTime, toDateTime)
				strapi.log.info(`Fetched ${allOrders.length} orders from SBIS`)

				// Фильтруем валидные заказы (не удаленные)
				const validOrders = allOrders.filter((order: any) => !order.Deleted)

				// Собираем все позиции из всех валидных заказов
				const allPositions: any[] = []
				validOrders.forEach((order: any) => {
					if (
						order.SaleNomenclatures &&
						Array.isArray(order.SaleNomenclatures)
					) {
						allPositions.push(...order.SaleNomenclatures)
					}
				})

				// Фильтруем позиции: исключаем возвраты
				const validPositions = allPositions.filter((pos: any) => !pos.IsReturn)

				strapi.log.info(`Found ${validPositions.length} valid positions`)

				// Агрегируем статистику по товарам (группируем по Nomenclature)
				const nomenclatureStats = new Map<
					number,
					{
						nomenclatureId: number
						salesCount: number
						totalQuantity: number
						totalRevenue: number
						lastSoldAt: string
					}
				>()

				validPositions.forEach((pos: any) => {
					if (pos.Nomenclature) {
						const nomId = pos.Nomenclature
						const existing = nomenclatureStats.get(nomId) || {
							nomenclatureId: nomId,
							salesCount: 0,
							totalQuantity: 0,
							totalRevenue: 0,
							lastSoldAt: pos.ClosedWTZ || pos.DateWTZ || '',
						}

						existing.salesCount += 1
						existing.totalQuantity += pos.Quantity || 0
						existing.totalRevenue += pos.TotalPrice || pos.CheckSum || 0

						// Обновляем дату последней продажи
						const posDate = pos.ClosedWTZ || pos.DateWTZ || ''
						if (posDate > existing.lastSoldAt) {
							existing.lastSoldAt = posDate
						}

						nomenclatureStats.set(nomId, existing)
					}
				})

				strapi.log.info(
					`Aggregated statistics for ${nomenclatureStats.size} unique products`
				)

				// Обновляем товары в Strapi
				let updatedCount = 0
				let notFoundCount = 0
				const updateTime = new Date()

				for (const [nomenclatureId, stats] of nomenclatureStats.entries()) {
					try {
						// Ищем товар по sbisId (Nomenclature из продаж = sbisId в товарах)
						const products = await strapi.entityService.findMany(
							'api::product.product',
							{
								filters: { sbisId: nomenclatureId },
								limit: 1,
							}
						)

						if (products.length > 0) {
							const product = products[0]

							// Рассчитываем популярность (можно настроить формулу)
							// Простая формула: количество продаж * 0.5 + выручка / 1000 * 0.3 + количество единиц * 0.2
							const popularityScore =
								stats.salesCount * 0.5 +
								(stats.totalRevenue / 1000) * 0.3 +
								stats.totalQuantity * 0.2

							// Парсим дату последней продажи
							let lastSoldAtDate: Date | null = null
							if (stats.lastSoldAt) {
								try {
									lastSoldAtDate = new Date(stats.lastSoldAt.replace(' ', 'T'))
								} catch (e) {
									strapi.log.warn(`Failed to parse date: ${stats.lastSoldAt}`)
								}
							}

							// Обновляем товар
							await strapi.entityService.update(
								'api::product.product',
								product.id,
								{
									data: {
										sbisSalesCount: stats.salesCount,
										sbisTotalQuantitySold: stats.totalQuantity,
										sbisTotalRevenue: stats.totalRevenue,
										sbisLastSoldAt: lastSoldAtDate,
										sbisPopularityScore: popularityScore,
										sbisStatsLastUpdated: updateTime,
									},
								}
							)

							updatedCount++
						} else {
							notFoundCount++
							strapi.log.warn(
								`Product with sbisId=${nomenclatureId} not found in Strapi`
							)
						}
					} catch (error: any) {
						strapi.log.error(
							`Failed to update product with sbisId=${nomenclatureId}:`,
							error.message
						)
					}
				}

				const result = {
					success: true,
					period: {
						from: fromDateTime,
						to: toDateTime,
						days,
					},
					statistics: {
						totalOrders: allOrders.length,
						validOrders: validOrders.length,
						totalPositions: validPositions.length,
						uniqueProducts: nomenclatureStats.size,
						updatedProducts: updatedCount,
						notFoundProducts: notFoundCount,
					},
				}

				strapi.log.info('Sales statistics sync completed:', result)
				return result
			} catch (error: any) {
				strapi.log.error('Sales statistics sync failed:', error.message)
				throw error
			}
		},
	}
}
