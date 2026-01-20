import type { Core } from '@strapi/strapi'
import { verifyAdminJWT } from '../../../shared/helpers/verifyAdminJWT'

export default ({ strapi }: { strapi: Core.Strapi }) => ({
	async syncProducts(ctx) {
		try {
			// Проверка авторизации админа через JWT токен из Authorization header или cookie
			// Токен может быть отправлен из Local Storage через Authorization header
			const adminUser = await verifyAdminJWT(strapi, ctx)
			
			if (!adminUser) {
				ctx.status = 401
				ctx.body = { 
					success: false, 
					message: 'Unauthorized: Admin authentication required. Please log in to the admin panel.' 
				}
				return
			}
			
			// Устанавливаем admin user в state для дальнейшего использования
			ctx.state.admin = adminUser

			const result = await strapi
				.service('api::sbis-sync.sbis-sync')
				.syncProducts()
			ctx.body = { success: true, ...result }
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},

	async fetchProducts(ctx) {
		try {
			const items = await strapi
				.service('api::sbis-sync.sbis-sync')
				.getAllProducts()
			
			// Для анализа: возвращаем первый товар с полной структурой
			const firstProduct = items.length > 0 ? items[0] : null
			const productKeys = firstProduct ? Object.keys(firstProduct) : []
			
			ctx.body = {
				success: true,
				data: { 
					count: items.length, 
					products: items.slice(0, 10),
					// Дополнительная информация для анализа
					analysis: firstProduct ? {
						firstProductKeys: productKeys,
						firstProductStructure: firstProduct,
						hasColorField: productKeys.some(k => /color/i.test(k)),
						hasSizeField: productKeys.some(k => /size/i.test(k)),
					} : null
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},

	async testAuth(ctx) {
		try {
			const token = await strapi
				.service('api::sbis-sync.sbis-sync')
				.getAccessToken()
			ctx.body = { success: true, data: { hasToken: !!token?.accessToken } }
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},

	async status(ctx) {
		try {
			const productsCount = await strapi.entityService.count(
				'api::product.product'
			)
			ctx.body = {
				success: true,
				data: { productsInDatabase: productsCount, lastCheck: new Date() },
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},

	async getSampleProducts(ctx) {
		try {
			const count = parseInt(ctx.query.count as string) || 5
			const includeCategories = ctx.query.categories !== 'false'
			const result = await strapi
				.service('api::sbis-sync.sbis-sync')
				.getSampleProducts(count, includeCategories)
			
			const { products, allProducts, categories, productsByParent } = result
			
			// Анализ структуры
			const productsWithModifiers = products.filter((p: any) => 
				p.modifiers && Array.isArray(p.modifiers) && p.modifiers.length > 0
			)
			
			// Анализ товаров с одинаковым родителем (возможные варианты)
			const variantGroups = productsByParent.map(group => {
				// Сравниваем названия товаров в группе
				const names = group.products.map((p: any) => p.name)
				const articles = group.products.map((p: any) => p.article).filter(Boolean)
				
				return {
					parentId: group.parentId,
					count: group.count,
					products: group.products,
					analysis: {
						namesSimilar: names.every(n => {
							const baseName = names[0].toLowerCase()
							return names.every(name => {
								const nameLower = name.toLowerCase()
								// Проверяем, отличаются ли названия только в конце (размер/цвет)
								return nameLower.includes(baseName.substring(0, baseName.length * 0.7)) ||
								       baseName.includes(nameLower.substring(0, nameLower.length * 0.7))
							})
						}),
						allNames: names,
						allArticles: articles,
					}
				}
			})
			
			const analysis = products.length > 0 ? {
				firstProductKeys: Object.keys(products[0]),
				firstProductFull: products[0],
				allProductsKeys: Array.from(
					new Set(allProducts.flatMap(p => Object.keys(p)))
				),
				modifiers: {
					productsWithModifiers: productsWithModifiers.length,
					firstModifierExample: productsWithModifiers.length > 0 
						? productsWithModifiers[0].modifiers 
						: null,
					allModifierKeys: productsWithModifiers.length > 0
						? Array.from(
							new Set(
								productsWithModifiers.flatMap((p: any) =>
									p.modifiers.flatMap((m: any) => Object.keys(m))
								)
							)
						)
						: []
				},
				hierarchical: {
					totalProducts: allProducts.length,
					productsWithParent: allProducts.filter((p: any) => p.hierarchicalParent).length,
					productsWithoutParent: allProducts.filter((p: any) => !p.hierarchicalParent).length,
					categoriesFound: categories.length,
					productGroupsFound: productsByParent.length,
					variantGroups: variantGroups
				},
				attributes: {
					hasWeight: allProducts.some((p: any) => 
						p.attributes?.weight !== null && p.attributes?.weight !== undefined
					),
					hasVolume: allProducts.some((p: any) => 
						p.attributes?.volume !== null && p.attributes?.volume !== undefined
					),
					allAttributeKeys: Array.from(
						new Set(
							allProducts.flatMap((p: any) => 
								p.attributes ? Object.keys(p.attributes) : []
							)
						)
					),
					firstProductAttributes: products[0]?.attributes || null,
					productsWithFilledAttributes: allProducts.filter((p: any) => {
						if (!p.attributes) return false
						return Object.values(p.attributes).some(val => val !== null && val !== undefined)
					}).length
				},
				colorSizeFields: {
					hasColor: allProducts.some(p => 
						Object.keys(p).some(k => /color/i.test(k))
					),
					hasSize: allProducts.some(p => 
						Object.keys(p).some(k => /size/i.test(k))
					),
					colorFields: Array.from(
						new Set(
							allProducts.flatMap(p => 
								Object.keys(p).filter(k => /color/i.test(k))
							)
						)
					),
					sizeFields: Array.from(
						new Set(
							allProducts.flatMap(p => 
								Object.keys(p).filter(k => /size/i.test(k))
							)
						)
					),
				}
			} : null

			ctx.body = {
				success: true,
				data: {
					count: products.length,
					products,
					categories: categories.slice(0, 3),
					analysis,
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, message: error.message }
		}
	},

	/**
	 * Тестовый эндпоинт для получения продаж из СБИС
	 * GET /api/sbis-sync/test-sales?days=7
	 */
	async testSales(ctx) {
		try {
			// Получаем параметры из query
			const days = parseInt(ctx.query.days as string) || 7
			const page = parseInt(ctx.query.page as string) || 0
			const pageSize = parseInt(ctx.query.pageSize as string) || 10
			const getAll = ctx.query.getAll === 'true'

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

			strapi.log.info('Testing SBIS sales endpoint:', {
				fromDateTime,
				toDateTime,
				days,
				getAll,
			})

			let result
			if (getAll) {
				// Получаем все продажи за период
				const allOrders = await strapi
					.service('api::sbis-sync.sbis-sync')
					.getAllSales(fromDateTime, toDateTime)
				result = {
					orders: allOrders,
					total: allOrders.length,
					page: 0,
					pageSize: allOrders.length,
					hasMore: false,
				}
			} else {
				// Получаем одну страницу для теста
				result = await strapi
					.service('api::sbis-sync.sbis-sync')
					.fetchSales(fromDateTime, toDateTime, page, pageSize)
			}

			// Анализ структуры данных
			const analysis: any = {
				requestParams: {
					fromDateTime,
					toDateTime,
					days,
					page,
					pageSize,
					getAll,
				},
				response: {
					totalOrders: result.orders.length,
					hasMore: result.hasMore,
				},
			}

			if (result.orders.length > 0) {
				// Фильтруем заказы: исключаем удаленные
				const validOrders = result.orders.filter((order: any) => !order.Deleted)
				const deletedOrders = result.orders.filter((order: any) => order.Deleted)
				
				analysis.ordersFiltering = {
					total: result.orders.length,
					valid: validOrders.length,
					deleted: deletedOrders.length,
				}

				// Находим первый валидный заказ для анализа структуры
				const firstValidOrder = validOrders.find((order: any) => 
					order.SaleNomenclatures && 
					Array.isArray(order.SaleNomenclatures) && 
					order.SaleNomenclatures.length > 0
				) || validOrders[0]

				if (firstValidOrder) {
					// Анализ структуры заказа
					analysis.orderStructure = {
						keys: Object.keys(firstValidOrder),
						sampleOrder: firstValidOrder,
					}
				}

				// Собираем все позиции из всех валидных заказов
				const allPositions: any[] = []
				validOrders.forEach((order: any) => {
					if (order.SaleNomenclatures && Array.isArray(order.SaleNomenclatures)) {
						allPositions.push(...order.SaleNomenclatures)
					}
				})

				// Фильтруем позиции: исключаем возвраты
				const validPositions = allPositions.filter((pos: any) => !pos.IsReturn)
				const returnPositions = allPositions.filter((pos: any) => pos.IsReturn)

				analysis.positions = {
					total: allPositions.length,
					valid: validPositions.length,
					returns: returnPositions.length,
				}

				if (validPositions.length > 0) {
					const firstPosition = validPositions[0]
					
					analysis.positions.firstPositionKeys = Object.keys(firstPosition)
					analysis.positions.firstPosition = firstPosition

					// Собираем все уникальные поля из всех позиций
					const allPositionKeys = new Set<string>()
					validPositions.forEach((pos: any) => {
						Object.keys(pos).forEach(key => allPositionKeys.add(key))
					})
					analysis.positions.allPositionKeys = Array.from(allPositionKeys)

					// Проверяем наличие ключевых полей для статистики
					const keyFields = [
						'Nomenclature',
						'Quantity',
						'TotalPrice',
						'CheckSum',
						'CheckPrice',
						'IsReturn',
						'DateWTZ',
						'Name',
						'NomenclatureNumber',
					]
					
					analysis.positions.keyFields = {}
					keyFields.forEach(field => {
						analysis.positions.keyFields[field] = validPositions.some((p: any) => 
							p.hasOwnProperty(field) && p[field] !== null && p[field] !== undefined
						)
					})

					// Статистика по товарам (агрегируем по Nomenclature)
					const nomenclatureStats = new Map<number, {
						nomenclatureId: number
						name: string
						salesCount: number
						totalQuantity: number
						totalRevenue: number
						lastSoldAt: string
					}>()

					validPositions.forEach((pos: any) => {
						if (pos.Nomenclature) {
							const nomId = pos.Nomenclature
							const existing = nomenclatureStats.get(nomId) || {
								nomenclatureId: nomId,
								name: pos.Name || 'Unknown',
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

					// Сортируем по количеству продаж
					const topBySales = Array.from(nomenclatureStats.values())
						.sort((a, b) => b.salesCount - a.salesCount)
						.slice(0, 10)

					// Сортируем по выручке
					const topByRevenue = Array.from(nomenclatureStats.values())
						.sort((a, b) => b.totalRevenue - a.totalRevenue)
						.slice(0, 10)

					// Сортируем по количеству единиц
					const topByQuantity = Array.from(nomenclatureStats.values())
						.sort((a, b) => b.totalQuantity - a.totalQuantity)
						.slice(0, 10)

					analysis.positions.nomenclatureStats = {
						uniqueNomenclatures: nomenclatureStats.size,
						topBySales,
						topByRevenue,
						topByQuantity,
						summary: {
							totalSales: validPositions.length,
							totalRevenue: Array.from(nomenclatureStats.values())
								.reduce((sum, stat) => sum + stat.totalRevenue, 0),
							totalQuantity: Array.from(nomenclatureStats.values())
								.reduce((sum, stat) => sum + stat.totalQuantity, 0),
						},
					}
				}

				// Анализ всех заказов (если их немного)
				if (result.orders.length <= 20) {
					analysis.allOrders = result.orders.map((order: any) => ({
						key: order.Key,
						number: order.Number,
						dateWTZ: order.DateWTZ,
						totalPrice: order.TotalPrice,
						positionsCount: order.SaleNomenclatures?.length || 0,
						isReturn: order.Return || false,
						isDeleted: order.Deleted || false,
					}))
				}
			} else {
				analysis.message = 'No orders found for the specified period'
			}

			ctx.body = {
				success: true,
				data: {
					...result,
					analysis,
				},
			}
		} catch (error: any) {
			strapi.log.error('Test sales endpoint failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message,
				error: error.response?.data || error.message,
			}
		}
	},

	/**
	 * Синхронизировать статистику продаж из СБИС
	 * POST /api/sbis-sync/sync-sales-stats?days=30
	 */
	async syncSalesStats(ctx) {
		try {
			const days = parseInt(ctx.query.days as string) || 30

			strapi.log.info(`Manual sales statistics sync requested for last ${days} days`)

			const result = await strapi
				.service('api::sbis-sync.sbis-sync')
				.syncSalesStatistics(days)

			ctx.body = {
				success: true,
				data: result,
				message: 'Sales statistics synced successfully',
			}
		} catch (error: any) {
			strapi.log.error('Sales statistics sync failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message,
				error: error.response?.data || error.message,
			}
		}
	},

	/**
	 * Опубликовать все товары (установить published: true)
	 * POST /api/sbis-sync/publish-all-products
	 */
	async publishAllProducts(ctx) {
		try {
			strapi.log.info('Publishing all products...')
			const result = await strapi
				.service('api::sbis-sync.sbis-sync')
				.publishAllProducts()
			ctx.body = {
				success: true,
				data: result,
				message: 'All products published successfully',
			}
		} catch (error: any) {
			strapi.log.error('Publish all products failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message,
			}
		}
	},

	/**
	 * Очистить все товары и категории
	 * POST /api/sbis-sync/clear-all
	 */
	async clearAll(ctx) {
		try {
			strapi.log.warn('Clearing all products and categories')
			const result = await strapi
				.service('api::sbis-sync.sbis-sync')
				.clearAll()
			ctx.body = {
				success: true,
				data: result,
				message: 'All products and categories cleared successfully',
			}
		} catch (error: any) {
			strapi.log.error('Clear all failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message,
			}
		}
	},

	/**
	 * Изучить структуру данных нового прайс-листа
	 * GET /api/sbis-sync/analyze-price-list
	 */
	async analyzePriceList(ctx) {
		try {
			const { accessToken } = await strapi
				.service('api::sbis-sync.sbis-sync')
				.getAccessToken()

			// Получаем первые несколько страниц для анализа
			const allItems: any[] = []
			const maxPages = 3
			let page = 0

			while (page < maxPages) {
				const result = await strapi
					.service('api::sbis-sync.sbis-sync')
					.fetchProducts(accessToken, page, 100)
				allItems.push(...result.items)
				if (!result.hasMore) break
				page++
			}

			// Разделяем на товары и категории
			const products = allItems.filter(
				(item: any) => !item.isParent && item.published && item.id !== null
			)
			const categories = allItems.filter((item: any) => item.isParent === true)

			// Получаем конфигурацию
			const sbisService = strapi.service('api::sbis-sync.sbis-sync')
			
			// Анализ структуры
			const analysis: any = {
				totalItems: allItems.length,
				productsCount: products.length,
				categoriesCount: categories.length,
				priceListId: sbisService.config.priceListId,
			}

			// Анализ категорий
			if (categories.length > 0) {
				const firstCategory = categories[0]
				analysis.categoryStructure = {
					keys: Object.keys(firstCategory),
					sample: firstCategory,
					levels: categories.map((c: any) => ({
						id: c.hierarchicalId,
						name: c.name,
						parent: c.hierarchicalParent,
						level: c.level || 0,
					})),
					maxLevel: Math.max(...categories.map((c: any) => c.level || 0)),
				}
			}

			// Анализ товаров
			if (products.length > 0) {
				const firstProduct = products[0]
				const allProductKeys = new Set<string>()
				products.forEach((p: any) => {
					Object.keys(p).forEach((key) => allProductKeys.add(key))
				})

				analysis.productStructure = {
					keys: Array.from(allProductKeys),
					sample: firstProduct,
					productsWithImages: products.filter((p: any) => 
						p.images && Array.isArray(p.images) && p.images.length > 0
					).length,
					productsWithModifiers: products.filter((p: any) => 
						p.modifiers && Array.isArray(p.modifiers) && p.modifiers.length > 0
					).length,
					productsWithAttributes: products.filter((p: any) => 
						p.attributes && Object.keys(p.attributes).length > 0
					).length,
					productsWithHierarchicalParent: products.filter((p: any) => 
						p.hierarchicalParent
					).length,
				}

				// Анализ изображений
				const productsWithImages = products.filter((p: any) => 
					p.images && Array.isArray(p.images) && p.images.length > 0
				)
				if (productsWithImages.length > 0) {
					const firstImageProduct = productsWithImages[0]
					analysis.imageStructure = {
						sample: firstImageProduct.images[0],
						imageFormat: typeof firstImageProduct.images[0],
						hasPhotoURL: firstImageProduct.images.some((img: any) => 
							typeof img === 'string' && img.includes('PhotoURL')
						),
						hasParams: firstImageProduct.images.some((img: any) => 
							typeof img === 'string' && img.includes('params=')
						),
					}
				}

				// Анализ модификаторов
				const productsWithModifiers = products.filter((p: any) => 
					p.modifiers && Array.isArray(p.modifiers) && p.modifiers.length > 0
				)
				if (productsWithModifiers.length > 0) {
					const firstModifierProduct = productsWithModifiers[0]
					analysis.modifierStructure = {
						sample: firstModifierProduct.modifiers[0],
						allModifierKeys: Array.from(
							new Set(
								productsWithModifiers.flatMap((p: any) =>
									p.modifiers.flatMap((m: any) => Object.keys(m))
								)
							)
						),
					}
				}

				// Анализ атрибутов
				const productsWithAttributes = products.filter((p: any) => 
					p.attributes && Object.keys(p.attributes).length > 0
				)
				if (productsWithAttributes.length > 0) {
					const firstAttributeProduct = productsWithAttributes[0]
					analysis.attributeStructure = {
						sample: firstAttributeProduct.attributes,
						allAttributeKeys: Array.from(
							new Set(
								productsWithAttributes.flatMap((p: any) =>
									Object.keys(p.attributes)
								)
							)
						),
					}
				}

				// Группировка по родителю (варианты товаров)
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

				const variantGroups = Array.from(productsByParent.entries())
					.filter(([_, items]) => items.length > 1)
					.slice(0, 5)
					.map(([parentId, items]) => ({
						parentId,
						count: items.length,
						products: items.slice(0, 3).map((p: any) => ({
							id: p.id,
							name: p.name,
							article: p.article,
						})),
					}))

				analysis.variantGroups = {
					totalGroups: productsByParent.size,
					groupsWithMultipleProducts: variantGroups.length,
					samples: variantGroups,
				}
			}

			ctx.body = {
				success: true,
				data: {
					analysis,
					sampleProducts: products.slice(0, 5),
					sampleCategories: categories.slice(0, 5),
				},
			}
		} catch (error: any) {
			strapi.log.error('Price list analysis failed:', error.message)
			ctx.status = 500
			ctx.body = {
				success: false,
				message: error.message,
				error: error.response?.data || error.message,
			}
		}
	},
})
