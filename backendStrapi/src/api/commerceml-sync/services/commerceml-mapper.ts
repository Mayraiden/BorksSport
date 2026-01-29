/**
 * CommerceML Mapper Service
 * Маппит данные из CommerceML формата в Strapi Product модель
 */

import type { Core } from '@strapi/strapi'
import {
	extractSize,
	extractColor,
	extractDimensions,
} from '../../sbis-sync/utils/data-extractor'

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
	name: string
	description?: string
	article?: string
	price?: number
	sbisExternalId: string
	sbisId?: number
	categoryName?: string
	rootCategoryName?: string
	categoryId?: string // UUID категории из XML
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
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
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
		propertiesMap?: Map<string, string>
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
			if (!name) {
				strapi.log.warn(
					`[CommerceML Mapper] Product ${externalId} missing Наименование, skipping`
				)
				return null
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

			// Категории - в CommerceML это <Группы><Ид> (UUID категории)
			// Название категории будет найдено позже через мапу категорий
			let productCategoryId: string | undefined
			if (commerceMLProduct.Группы) {
				const groupIds = commerceMLProduct.Группы.Ид || commerceMLProduct.Группы.Id || commerceMLProduct.Группы.id
				if (groupIds) {
					const groupIdsArray = Array.isArray(groupIds) ? groupIds : [groupIds]
					// Берем первую группу (основную категорию товара)
					productCategoryId = groupIdsArray[0]
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

			// Габариты
			const dimensions = extractDimensions({
				...commerceMLProduct,
				attributes: characteristicsMap,
			})

			// Изображения - в CommerceML это прямые теги <Картинка> (может быть несколько)
			let images: string[] = []
			const imageBaseUrl =
				process.env.COMMERCEML_IMAGE_BASE_URL ||
				'https://api.sbis.ru/disk/api/v1/'

			// Проверяем разные варианты структуры
			let pictureTags: any = null

			// Вариант 1: Прямой тег <Картинка> (может быть массив или один элемент)
			if (commerceMLProduct.Картинка) {
				pictureTags = commerceMLProduct.Картинка
			}
			// Вариант 2: В обертке <Картинки>
			else if (commerceMLProduct.Картинки) {
				pictureTags =
					(commerceMLProduct.Картинки as any).Картинка ||
					(commerceMLProduct.Картинки as any).Picture ||
					(commerceMLProduct.Картинки as any).picture
			}
			// Вариант 3: Английские варианты
			else if (commerceMLProduct.Picture) {
				pictureTags = commerceMLProduct.Picture
			} else if (commerceMLProduct.picture) {
				pictureTags = commerceMLProduct.picture
			}

			if (pictureTags) {
				const pictureArray = Array.isArray(pictureTags) ? pictureTags : [pictureTags]
				const imageFilenames = pictureArray.filter(
					(pic: any) => pic && typeof pic === 'string' && pic.trim().length > 0
				)

				// Формируем URL для каждого изображения
				for (const filename of imageFilenames) {
					// Если это уже полный URL, используем его
					if (filename.startsWith('http://') || filename.startsWith('https://')) {
						images.push(filename)
					} else {
						// Иначе формируем URL из базового пути и имени файла
						const imageUrl = imageBaseUrl.endsWith('/')
							? imageBaseUrl + filename
							: imageBaseUrl + '/' + filename
						images.push(imageUrl)
					}
				}
			}

			// Для CommerceML изображения уже в формате URL, processImageArray не нужен
			// Но проверяем, что все URL валидны
			images = images.filter((url: string) => {
				return url && typeof url === 'string' && url.trim().length > 0
			})

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
				description: description || undefined,
				article: article || undefined,
				price: price || undefined,
				sbisExternalId: String(externalId),
				sbisId,
				categoryId: productCategoryId || undefined,
				categoryName: undefined, // Будет установлено при синхронизации
				rootCategoryName: undefined, // Будет установлено при синхронизации
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
	 * @returns Массив маппированных продуктов
	 */
	function mapProducts(
		commerceMLProducts: CommerceMLProduct[],
		propertiesMap?: Map<string, string>
	): MappedProduct[] {
		const mapped: MappedProduct[] = []

		for (const product of commerceMLProducts) {
			const mappedProduct = mapProduct(product, propertiesMap)
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
		extractProducts,
		extractCategories,
		extractClassifier,
		extractPropertiesMap,
	}
}
