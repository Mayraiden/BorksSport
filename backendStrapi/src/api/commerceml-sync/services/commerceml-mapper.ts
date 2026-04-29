/**
 * CommerceML Mapper Service
 * Маппит данные из CommerceML формата в Strapi Product модель
 */

import type { Core } from '@strapi/strapi'
import * as path from 'path'
import {
	extractSize,
	extractColor,
	extractDimensions,
} from '../utils/data-extractor'

export interface CommerceMLProduct {
	Ид?: string
	Наименование?: string
	Описание?: string
	Артикул?: string
	Группы?: {
		Группа?: any | any[]
		Ид?: string | string[]
		Id?: string | string[]
		id?: string | string[]
		[key: string]: any
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
	Картинка?: string | string[]
	Картинки?: {
		Картинка?: string | string[]
		Picture?: string | string[]
		picture?: string | string[]
		[key: string]: any
	}
	ЗначенияСвойств?: {
		ЗначенияСвойства?: any | any[]
		[key: string]: any
	}
	[key: string]: any
}

export interface MappedProduct {
	name?: string
	description?: string
	article?: string
	price?: number
	sbisExternalId: string
	sbisId?: number
	categoryName?: string
	rootCategoryName?: string
	// UUID(ы) из `<Товар><Группы><Ид>` (используем для маппинга на sport/productType/brand узлы классификатора)
	groupIds?: string[]
	// На всякий случай оставляем первый UUID как “categoryId” (legacy)
	categoryId?: string // UUID категории из XML
	sportCategoryName?: string
	productCategoryName?: string
	subcategoryName?: string
	brandName?: string
	model?: string
	size?: string
	color?: string
	length?: number
	width?: number
	height?: number
	weight?: number
	images?: string[]
	unit?: string
	stock?: number
	lastSyncAt: Date
	isPartial?: boolean
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	function normalizeImageKey(value: string): string {
		return String(value || '')
			.trim()
			.replace(/\\/g, '/')
			.replace(/^\.?\//, '')
			.toLowerCase()
	}

	function extractImageValue(pic: any): string | null {
		if (typeof pic === 'string') {
			const value = pic.trim()
			return value || null
		}
		if (!pic || typeof pic !== 'object') return null

		const candidates = [
			pic['#text'],
			pic._text,
			pic.value,
			pic.Value,
			pic.path,
			pic.Path,
			pic.file,
			pic.File,
			pic.url,
			pic.Url,
			pic.URL,
			pic.href,
			pic.Href,
		]
		for (const candidate of candidates) {
			if (typeof candidate === 'string' && candidate.trim()) {
				return candidate.trim()
			}
		}
		return null
	}

	function extractPictureReferences(commerceMLProduct: CommerceMLProduct): string[] {
		const collectFromNode = (node: any): any[] => {
			if (!node) return []
			if (Array.isArray(node)) return node
			return [node]
		}

		const pictureNodes: any[] = []
		if (commerceMLProduct.Картинка) pictureNodes.push(...collectFromNode(commerceMLProduct.Картинка))
		if (commerceMLProduct.Картинки) {
			const wrapped = commerceMLProduct.Картинки as any
			for (const key of ['Картинка', 'Picture', 'picture', 'Изображение', 'Image', 'image']) {
				if (wrapped?.[key]) {
					pictureNodes.push(...collectFromNode(wrapped[key]))
				}
			}
		}
		for (const key of ['Picture', 'picture', 'Image', 'image']) {
			if ((commerceMLProduct as any)[key]) {
				pictureNodes.push(...collectFromNode((commerceMLProduct as any)[key]))
			}
		}

		const unique = new Set<string>()
		for (const node of pictureNodes) {
			const value = extractImageValue(node)
			if (value) unique.add(value)
		}
		return [...unique]
	}

	function resolveImageFromMap(filename: string, imageMap?: Map<string, string>): string | null {
		if (!imageMap || imageMap.size === 0) return null
		const normalized = normalizeImageKey(filename)
		const base = normalizeImageKey(path.basename(filename))
		const keyCandidates = [filename, normalized, base]
		for (const key of keyCandidates) {
			const direct = imageMap.get(key)
			if (direct) return direct
		}
		return null
	}

	function normalizeText(value?: string | null): string {
		return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
	}

	function pickCharacteristicValue(
		characteristicsMap: Record<string, any>,
		aliases: string[]
	): string | undefined {
		const normalizedAliases = aliases.map(normalizeText)
		for (const [key, rawValue] of Object.entries(characteristicsMap)) {
			if (normalizedAliases.includes(normalizeText(key))) {
				const value = String(rawValue || '').trim()
				if (value) {
					return value
				}
			}
		}
		return undefined
	}

	/**
	 * Извлекает свойства из классификатора для маппинга ID свойств в названия
	 * @param classifier - Классификатор из XML
	 * @returns Map: ID свойства -> Название свойства
	 */
	function extractPropertiesMap(classifier: any): Map<string, string> {
		const propertiesMap = new Map<string, string>()

		if (!classifier) {
			return propertiesMap
		}

		const properties =
			classifier.Свойства?.Свойство ||
			classifier.Properties?.Property ||
			classifier.свойства?.свойство ||
			[]

		const propertiesArray = Array.isArray(properties) ? properties : properties ? [properties] : []

		for (const prop of propertiesArray) {
			const propId = prop.Ид || prop.Id || prop.id
			const propName =
				prop.Наименование || prop.Name || prop.name || ''

			if (propId && propName) {
				propertiesMap.set(propId, propName)
			}
		}

		return propertiesMap
	}

	/**
	 * Маппит CommerceML продукт в Strapi Product формат
	 * @param commerceMLProduct - Продукт из CommerceML XML
	 * @param propertiesMap - Map ID свойства -> Название свойства (опционально)
	 * @returns Маппированный продукт для Strapi
	 */
	function mapProduct(
		commerceMLProduct: CommerceMLProduct,
		propertiesMap?: Map<string, string>,
		imageMap?: Map<string, string>,
		options?: { allowPartial?: boolean }
	): MappedProduct | null {
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
			if (!name && !options?.allowPartial) {
				strapi.log.warn(
					`[CommerceML Mapper] Product ${externalId} missing Наименование, skipping`
				)
				return null
			}
			const isPartial = !name
			if (isPartial) {
				strapi.log.info(
					`[CommerceML Mapper] Product ${externalId} missing Наименование, mapping as partial delta`
				)
			}

			// Описание - в CommerceML это plain text с переносами строк
			const description =
				commerceMLProduct.Описание ||
				commerceMLProduct.Description ||
				commerceMLProduct.description ||
				''
			// Сохраняем описание как есть (plain text), переносы строк сохраняются
			// Для richtext поля Strapi может потребоваться конвертация \n в <br>, но пока оставляем как есть

			// Артикул - извлекаем из названия товара (формат: "арт. X1311166" или "арт.X1311166")
			let article: string | undefined = undefined

			// Сначала пробуем найти в отдельном поле
			if (commerceMLProduct.Артикул || commerceMLProduct.Article || commerceMLProduct.article) {
				article =
					commerceMLProduct.Артикул ||
					commerceMLProduct.Article ||
					commerceMLProduct.article ||
					undefined
			} else {
				// Извлекаем из названия через regex
				// Паттерн: "арт." или "арт" (опционально), пробелы, опционально "X", затем цифры
				const articleMatch = name.match(/арт\.?\s*X?([0-9]+)/i)
				if (articleMatch && articleMatch[1]) {
					article = articleMatch[1]
					// Если было "X" перед цифрами, добавляем его
					if (articleMatch[0].includes('X') || articleMatch[0].includes('x')) {
						article = 'X' + article
					}
				}
			}

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

			// Категории - в CommerceML это `<Группы><Ид>` (UUID узла классификатора)
			// Примечание: узел может соответствовать не только бренду, поэтому забираем ВСЕ ИД.
			let groupIds: string[] = []
			if (commerceMLProduct.Группы) {
				const rawGroupIds =
					commerceMLProduct.Группы.Ид ||
					commerceMLProduct.Группы.Id ||
					commerceMLProduct.Группы.id
				if (rawGroupIds) {
					const groupIdsArray = Array.isArray(rawGroupIds)
						? rawGroupIds
						: [rawGroupIds]
					groupIds = groupIdsArray.map((id) => String(id)).filter(Boolean)
				}
			}

			// Характеристики - в CommerceML используется <ЗначенияСвойств><ЗначенияСвойства>
			const propertyValues =
				commerceMLProduct.ЗначенияСвойств?.ЗначенияСвойства ||
				commerceMLProduct.PropertyValues?.PropertyValue ||
				commerceMLProduct.значенияСвойств?.значенияСвойства ||
				[]

			const propertyValuesArray = Array.isArray(propertyValues)
				? propertyValues
				: propertyValues
				? [propertyValues]
				: []

			// Преобразуем характеристики в объект для удобства
			// Маппим ID свойства в название через propertiesMap
			const characteristicsMap: Record<string, any> = {}
			for (const propValue of propertyValuesArray) {
				const propId = propValue.Ид || propValue.Id || propValue.id || ''
				const value = propValue.Значение || propValue.Value || propValue.value || ''

				if (!propId || !value) {
					continue
				}

				// Пытаемся получить название свойства из мапы
				let propName = propertiesMap?.get(propId) || ''

				// Если не нашли в мапе, пробуем извлечь из ID (формат: prefix_Название)
				if (!propName && propId.includes('_')) {
					const parts = propId.split('_')
					if (parts.length > 1) {
						propName = parts.slice(1).join('_')
					}
				}

				// Если все еще нет названия, используем ID
				if (!propName) {
					propName = propId
				}

				characteristicsMap[propName] = value
			}

			const size = extractSize(characteristicsMap, name)
			const color = extractColor(characteristicsMap, name)

			// Извлекаем категории из характеристик (для фильтрации)
			const sportCategoryName = pickCharacteristicValue(characteristicsMap, [
				'Вид спорта',
				'Вид спорт',
				'Тип спорту',
				'Тип спорта',
			])
			const productCategoryName = pickCharacteristicValue(characteristicsMap, [
				'Категория товара',
				'Категория Товара',
				'Категория това',
				'Категория товар',
			])
			const subcategoryName = pickCharacteristicValue(characteristicsMap, [
				'Тип товара',
				'Типа товара',
				'Вид товара',
				'Видтовара',
				'Ви товара',
			])
			const brandName = pickCharacteristicValue(characteristicsMap, [
				'Бренд',
				'Брэнд',
			])

			// Модель (группировка вариаций в каталоге)
			const modelName = pickCharacteristicValue(characteristicsMap, [
				'Модель',
				'Модел',
				'Модель товара',
				'НаименованиеМодели',
				'Наименование модели',
				'Model',
			])

			// Если в характеристиках нет отдельного атрибута "Модель",
			// пробуем взять код модели из имени (обычно это токен с буквами+цифрами).
			const modelFromName = (() => {
				if (!name) return undefined
				const tokens = String(name).match(/\b[A-Z0-9][A-Z0-9-]{3,}\b/g) || []
				for (const tokenRaw of tokens) {
					const token = tokenRaw.trim()
					// Исключаем артикулы вида X12345
					if (/^X\d+$/i.test(token)) continue
					// Нужно минимум одна буква и одна цифра, чтобы не брать размеры/US/и т.п.
					if (!/[A-Z]/i.test(token) || !/\d/.test(token)) continue
					return token.toUpperCase().replace(/[^A-Z0-9-]/g, '')
				}
				return undefined
			})()

			// Габариты
			const dimensions = extractDimensions({
				...commerceMLProduct,
				attributes: characteristicsMap,
			})

			// Изображения - в CommerceML это прямые теги <Картинка> (может быть несколько)
			// Если картинки были загружены из архива, используем локальные URL из Strapi
			// Иначе используем URL от disk.sbis.ru
			let images: string[] = []
			const imageBaseUrl = 'https://disk.sbis.ru/disk/api/v1/'

			const pictureRefs = extractPictureReferences(commerceMLProduct)
			let imagesMatchedFromArchive = 0
			let imagesFallbackToCloud = 0
			if (pictureRefs.length > 0) {
				for (const filename of pictureRefs) {
					let imageUrl: string

					// Если это уже полный URL, используем его
					if (filename.startsWith('http://') || filename.startsWith('https://')) {
						imageUrl = filename
					} else {
						const imageUrlFromMap = resolveImageFromMap(filename, imageMap)

						if (imageUrlFromMap) {
							// Используем локальный URL из файловой системы
							imageUrl = imageUrlFromMap
							imagesMatchedFromArchive += 1
						} else {
							// Fallback: используем URL от disk.sbis.ru
							// Убираем только конечное расширение файла, не трогая остальную часть ID.
							const cleanFilename = filename.replace(/\.[^/.]+$/, '').trim()
							imageUrl = imageBaseUrl + cleanFilename
							imagesFallbackToCloud += 1
						}
					}

					images.push(imageUrl)
				}
				strapi.log.debug(
					`[CommerceML Mapper] Product ${externalId}: pictureRefs=${pictureRefs.length}, mappedFromArchive=${imagesMatchedFromArchive}, cloudFallback=${imagesFallbackToCloud}`
				)
			}

			// Фильтруем пустые значения
			images = images.filter((url: string) => {
				return url && typeof url === 'string' && url.trim().length > 0
			})

			// Единица измерения
			const unit =
				commerceMLProduct.Единица ||
				commerceMLProduct.Unit ||
				commerceMLProduct.unit ||
				null

			// Для CommerceML не вычисляем sbisId из UUID.
			// Надежный ключ upsert — sbisExternalId (исходный Ид из CommerceML).
			const sbisId: number | undefined = undefined

			return {
				name: name || undefined,
				description: description || undefined,
				article: article || undefined,
				price: price || undefined,
				sbisExternalId: String(externalId),
				sbisId,
				groupIds: groupIds.length > 0 ? groupIds : undefined,
				categoryId: groupIds[0] || undefined,
				categoryName: undefined, // Будет установлено при синхронизации
				rootCategoryName: undefined, // Будет установлено при синхронизации
				sportCategoryName: sportCategoryName || undefined,
				productCategoryName: productCategoryName || undefined,
				subcategoryName: subcategoryName || undefined,
				brandName: brandName || undefined,
				model: modelName || modelFromName || undefined,
				size: size || undefined,
				color: color || undefined,
				length: dimensions.length || undefined,
				width: dimensions.width || undefined,
				height: dimensions.height || undefined,
				weight: dimensions.weight || undefined,
				images: images && images.length > 0 ? images : [],
				unit: unit || undefined,
				stock: undefined, // Будет установлено из offers.xml
				lastSyncAt: new Date(),
				isPartial,
			}
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to map product:', error.message)
			return null
		}
	}

	/**
	 * Маппит массив продуктов из CommerceML
	 * @param commerceMLProducts - Массив продуктов из CommerceML
	 * @param propertiesMap - Map ID свойства -> Название свойства (опционально)
	 * @param imageMap - Map: имя файла -> URL путь (опционально)
	 * @returns Массив маппированных продуктов
	 */
	function mapProducts(
		commerceMLProducts: CommerceMLProduct[],
		propertiesMap?: Map<string, string>,
		imageMap?: Map<string, string>,
		options?: { allowPartial?: boolean }
	): MappedProduct[] {
		const mapped: MappedProduct[] = []

		for (const product of commerceMLProducts) {
			const mappedProduct = mapProduct(product, propertiesMap, imageMap, options)
			if (mappedProduct) {
				mapped.push(mappedProduct)
			}
		}

		return mapped
	}

	function extractCategoriesFromMappedProducts(mappedProducts: MappedProduct[]): any[] {
		const result: any[] = []
		const seen = new Set<string>()

		const makeId = (parts: string[]) => parts.map(normalizeText).join('::')

		for (const product of mappedProducts) {
			const sportName = (product.sportCategoryName || '').trim()
			const productCategoryName = (product.productCategoryName || '').trim()
			const brandName = (product.brandName || '').trim()

			if (!sportName || !productCategoryName) {
				continue
			}

			const sportId = makeId(['sport', sportName])
			if (!seen.has(sportId)) {
				seen.add(sportId)
				result.push({
					Ид: sportId,
					Наименование: sportName,
					level: 0,
					parentId: null,
					parentNumericId: null,
					numericId: null,
					type: 'sport',
				})
			}

			const productCategoryId = makeId(['productType', sportName, productCategoryName])
			if (!seen.has(productCategoryId)) {
				seen.add(productCategoryId)
				result.push({
					Ид: productCategoryId,
					Наименование: productCategoryName,
					level: 1,
					parentId: sportId,
					parentNumericId: null,
					numericId: null,
					type: 'productType',
				})
			}

			if (brandName) {
				const brandId = makeId(['brand', sportName, productCategoryName, brandName])
				if (!seen.has(brandId)) {
					seen.add(brandId)
					result.push({
						Ид: brandId,
						Наименование: brandName,
						level: 2,
						parentId: productCategoryId,
						parentNumericId: null,
						numericId: null,
						type: 'brand',
					})
				}
			}
		}

		return result
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
	 * Преобразует UUID в числовой ID для sbisId
	 * Использует простой хеш для конвертации UUID в число
	 */
	function uuidToNumericId(uuid: string): number {
		// Простой хеш для конвертации UUID в число
		let hash = 0
		for (let i = 0; i < uuid.length; i++) {
			const char = uuid.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Конвертируем в 32-битное число
		}
		// Возвращаем положительное число
		return Math.abs(hash)
	}

	/**
	 * Рекурсивно извлекает категории из группы
	 * @param group - Группа из XML
	 * @param level - Текущий уровень вложенности
	 * @param parentId - ID родительской категории (UUID)
	 * @param parentNumericId - Числовой ID родителя
	 * @param result - Массив для накопления результатов
	 */
	function extractCategoriesRecursive(
		group: any,
		level: number,
		parentId: string | null,
		parentNumericId: number | null,
		result: any[]
	): void {
		if (!group) {
			return
		}

		// Обрабатываем как массив, так и одиночный элемент
		const groups = Array.isArray(group) ? group : [group]

		for (const categoryGroup of groups) {
			const categoryId = categoryGroup.Ид || categoryGroup.Id || categoryGroup.id
			const categoryName =
				categoryGroup.Наименование ||
				categoryGroup.Name ||
				categoryGroup.name ||
				''

			if (!categoryId || !categoryName) {
				continue
			}

			const numericId = uuidToNumericId(categoryId)

			// Добавляем категорию в результат
			result.push({
				Ид: categoryId,
				Наименование: categoryName,
				level,
				parentId,
				parentNumericId,
				numericId,
				children: categoryGroup.Группы || categoryGroup.Groups || categoryGroup.groups,
			})

			// Рекурсивно обрабатываем дочерние группы
			const childGroups =
				categoryGroup.Группы?.Группа ||
				categoryGroup.Groups?.Group ||
				categoryGroup.groups?.group ||
				[]

			if (childGroups && (Array.isArray(childGroups) ? childGroups.length > 0 : childGroups)) {
				extractCategoriesRecursive(
					childGroups,
					level + 1,
					categoryId,
					numericId,
					result
				)
			}
		}
	}

	/**
	 * Извлекает категории из парсированного CommerceML XML с построением иерархии
	 * @param parsedXML - Парсированный XML объект
	 * @returns Массив категорий с информацией об уровнях и родителях
	 */
	function extractCategories(parsedXML: any): any[] {
		try {
			const commercialInfo =
				parsedXML?.КоммерческаяИнформация ||
				parsedXML?.commercialInformation ||
				parsedXML

			// Ищем категории в Классификаторе
			const classifier =
				commercialInfo?.Классификатор ||
				commercialInfo?.Classifier ||
				commercialInfo?.классификатор

			if (!classifier) {
				strapi.log.warn('[CommerceML Mapper] No classifier found in XML')
				return []
			}

			const groups =
				classifier?.Группы?.Группа ||
				classifier?.Groups?.Group ||
				classifier?.группы?.группа ||
				[]

			if (!groups || (Array.isArray(groups) && groups.length === 0)) {
				strapi.log.warn('[CommerceML Mapper] No groups found in classifier')
				return []
			}

			// Рекурсивно извлекаем все категории
			const result: any[] = []
			extractCategoriesRecursive(groups, 0, null, null, result)

			strapi.log.info(
				`[CommerceML Mapper] Extracted ${result.length} categories from XML (levels: ${Math.max(...result.map((c) => c.level), 0)})`
			)

			return result
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to extract categories:', error.message)
			return []
		}
	}

	/**
	 * Извлекает классификатор из парсированного CommerceML XML
	 * @param parsedXML - Парсированный XML объект
	 * @returns Классификатор или null
	 */
	function extractClassifier(parsedXML: any): any {
		try {
			const commercialInfo =
				parsedXML?.КоммерческаяИнформация ||
				parsedXML?.commercialInformation ||
				parsedXML

			return (
				commercialInfo?.Классификатор ||
				commercialInfo?.Classifier ||
				commercialInfo?.классификатор ||
				null
			)
		} catch (error: any) {
			strapi.log.error('[CommerceML Mapper] Failed to extract classifier:', error.message)
			return null
		}
	}

	return {
		mapProduct,
		mapProducts,
		extractCategoriesFromMappedProducts,
		extractProducts,
		extractCategories,
		extractClassifier,
		extractPropertiesMap,
	}
}
