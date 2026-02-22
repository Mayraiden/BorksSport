/**
 * Product Sync Service
 * Синхронизирует товары из CommerceML в Strapi через Entity Service
 */

import type { Core } from '@strapi/strapi'
import type { MappedProduct } from './commerceml-mapper'

export type CategoryType = 'sport' | 'productType' | 'subcategory' | 'brand'

export interface SyncStats {
	saved: number
	updated: number
	errors: number
	total: number
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	/**
	 * Синхронизирует категории из CommerceML с построением иерархии
	 * @param categories - Массив категорий из extractCategories()
	 * @returns Map: UUID категории -> Strapi ID категории
	 */
	async function syncCategories(categories: any[]): Promise<Map<string, number>> {
		const categoryMap = new Map<string, number>() // UUID -> Strapi ID
		const categoryNameMap = new Map<string, number>() // Название -> Strapi ID (для поиска)

		strapi.log.info(
			`[CommerceML Product Sync] Starting sync of ${categories.length} categories...`
		)

		// Сначала создаем/обновляем все категории без parent (чтобы они существовали)
		// Сортируем по уровню, чтобы сначала обрабатывать родительские категории
		const sortedCategories = [...categories].sort((a, b) => a.level - b.level)

		for (const category of sortedCategories) {
			try {
				const categoryId = category.Ид || category.Id || category.id
				const categoryName = category.Наименование || category.Name || category.name
				const level = category.level || 0
				const parentId = category.parentId || null
				const parentNumericId = category.parentNumericId || null
				const numericId = category.numericId || null

				if (!categoryId || !categoryName) {
					continue
				}

				// Ищем существующую категорию по sbisId (numericId)
				let existingCategory = null
				if (numericId) {
					existingCategory = await strapi.db.query('api::category.category').findOne({
						where: { sbisId: numericId },
					})
				}

				// Если не нашли по sbisId, ищем по названию (fallback)
				if (!existingCategory) {
					existingCategory = await strapi.db.query('api::category.category').findOne({
						where: { name: categoryName },
					})
				}

				// Находим parent Strapi ID если есть
				let parentStrapiId: number | null = null
				if (parentId && categoryMap.has(parentId)) {
					parentStrapiId = categoryMap.get(parentId) || null
				}

				const categoryData: any = {
					name: categoryName,
					level,
					isActive: true,
					sbisId: numericId,
					sbisParentId: parentNumericId || null,
				}

				if (parentStrapiId) {
					categoryData.parent = parentStrapiId
				}

				let strapiCategoryId: number

				if (existingCategory) {
					// Обновляем существующую категорию
					const updated = await strapi.entityService.update(
						'api::category.category',
						existingCategory.id,
						{
							data: categoryData,
						}
					)
					// Strapi ID может быть string или number, приводим к number
					strapiCategoryId = typeof updated.id === 'number' ? updated.id : parseInt(String(updated.id), 10)
					strapi.log.debug(
						`[CommerceML Product Sync] Updated category: ${categoryName} (level ${level})`
					)
				} else {
					// Создаем новую категорию
					const created = await strapi.entityService.create('api::category.category', {
						data: categoryData,
					})
					// Strapi ID может быть string или number, приводим к number
					strapiCategoryId = typeof created.id === 'number' ? created.id : parseInt(String(created.id), 10)
					strapi.log.debug(
						`[CommerceML Product Sync] Created category: ${categoryName} (level ${level})`
					)
				}

				// Сохраняем маппинг
				categoryMap.set(categoryId, strapiCategoryId)
				categoryNameMap.set(categoryName, strapiCategoryId)
			} catch (error: any) {
				strapi.log.error(
					`[CommerceML Product Sync] Failed to sync category ${category.Наименование}:`,
					error.message
				)
			}
		}

		strapi.log.info(
			`[CommerceML Product Sync] Categories synced: ${categoryMap.size} categories processed`
		)

		return categoryMap
	}

	/**
	 * Находит или создаёт категорию по имени и типу
	 * @param name - Название категории
	 * @param type - Тип категории
	 * @param parentId - ID родительской категории (для subcategory)
	 * @returns Strapi ID категории или undefined
	 */
	async function ensureCategory(
		name: string,
		type: CategoryType,
		parentId?: number
	): Promise<number | undefined> {
		if (!name || !name.trim()) {
			return undefined
		}

		const level = type === 'sport' ? 0 : type === 'productType' ? 1 : 2

		// Ищем по name (type может быть не заполнен у старых категорий)
		let existing = await strapi.db.query('api::category.category').findOne({
			where: { name: name.trim() },
		})

		if (existing) {
			// Обновляем type и parent если нужно
			const updates: Record<string, unknown> = {}
			if (existing.type !== type) {
				updates.type = type
			}
			if (level !== existing.level) {
				updates.level = level
			}
			if (parentId && existing.parent !== parentId) {
				updates.parent = parentId
			}
			if (Object.keys(updates).length > 0) {
				await strapi.entityService.update('api::category.category', existing.id, {
					data: updates,
				})
			}
			return typeof existing.id === 'number' ? existing.id : parseInt(String(existing.id), 10)
		}

		// Создаём новую категорию
		const categoryData: any = {
			name: name.trim(),
			level,
			type,
			isActive: true,
		}
		if (parentId) {
			categoryData.parent = parentId
		}

		const created = await strapi.entityService.create('api::category.category', {
			data: categoryData,
		})
		strapi.log.debug(`[CommerceML Product Sync] Created category: ${name} (type: ${type})`)
		return typeof created.id === 'number' ? created.id : parseInt(String(created.id), 10)
	}

	/**
	 * Находит категорию товара и строит путь до корня
	 * @param categoryId - UUID категории из XML
	 * @param categoryMap - Map UUID -> Strapi ID
	 * @param categories - Массив всех категорий из extractCategories()
	 * @returns Объект с информацией о категории
	 */
	function findCategoryPath(
		categoryId: string,
		categoryMap: Map<string, number>,
		categories: any[]
	): { categoryId?: number; categoryName?: string; rootCategoryName?: string } {
		if (!categoryId) {
			return {}
		}

		// Находим категорию в массиве
		const category = categories.find((c) => (c.Ид || c.Id || c.id) === categoryId)
		if (!category) {
			return {}
		}

		const strapiCategoryId = categoryMap.get(categoryId)
		const categoryName = category.Наименование || category.Name || category.name

		// Строим путь до корня (level 0)
		let currentCategory = category
		let rootCategoryName: string | undefined = undefined

		while (currentCategory) {
			if (currentCategory.level === 0) {
				rootCategoryName = currentCategory.Наименование || currentCategory.Name || currentCategory.name
				break
			}
			// Ищем родителя
			if (currentCategory.parentId) {
				currentCategory = categories.find(
					(c) => (c.Ид || c.Id || c.id) === currentCategory.parentId
				)
			} else {
				break
			}
		}

		return {
			categoryId: strapiCategoryId,
			categoryName,
			rootCategoryName,
		}
	}

	/**
	 * Синхронизирует один продукт (upsert по sbisExternalId)
	 * @param mappedProduct - Маппированный продукт
	 * @param categoryIds - ID категорий (legacy category и новые связи)
	 * @returns Результат операции
	 */
	async function syncProduct(
		mappedProduct: MappedProduct,
		categoryIds?: {
			category?: number
			sportCategory?: number
			productCategory?: number
			subcategory?: number
			brand?: number
		}
	): Promise<{ success: boolean; created: boolean; productId?: number; error?: string }> {
		try {
			// Ищем существующий продукт по sbisExternalId
			const existingProduct = await strapi.db.query('api::product.product').findOne({
				where: { sbisExternalId: mappedProduct.sbisExternalId },
			})

			const productData: any = {
				name: mappedProduct.name,
				description: mappedProduct.description,
				article: mappedProduct.article,
				price: mappedProduct.price,
				sbisExternalId: mappedProduct.sbisExternalId,
				sbisId: mappedProduct.sbisId,
				categoryName: mappedProduct.categoryName,
				rootCategoryName: mappedProduct.rootCategoryName,
				size: mappedProduct.size,
				color: mappedProduct.color,
				length: mappedProduct.length,
				width: mappedProduct.width,
				height: mappedProduct.height,
				weight: mappedProduct.weight,
				images: mappedProduct.images,
				unit: mappedProduct.unit,
				stock: mappedProduct.stock,
				lastSyncAt: mappedProduct.lastSyncAt,
				published: true, // По умолчанию публикуем
			}

			// Добавляем категории
			if (categoryIds) {
				if (categoryIds.category) {
					productData.category = categoryIds.category
				}
				if (categoryIds.sportCategory) {
					productData.sportCategory = categoryIds.sportCategory
				}
				if (categoryIds.productCategory) {
					productData.productCategory = categoryIds.productCategory
				}
				if (categoryIds.subcategory) {
					productData.subcategory = categoryIds.subcategory
				}
				if (categoryIds.brand) {
					productData.brand = categoryIds.brand
				}
			}

			let result
			if (existingProduct) {
				// Обновляем существующий продукт
				result = await strapi.entityService.update(
					'api::product.product',
					existingProduct.id,
					{
						data: productData,
					}
				)
				strapi.log.debug(
					`[CommerceML Product Sync] Updated product: ${mappedProduct.sbisExternalId}`
				)
				return { success: true, created: false, productId: existingProduct.id }
			} else {
				// Создаем новый продукт
				result = await strapi.entityService.create('api::product.product', {
					data: productData,
				})
				strapi.log.debug(
					`[CommerceML Product Sync] Created product: ${mappedProduct.sbisExternalId}`
				)
				return { success: true, created: true, productId: result.id }
			}
		} catch (error: any) {
			strapi.log.error(
				`[CommerceML Product Sync] Failed to sync product ${mappedProduct.sbisExternalId}:`,
				error.message
			)
			return {
				success: false,
				created: false,
				error: error.message,
			}
		}
	}

	/**
	 * Синхронизирует массив продуктов
	 * @param mappedProducts - Массив маппированных продуктов
	 * @param categoryMap - Map UUID категории -> Strapi ID категории (опционально)
	 * @param categories - Массив всех категорий из extractCategories() (опционально)
	 * @returns Статистика синхронизации
	 */
	async function syncProducts(
		mappedProducts: MappedProduct[],
		categoryMap?: Map<string, number>,
		categories?: any[]
	): Promise<SyncStats> {
		const stats: SyncStats = {
			saved: 0,
			updated: 0,
			errors: 0,
			total: mappedProducts.length,
		}

		strapi.log.info(
			`[CommerceML Product Sync] Starting sync of ${mappedProducts.length} products...`
		)

		// Синхронизируем продукты
		for (const product of mappedProducts) {
			const categoryIds: {
				category?: number
				sportCategory?: number
				productCategory?: number
				subcategory?: number
				brand?: number
			} = {}

			let categoryName: string | undefined = undefined
			let rootCategoryName: string | undefined = undefined

			// Если есть categoryMap и categories из XML, используем их
			if (categoryMap && categories && product.categoryId) {
				const categoryInfo = findCategoryPath(product.categoryId, categoryMap, categories)
				categoryIds.category = categoryInfo.categoryId
				categoryName = categoryInfo.categoryName
				rootCategoryName = categoryInfo.rootCategoryName
				product.categoryName = categoryName
				product.rootCategoryName = rootCategoryName
			} else if (product.categoryName) {
				// Fallback: ищем по названию (старый способ)
				const category = await strapi.db.query('api::category.category').findOne({
					where: { name: product.categoryName },
				})
				if (category) {
					categoryIds.category = category.id
				}
			}

			// Резолвим новые связи из имён (sportCategoryName, productCategoryName, subcategoryName, brandName)
			if (product.sportCategoryName) {
				categoryIds.sportCategory = await ensureCategory(product.sportCategoryName, 'sport')
				if (!rootCategoryName) {
					product.rootCategoryName = product.sportCategoryName
				}
			}
			if (product.productCategoryName) {
				categoryIds.productCategory = await ensureCategory(product.productCategoryName, 'productType')
			}
			if (product.subcategoryName) {
				const productCategoryId = categoryIds.productCategory
				categoryIds.subcategory = await ensureCategory(
					product.subcategoryName,
					'subcategory',
					productCategoryId
				)
				if (!categoryName) {
					product.categoryName = product.subcategoryName
				}
			}
			if (product.brandName) {
				categoryIds.brand = await ensureCategory(product.brandName, 'brand')
			}

			const result = await syncProduct(product, categoryIds)

			if (result.success) {
				if (result.created) {
					stats.saved++
				} else {
					stats.updated++
				}
			} else {
				stats.errors++
			}
		}

		strapi.log.info(
			`[CommerceML Product Sync] Sync completed: ${stats.saved} saved, ${stats.updated} updated, ${stats.errors} errors`
		)

		return stats
	}

	/**
	 * Обновляет цены из offers.xml
	 * @param offersData - Данные из offers.xml
	 * @returns Статистика обновления цен
	 */
	async function syncPrices(offersData: any): Promise<SyncStats> {
		const stats: SyncStats = {
			saved: 0,
			updated: 0,
			errors: 0,
			total: 0,
		}

		try {
			// Извлекаем предложения из offers.xml
			const commercialInfo =
				offersData?.КоммерческаяИнформация ||
				offersData?.commercialInformation ||
				offersData

			const offersPackage =
				commercialInfo?.ПакетПредложений ||
				commercialInfo?.offersPackage ||
				commercialInfo?.OffersPackage

			if (!offersPackage) {
				strapi.log.warn('[CommerceML Product Sync] No offers package found')
				return stats
			}

			const offers =
				offersPackage?.Предложения?.Предложение ||
				offersPackage?.Offers?.Offer ||
				offersPackage?.offers?.offer ||
				[]

			const offersArray = Array.isArray(offers) ? offers : offers ? [offers] : []
			stats.total = offersArray.length

			strapi.log.info(
				`[CommerceML Product Sync] Updating prices for ${offersArray.length} offers...`
			)

			for (const offer of offersArray) {
				try {
					const externalId =
						offer.Ид ||
						offer.Id ||
						offer.id ||
						offer.ИдТовара ||
						offer.ProductId ||
						offer.productId

					if (!externalId) {
						continue
					}

					// Извлекаем цену
					const prices = offer.Цены?.Цена || offer.Prices?.Price || offer.prices?.price || []
					const priceArray = Array.isArray(prices) ? prices : prices ? [prices] : []

					if (priceArray.length === 0) {
						continue
					}

					const firstPrice = priceArray[0]
					const price =
						parseFloat(
							firstPrice.ЦенаЗаЕдиницу ||
								firstPrice.PricePerUnit ||
								firstPrice.pricePerUnit ||
								'0'
						) ||
						parseFloat(firstPrice.Цена || firstPrice.Price || firstPrice.price || '0')

					if (!price || price <= 0) {
						continue
					}

					// Извлекаем остаток (Количество)
					const stock = parseFloat(
						offer.Количество || offer.Quantity || offer.quantity || '0'
					)

					// Обновляем цену и остаток продукта
					const product = await strapi.db.query('api::product.product').findOne({
						where: { sbisExternalId: String(externalId) },
					})

					if (product) {
						const updateData: any = {
							price,
							lastSyncAt: new Date(),
						}

						// Добавляем остаток если он есть
						if (!isNaN(stock) && stock >= 0) {
							updateData.stock = Math.floor(stock)
						}

						await strapi.entityService.update('api::product.product', product.id, {
							data: updateData,
						})
						stats.updated++
					} else {
						stats.errors++
					}
				} catch (error: any) {
					strapi.log.error(
						`[CommerceML Product Sync] Failed to update price for offer:`,
						error.message
					)
					stats.errors++
				}
			}

			strapi.log.info(
				`[CommerceML Product Sync] Prices and stock updated: ${stats.updated} updated, ${stats.errors} errors`
			)
		} catch (error: any) {
			strapi.log.error('[CommerceML Product Sync] Failed to sync prices:', error.message)
			stats.errors = stats.total
		}

		return stats
	}

	/**
	 * Обновляет остатки из rests.xml (если нужно)
	 * @param restsData - Данные из rests.xml
	 * @returns Статистика обновления остатков
	 */
	async function syncRests(restsData: any): Promise<SyncStats> {
		// Пока не реализовано, так как в схеме Product нет поля для остатков
		// Можно добавить позже если понадобится
		strapi.log.info('[CommerceML Product Sync] Rests sync not implemented yet')
		return {
			saved: 0,
			updated: 0,
			errors: 0,
			total: 0,
		}
	}

	return {
		syncProduct,
		syncProducts,
		syncCategories,
		syncPrices,
		syncRests,
	}
}
