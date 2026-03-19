/**
 * Product Sync Service
 * Синхронизирует товары из CommerceML в Strapi через Entity Service
 */

import type { Core } from '@strapi/strapi'
import type { MappedProduct } from './commerceml-mapper'

export type CategoryType = 'sport' | 'productType' | 'subcategory' | 'brand'
export type SyncMode = 'full' | 'delta'

export interface SyncStats {
	saved: number
	updated: number
	errors: number
	total: number
}

interface ResetCatalogStats {
	productsBefore: number
	productsRelationsCleared: number
	categoriesBefore: number
	categoriesDeleted: number
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	function normalizeName(value?: string | null): string {
		return (value || '').trim().toLowerCase()
	}

	async function resetCatalogState(): Promise<ResetCatalogStats> {
		strapi.log.warn('[CommerceML Product Sync] Strict rebuild: resetting categories and product relations')

		const products = await strapi.entityService.findMany('api::product.product', {
			fields: ['id'],
			limit: -1,
		})
		const categories = await strapi.entityService.findMany('api::category.category', {
			fields: ['id', 'level'],
			sort: ['level:desc', 'id:desc'],
			limit: -1,
		})

		const stats: ResetCatalogStats = {
			productsBefore: products.length,
			productsRelationsCleared: 0,
			categoriesBefore: categories.length,
			categoriesDeleted: 0,
		}

		for (const product of products) {
			await strapi.entityService.update('api::product.product', product.id, {
				data: {
					category: null,
					sportCategory: null,
					productCategory: null,
					subcategory: null,
					brand: null,
					categoryName: null,
					rootCategoryName: null,
				},
			})
			stats.productsRelationsCleared++
		}

		// Удаляем категории с нижних уровней к верхним, чтобы не упираться в self-relation parent.
		for (const category of categories) {
			await strapi.entityService.delete('api::category.category', category.id)
			stats.categoriesDeleted++
		}

		strapi.log.info(
			`[CommerceML Product Sync] Strict rebuild reset done: productsBefore=${stats.productsBefore}, relationsCleared=${stats.productsRelationsCleared}, categoriesBefore=${stats.categoriesBefore}, categoriesDeleted=${stats.categoriesDeleted}`
		)

		return stats
	}

	function inferCategoryType(level: number, explicitType?: string): CategoryType {
		if (explicitType === 'sport' || explicitType === 'productType' || explicitType === 'subcategory' || explicitType === 'brand') {
			return explicitType
		}
		if (level === 0) return 'sport'
		if (level === 1) return 'productType'
		if (level === 2) return 'brand'
		return 'subcategory'
	}

	/**
	 * Синхронизирует категории из CommerceML с построением иерархии
	 * @param categories - Массив категорий из extractCategories()
	 * @returns Map: UUID категории -> Strapi ID категории
	 */
	async function syncCategories(
		categories: any[],
		options?: { strictRebuild?: boolean; mode?: SyncMode }
	): Promise<Map<string, number>> {
		const categoryMap = new Map<string, number>() // UUID -> Strapi ID
		const activeSbisIds = new Set<number>() // numeric IDs for pruning

		strapi.log.info(
			`[CommerceML Product Sync] Starting sync of ${categories.length} categories...`
		)
		const level0Count = categories.filter((category) => (category.level || 0) === 0).length
		const level1Count = categories.filter((category) => (category.level || 0) === 1).length
		const lowerLevelCount = categories.filter((category) => (category.level || 0) >= 2).length
		const brandCount = categories.filter((category) => category.type === 'brand').length

		if (options?.strictRebuild) {
			const resetStats = await resetCatalogState()
			strapi.log.info(
				`[CommerceML Product Sync] Strict rebuild pre-stage completed: mode=${options.mode || 'full'}, products=${resetStats.productsBefore}, categories=${resetStats.categoriesBefore}`
			)
		}

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
				const explicitType = category.type

				if (!categoryId || !categoryName) {
					continue
				}

				// Находим parent Strapi ID если есть
				let parentStrapiId: number | null = null
				if (parentId && categoryMap.has(parentId)) {
					parentStrapiId = categoryMap.get(parentId) || null
				}

				const categoryType = inferCategoryType(level, explicitType)

				const whereClause: Record<string, any> = {
					name: categoryName,
					type: categoryType,
					level,
				}
				whereClause.parent = parentStrapiId || null

				const existingCategory = await strapi.db.query('api::category.category').findOne({
					where: whereClause,
				})

				const categoryData: any = {
					name: categoryName,
					level,
					isActive: true,
					sbisId: typeof numericId === 'number' ? numericId : null,
					sbisParentId: parentNumericId || null,
					type: categoryType,
				}
				if (typeof numericId === 'number') {
					activeSbisIds.add(numericId)
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
		strapi.log.info(
			`[CommerceML Product Sync] Category tree stats: level0=${level0Count}, level1=${level1Count}, level2plus=${lowerLevelCount}, brand=${brandCount}`
		)

		// Pruning: деактивируем категории sport/productType/brand уровня 0..2,
		// которые не вошли в текущий синк (актуально для delta синков).
		if (!options?.strictRebuild) {
			try {
				const staleCategories = await strapi.entityService.findMany(
					'api::category.category',
					{
						filters: {
							isActive: true,
							level: { $lte: 2 },
							type: { $in: ['sport', 'productType', 'brand'] },
						},
						limit: -1,
					}
				)

				let prunedCount = 0
				for (const stale of staleCategories as any[]) {
					if (typeof stale.sbisId !== 'number') continue
					if (!activeSbisIds.has(stale.sbisId)) {
						await strapi.entityService.update(
							'api::category.category',
							stale.id,
							{
								data: {
									isActive: false,
								},
							}
						)
						prunedCount++
					}
				}

				if (prunedCount > 0) {
					strapi.log.info(
						`[CommerceML Product Sync] Pruned ${prunedCount} inactive categories (sport/productType/brand)`
					)
				}
			} catch (err: any) {
				strapi.log.warn(
					`[CommerceML Product Sync] Pruning categories failed: ${err?.message || err}`
				)
			}
		}

		return categoryMap
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
					model: mappedProduct.model || null,
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
				category: categoryIds?.category ?? null,
				sportCategory: categoryIds?.sportCategory ?? null,
				productCategory: categoryIds?.productCategory ?? null,
				subcategory: categoryIds?.subcategory ?? null,
				brand: categoryIds?.brand ?? null,
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
		_categoryMap?: Map<string, number>,
		_categories?: any[]
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

		const diagnostics = {
			fallbackToUpperLevel: 0,
			missingBrand: 0,
			missingProductCategory: 0,
			missingSportCategory: 0,
			brandAssigned: 0,
		}
		const uniqueBrandCategoryIds = new Set<number>()

		const dbCategories = await strapi.entityService.findMany('api::category.category', {
			populate: ['parent'],
			limit: -1,
		})

		// Индекс по sbisId (numeric) для маппинга UUID(ов) из CommerceML
		const categoryBySbisId = new Map<number, any>()
		for (const category of dbCategories as any[]) {
			if (typeof category.sbisId === 'number') {
				categoryBySbisId.set(category.sbisId, category)
			}
		}

		// Должен совпадать с uuidToNumericId() в `commerceml-mapper.ts`
		const uuidToNumericId = (uuid: string): number => {
			let hash = 0
			for (let i = 0; i < uuid.length; i++) {
				const char = uuid.charCodeAt(i)
				hash = (hash << 5) - hash + char
				hash = hash & hash
			}
			return Math.abs(hash)
		}

		// Синхронизируем продукты
		for (const product of mappedProducts) {
			const categoryIds: {
				category?: number
				sportCategory?: number
				productCategory?: number
				subcategory?: number
				brand?: number
			} = {}

			// Определяем sport/productType/brand не из характеристики `Вид спорта` товара,
			// а из `<Товар><Группы><Ид>` (UUID узла классификатора).
			const groupIds: string[] =
				(product.groupIds && product.groupIds.length > 0
					? product.groupIds
					: product.categoryId
						? [product.categoryId]
						: []) || []

			const matchedNodes = groupIds
				.map((groupId) => {
					const sbisId = uuidToNumericId(groupId)
					return categoryBySbisId.get(sbisId)
				})
				.filter(Boolean)

			// Берем самый глубокий найденный узел, а затем поднимаемся по parent до level=0/1/2
			const deepestNode =
				matchedNodes.length > 0
					? [...matchedNodes].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]
					: undefined

			let sportNode: any = null
			let productTypeNode: any = null
			let brandNode: any = null
			let cursor = deepestNode
			while (cursor) {
				if (cursor.level === 0 || cursor.type === 'sport') sportNode = cursor
				if (cursor.level === 1 || cursor.type === 'productType') productTypeNode = cursor
				if (cursor.level === 2 || cursor.type === 'brand') brandNode = cursor

				cursor = typeof cursor.parent === 'object' ? cursor.parent : null
			}

			categoryIds.sportCategory = sportNode?.id
			categoryIds.productCategory = productTypeNode?.id
			categoryIds.brand = brandNode?.id

			if (!categoryIds.sportCategory) diagnostics.missingSportCategory++
			if (!categoryIds.productCategory) {
				diagnostics.missingProductCategory++
				if (categoryIds.sportCategory) {
					categoryIds.productCategory = categoryIds.sportCategory
					diagnostics.fallbackToUpperLevel++
				}
			}
			if (!categoryIds.brand) diagnostics.missingBrand++
			if (categoryIds.brand) {
				diagnostics.brandAssigned++
				uniqueBrandCategoryIds.add(categoryIds.brand)
			}

			const legacyCategoryId =
				categoryIds.brand || categoryIds.productCategory || categoryIds.sportCategory
			categoryIds.category = legacyCategoryId

			product.rootCategoryName = sportNode?.name || null
			product.categoryName =
				brandNode?.name || productTypeNode?.name || sportNode?.name || null

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
		strapi.log.info(
			`[CommerceML Product Sync] Diagnostics: missingSport=${diagnostics.missingSportCategory}, missingProductCategory=${diagnostics.missingProductCategory}, missingBrand=${diagnostics.missingBrand}, fallbackToUpper=${diagnostics.fallbackToUpperLevel}, brandNodes=${uniqueBrandCategoryIds.size}, productsWithBrand=${diagnostics.brandAssigned}`
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
		resetCatalogState,
	}
}
