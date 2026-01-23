/**
 * CommerceML Mapper Service
 * Маппит данные из CommerceML формата в Strapi Product модель
 */

import type { Core } from '@strapi/strapi'
import {
	extractSize,
	extractColor,
	extractDimensions,
	cleanDescriptionHtml,
} from '../../sbis-sync/utils/data-extractor'

export interface CommerceMLProduct {
	Ид?: string
	Наименование?: string
	Описание?: string
	Артикул?: string
	Группы?: {
		Группа?: any | any[]
	}
	Цены?: {
		Цена?: any | any[]
	}
	Остатки?: {
		Остаток?: any | any[]
	}
	Характеристики?: {
		Характеристика?: any | any[]
	}
	Картинки?: {
		Картинка?: string | string[]
		Picture?: string | string[]
		picture?: string | string[]
		[key: string]: any
	}
	[key: string]: any
}

export interface MappedProduct {
	name: string
	description?: string
	article?: string
	price?: number
	sbisExternalId: string
	sbisId?: number
	categoryName?: string
	rootCategoryName?: string
	size?: string
	color?: string
	length?: number
	width?: number
	height?: number
	weight?: number
	images?: any
	unit?: string
	lastSyncAt: Date
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	/**
	 * Маппит CommerceML продукт в Strapi Product формат
	 * @param commerceMLProduct - Продукт из CommerceML XML
	 * @returns Маппированный продукт для Strapi
	 */
	function mapProduct(commerceMLProduct: CommerceMLProduct): MappedProduct | null {
		try {
			// Внешний ID обязателен для upsert
			const externalId = commerceMLProduct.Ид || commerceMLProduct.Id || commerceMLProduct.id
			if (!externalId) {
				strapi.log.warn('[CommerceML Mapper] Product missing Ид field, skipping')
				return null
			}

			// Наименование обязательно
			const name =
				commerceMLProduct.Наименование ||
				commerceMLProduct.Name ||
				commerceMLProduct.name ||
				''
			if (!name) {
				strapi.log.warn(
					`[CommerceML Mapper] Product ${externalId} missing Наименование, skipping`
				)
				return null
			}

			// Описание
			const description =
				commerceMLProduct.Описание ||
				commerceMLProduct.Description ||
				commerceMLProduct.description ||
				''
			const cleanedDescription = cleanDescriptionHtml(description)

			// Артикул
			const article =
				commerceMLProduct.Артикул ||
				commerceMLProduct.Article ||
				commerceMLProduct.article ||
				null

			// Цена - берем первую доступную цену
			let price: number | undefined
			if (commerceMLProduct.Цены) {
				const prices = commerceMLProduct.Цены.Цена
				if (prices) {
					const priceArray = Array.isArray(prices) ? prices : [prices]
					const firstPrice = priceArray[0]
					if (firstPrice) {
						price =
							parseFloat(firstPrice.ЦенаЗаЕдиницу || firstPrice.PricePerUnit || firstPrice.pricePerUnit || '0') ||
							parseFloat(firstPrice.Цена || firstPrice.Price || firstPrice.price || '0')
					}
				}
			}

			// Категории - берем первую группу
			let categoryName: string | undefined
			let rootCategoryName: string | undefined
			if (commerceMLProduct.Группы) {
				const groups = commerceMLProduct.Группы.Группа
				if (groups) {
					const groupArray = Array.isArray(groups) ? groups : [groups]
					const firstGroup = groupArray[0]
					if (firstGroup) {
						categoryName =
							firstGroup.Наименование ||
							firstGroup.Name ||
							firstGroup.name ||
							undefined
					}
				}
			}

			// Характеристики для размера и цвета
			const characteristics = commerceMLProduct.Характеристики?.Характеристика || []
			const characteristicsArray = Array.isArray(characteristics)
				? characteristics
				: characteristics
				? [characteristics]
				: []

			// Преобразуем характеристики в объект для удобства
			const characteristicsMap: Record<string, any> = {}
			characteristicsArray.forEach((char: any) => {
				const name = char.Наименование || char.Name || char.name || ''
				const value = char.Значение || char.Value || char.value || ''
				if (name && value) {
					characteristicsMap[name] = value
				}
			})

			const size = extractSize(characteristicsMap, name)
			const color = extractColor(characteristicsMap, name)

			// Габариты
			const dimensions = extractDimensions({
				...commerceMLProduct,
				attributes: characteristicsMap,
			})

			// Изображения
			let images: any = null
			if (commerceMLProduct.Картинки) {
				const pictures = (commerceMLProduct.Картинки as any).Картинка || 
					(commerceMLProduct.Картинки as any).Picture || 
					(commerceMLProduct.Картинки as any).picture
				if (pictures) {
					const pictureArray = Array.isArray(pictures) ? pictures : [pictures]
					images = pictureArray.filter((pic: any) => pic && typeof pic === 'string')
				}
			}

			// Единица измерения
			const unit =
				commerceMLProduct.Единица ||
				commerceMLProduct.Unit ||
				commerceMLProduct.unit ||
				null

			// Пытаемся извлечь числовой ID из externalId
			let sbisId: number | undefined
			if (typeof externalId === 'string') {
				const numericMatch = externalId.match(/\d+/)
				if (numericMatch) {
					sbisId = parseInt(numericMatch[0], 10)
				}
			} else if (typeof externalId === 'number') {
				sbisId = externalId
			}

			return {
				name,
				description: cleanedDescription || undefined,
				article: article || undefined,
				price: price || undefined,
				sbisExternalId: String(externalId),
				sbisId,
				categoryName: categoryName || undefined,
				rootCategoryName: rootCategoryName || undefined,
				size: size || undefined,
				color: color || undefined,
				length: dimensions.length || undefined,
				width: dimensions.width || undefined,
				height: dimensions.height || undefined,
				weight: dimensions.weight || undefined,
				images: images && images.length > 0 ? images : undefined,
				unit: unit || undefined,
				lastSyncAt: new Date(),
			}
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to map product:', error.message)
			return null
		}
	}

	/**
	 * Маппит массив продуктов из CommerceML
	 * @param commerceMLProducts - Массив продуктов из CommerceML
	 * @returns Массив маппированных продуктов
	 */
	function mapProducts(commerceMLProducts: CommerceMLProduct[]): MappedProduct[] {
		const mapped: MappedProduct[] = []

		for (const product of commerceMLProducts) {
			const mappedProduct = mapProduct(product)
			if (mappedProduct) {
				mapped.push(mappedProduct)
			}
		}

		return mapped
	}

	/**
	 * Извлекает продукты из парсированного CommerceML XML
	 * @param parsedXML - Парсированный XML объект
	 * @returns Массив продуктов
	 */
	function extractProducts(parsedXML: any): CommerceMLProduct[] {
		try {
			// Пробуем разные варианты структуры CommerceML
			const commercialInfo =
				parsedXML?.КоммерческаяИнформация ||
				parsedXML?.commercialInformation ||
				parsedXML

			// Каталог
			const catalog =
				commercialInfo?.Каталог ||
				commercialInfo?.catalog ||
				commercialInfo?.Catalog

			if (!catalog) {
				strapi.log.warn('[CommerceML Mapper] No catalog found in XML')
				return []
			}

			// Товары
			const products =
				catalog?.Товары?.Товар ||
				catalog?.Products?.Product ||
				catalog?.products?.product ||
				catalog?.Товар ||
				catalog?.Product ||
				catalog?.product ||
				[]

			const productsArray = Array.isArray(products) ? products : products ? [products] : []

			strapi.log.info(
				`[CommerceML Mapper] Extracted ${productsArray.length} products from XML`
			)

			return productsArray
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to extract products:', error.message)
			return []
		}
	}

	/**
	 * Извлекает категории из парсированного CommerceML XML
	 * @param parsedXML - Парсированный XML объект
	 * @returns Массив категорий
	 */
	function extractCategories(parsedXML: any): any[] {
		try {
			const commercialInfo =
				parsedXML?.КоммерческаяИнформация ||
				parsedXML?.commercialInformation ||
				parsedXML

			const catalog =
				commercialInfo?.Каталог ||
				commercialInfo?.catalog ||
				commercialInfo?.Catalog

			if (!catalog) {
				return []
			}

			const groups =
				catalog?.Классификатор?.Группы?.Группа ||
				catalog?.Classifier?.Groups?.Group ||
				catalog?.классификатор?.группы?.группа ||
				[]

			const groupsArray = Array.isArray(groups) ? groups : groups ? [groups] : []

			strapi.log.info(
				`[CommerceML Mapper] Extracted ${groupsArray.length} categories from XML`
			)

			return groupsArray
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to extract categories:', error.message)
			return []
		}
	}

	return {
		mapProduct,
		mapProducts,
		extractProducts,
		extractCategories,
	}
}
