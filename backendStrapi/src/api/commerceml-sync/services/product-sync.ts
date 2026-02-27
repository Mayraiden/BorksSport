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

	function inferCategoryType(level: number): CategoryType {
		if (level === 0) return 'sport'
		if (level === 1) return 'productType'
		return 'subcategory'
	}

	function buildCategoriesByXmlId(categories: any[]): Map<string, any> {
		const map = new Map<string, any>()
		for (const category of categories) {
			const xmlId = category.Ид || category.Id || category.id
			if (!xmlId) continue
			map.set(xmlId, category)
		}
		return map
	}

	function buildCategoryChain(xmlCategoryId: string, categoriesByXmlId: Map<string, any>): any[] {
		const chain: any[] = []
		const visited = new Set<string>()
		let currentId: string | null = xmlCategoryId

		while (currentId && !visited.has(currentId)) {
			visited.add(currentId)
			const node = categoriesByXmlId.get(currentId)
			if (!node) break
			chain.push(node)
			currentId = node.parentId || null
		}

		return chain.reverse()
	}

	function pickChainNodeByName(chain: any[], name?: string): any | undefined {
		if (!name) return undefined
		const normalized = normalizeName(name)
		if (!normalized) return undefined
		return chain.find((node) => normalizeName(node.Наименование || node.Name || node.name) === normalized)
	}

	function resolveProductCategoryNodes(chain: any[], mappedProduct: MappedProduct): {
		sportNode?: any
		productCategoryNode?: any
		brandNode?: any
		subcategoryNode?: any
		legacyCategoryNode?: any
	} {
		if (chain.length === 0) return {}

		const sportNode = chain[0]
		const productCategoryNode = chain[1] || chain[0]

		let brandNode = pickChainNodeByName(chain, mappedProduct.brandName)
		let subcategoryNode = pickChainNodeByName(chain, mappedProduct.subcategoryName)

		if (!brandNode && chain.length >= 4) {
			brandNode = chain[2]
		}

		if (!subcategoryNode) {
			if (chain.length >= 4) {
				const candidate = chain[chain.length - 1]
				if (!brandNode || (candidate.Ид || candidate.Id || candidate.id) !== (brandNode.Ид || brandNode.Id || brandNode.id)) {
					subcategoryNode = candidate
				}
			} else if (chain.length === 3) {
				const third = chain[2]
				const isThirdBrand =
					normalizeName(mappedProduct.brandName) &&
					normalizeName(mappedProduct.brandName) === normalizeName(third.Наименование || third.Name || third.name)
				if (!isThirdBrand) {
					subcategoryNode = third
				} else {
					brandNode = third
				}
			}
		}

		const legacyCategoryNode = subcategoryNode || brandNode || productCategoryNode || sportNode

		return {
			sportNode,
			productCategoryNode,
			brandNode,
			subcategoryNode,
			legacyCategoryNode,
		}
	}

	/**
	 * Синхронизирует категории из CommerceML с построением иерархии
	 * @param categories - Массив категорий из extractCategories()
	 * @returns Map: UUID категории -> Strapi ID категории
	 */
	async function syncCategories(categories: any[], options?: { strictRebuild?: boolean }): Promise<Map<string, number>> {
		const categoryMap = new Map<string, number>() // UUID -> Strapi ID

		strapi.log.info(
			`[CommerceML Product Sync] Starting sync of ${categories.length} categories...`
		)
		const level0Count = categories.filter((category) => (category.level || 0) === 0).length
		const level1Count = categories.filter((category) => (category.level || 0) === 1).length
		const lowerLevelCount = categories.filter((category) => (category.level || 0) >= 2).length

		if (options?.strictRebuild) {
			const resetStats = await resetCatalogState()
			strapi.log.info(
				`[CommerceML Product Sync] Strict rebuild pre-stage completed: products=${resetStats.productsBefore}, categories=${resetStats.categoriesBefore}`
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
					type: inferCategoryType(level),
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
			`[CommerceML Product Sync] Category tree stats: level0=${level0Count}, level1=${level1Count}, level2plus=${lowerLevelCount}`
		)

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

		const categoriesByXmlId =
			categoryMap && categories ? buildCategoriesByXmlId(categories) : new Map<string, any>()
		const diagnostics = {
			fallbackToUpperLevel: 0,
			missingBrand: 0,
			missingProductCategory: 0,
			missingSportCategory: 0,
			brandAssigned: 0,
		}
		const uniqueBrandCategoryIds = new Set<number>()

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

			if (categoryMap && categories && product.categoryId) {
				const chain = buildCategoryChain(product.categoryId, categoriesByXmlId)
				const resolved = resolveProductCategoryNodes(chain, product)

				const sportXmlId = resolved.sportNode?.Ид || resolved.sportNode?.Id || resolved.sportNode?.id
				const productCategoryXmlId =
					resolved.productCategoryNode?.Ид ||
					resolved.productCategoryNode?.Id ||
					resolved.productCategoryNode?.id
				const brandXmlId = resolved.brandNode?.Ид || resolved.brandNode?.Id || resolved.brandNode?.id
				const subcategoryXmlId =
					resolved.subcategoryNode?.Ид ||
					resolved.subcategoryNode?.Id ||
					resolved.subcategoryNode?.id
				const legacyXmlId =
					resolved.legacyCategoryNode?.Ид ||
					resolved.legacyCategoryNode?.Id ||
					resolved.legacyCategoryNode?.id

				if (sportXmlId) {
					categoryIds.sportCategory = categoryMap.get(sportXmlId)
					rootCategoryName =
						resolved.sportNode?.Наименование || resolved.sportNode?.Name || resolved.sportNode?.name
				}
				if (productCategoryXmlId) {
					categoryIds.productCategory = categoryMap.get(productCategoryXmlId)
				}
				if (brandXmlId) {
					categoryIds.brand = categoryMap.get(brandXmlId)
				}
				if (subcategoryXmlId) {
					categoryIds.subcategory = categoryMap.get(subcategoryXmlId)
				}
				if (legacyXmlId) {
					categoryIds.category = categoryMap.get(legacyXmlId)
					categoryName =
						resolved.legacyCategoryNode?.Наименование ||
						resolved.legacyCategoryNode?.Name ||
						resolved.legacyCategoryNode?.name
				}

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

				product.categoryName = categoryName
				product.rootCategoryName = rootCategoryName
			} else if (product.categoryName) {
				const category = await strapi.db.query('api::category.category').findOne({
					where: { name: product.categoryName },
				})
				if (category) {
					categoryIds.category = category.id
				}
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
