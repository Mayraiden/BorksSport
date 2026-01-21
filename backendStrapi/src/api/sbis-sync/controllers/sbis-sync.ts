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
