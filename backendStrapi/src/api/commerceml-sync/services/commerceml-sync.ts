/**
 * CommerceML Sync Service
 * Основной сервис для синхронизации данных через CommerceML
 */

import type { Core } from '@strapi/strapi'
import * as fs from 'fs'
import * as path from 'path'

export default ({ strapi }: { strapi: Core.Strapi }) => {
	// Получаем сервисы через lazy loading
	const getXmlParserService = () => strapi.service('api::commerceml-sync.xml-parser')
	const getMapperService = () => strapi.service('api::commerceml-sync.commerceml-mapper')
	const getProductSyncService = () => strapi.service('api::commerceml-sync.product-sync')

	/**
	 * Сохраняет входящий XML в файл для анализа (если включено логирование)
	 * @param xmlString - XML строка
	 * @param type - Тип документа (catalog, offers, rests)
	 */
	function logXMLRequest(xmlString: string, type: string) {
		const shouldLog = process.env.COMMERCEML_LOG_REQUESTS === 'true'

		if (!shouldLog) {
			return
		}

		try {
			const logsDir = path.join(process.cwd(), 'logs', 'commerceml-sync')
			if (!fs.existsSync(logsDir)) {
				fs.mkdirSync(logsDir, { recursive: true })
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			const logFilePath = path.join(logsDir, `${type}-${timestamp}.xml`)

			fs.writeFileSync(logFilePath, xmlString, 'utf-8')
			strapi.log.info(`[CommerceML Sync] Saved ${type} XML to ${logFilePath}`)
		} catch (error: any) {
			strapi.log.error(`[CommerceML Sync] Failed to save XML log:`, error.message)
		}
	}

	/**
	 * Обрабатывает catalog.xml
	 * @param xmlString - XML строка из catalog.xml
	 * @param tempImageMap - Map: имя файла -> Buffer (временные файлы из ZIP)
	 * @returns Результат синхронизации
	 */
	async function processCatalog(xmlString: string, tempImageMap?: Map<string, Buffer>) {
		try {
			strapi.log.info('[CommerceML Sync] Processing catalog.xml...')

			// Логируем входящий XML если включено
			logXMLRequest(xmlString, 'catalog')

			// Парсим XML
			const xmlParserService = getXmlParserService()
			const parsedXML = xmlParserService.parseXML(xmlString)

			// Валидируем структуру
			if (!xmlParserService.validateStructure(parsedXML, 'catalog')) {
				throw new Error('Invalid catalog XML structure')
			}

			// Извлекаем классификатор и категории
			const mapperService = getMapperService()
			const classifier = mapperService.extractClassifier(parsedXML)
			const propertiesMap = classifier
				? mapperService.extractPropertiesMap(classifier)
				: new Map<string, string>()

			// Извлекаем категории с иерархией
			const categories = mapperService.extractCategories(parsedXML)

			// Синхронизируем категории сначала (построение иерархии)
			const productSyncService = getProductSyncService()
			let categoryMap = new Map<string, number>()
			if (categories.length > 0) {
				categoryMap = await productSyncService.syncCategories(categories)
				strapi.log.info(
					`[CommerceML Sync] Categories synced: ${categoryMap.size} categories processed`
				)
			}

			// Извлекаем продукты
			const products = mapperService.extractProducts(parsedXML)

			if (products.length === 0) {
				strapi.log.warn('[CommerceML Sync] No products found in catalog.xml')
				return {
					success: true,
					message: 'Catalog processed, but no products found',
					stats: {
						saved: 0,
						updated: 0,
						errors: 0,
						total: 0,
					},
				}
			}

			// Перемещаем файлы из временной папки в структуру products/{productId}/
			// и создаем imageMap с URL путями
			const imageMap = new Map<string, string>() // имя файла -> URL путь
			if (tempImageMap && tempImageMap.size > 0) {
				const publicDir = path.join(process.cwd(), 'public', 'uploads', 'commerceml')
				const productsDir = path.join(publicDir, 'products')
				
				// Создаем директорию products, если её нет
				if (!fs.existsSync(productsDir)) {
					fs.mkdirSync(productsDir, { recursive: true })
				}

				strapi.log.info(
					`[CommerceML Sync] Moving ${tempImageMap.size} images to product directories...`
				)

				// Для каждого продукта находим его картинки и перемещаем файлы
				for (const product of products) {
					try {
						// Получаем productId из Ид
						const productId = product.Ид || product.Id || product.id
						if (!productId) {
							continue
						}

						// Извлекаем имена файлов из тегов <Картинка>
						let pictureTags: any = null
						if (product.Картинка) {
							pictureTags = product.Картинка
						} else if (product.Картинки) {
							pictureTags =
								(product.Картинки as any).Картинка ||
								(product.Картинки as any).Picture ||
								(product.Картинки as any).picture
						} else if (product.Picture) {
							pictureTags = product.Picture
						} else if (product.picture) {
							pictureTags = product.picture
						}

						if (!pictureTags) {
							continue
						}

						const pictureArray = Array.isArray(pictureTags) ? pictureTags : [pictureTags]
						const imageFilenames = pictureArray.filter(
							(pic: any) => pic && typeof pic === 'string' && pic.trim().length > 0
						)

						// Создаем папку для продукта
						const productDir = path.join(productsDir, String(productId))
						if (!fs.existsSync(productDir)) {
							fs.mkdirSync(productDir, { recursive: true })
						}

						// Перемещаем файлы для этого продукта
						for (const filename of imageFilenames) {
							// Пропускаем полные URL
							if (filename.startsWith('http://') || filename.startsWith('https://')) {
								continue
							}

							const imageName = path.basename(filename)
							
							// Проверяем, есть ли файл во временной мапе
							if (!tempImageMap.has(imageName)) {
								continue
							}

							try {
								// Получаем buffer из временной мапы
								const imageBuffer = tempImageMap.get(imageName)!
								
								// Создаем безопасное имя файла
								const safeImageName = imageName.replace(/[^a-zA-Z0-9._-]/g, '_')
								
								// Путь для сохранения
								const targetPath = path.join(productDir, safeImageName)
								
								// Сохраняем файл (перезаписываем, если существует)
								fs.writeFileSync(targetPath, imageBuffer)
								
								// Формируем относительный URL
								const relativeUrl = `/uploads/commerceml/products/${productId}/${safeImageName}`
								
								// Сохраняем в imageMap
								imageMap.set(imageName, relativeUrl)
								
								strapi.log.debug(
									`[CommerceML Sync] Moved image ${imageName} to ${relativeUrl}`
								)
							} catch (fileError: any) {
								strapi.log.warn(
									`[CommerceML Sync] Failed to move image ${imageName} for product ${productId}: ${fileError.message}`
								)
							}
						}
					} catch (productError: any) {
						strapi.log.warn(
							`[CommerceML Sync] Failed to process images for product: ${productError.message}`
						)
					}
				}

				strapi.log.info(
					`[CommerceML Sync] Moved ${imageMap.size} images to product directories`
				)

				// Очищаем временную папку
				try {
					const tempDir = path.join(publicDir, 'temp')
					if (fs.existsSync(tempDir)) {
						const tempFiles = fs.readdirSync(tempDir)
						for (const file of tempFiles) {
							try {
								fs.unlinkSync(path.join(tempDir, file))
							} catch (deleteError: any) {
								strapi.log.warn(
									`[CommerceML Sync] Failed to delete temp file ${file}: ${deleteError.message}`
								)
							}
						}
						// Пытаемся удалить саму папку (может не получиться, если есть файлы)
						try {
							fs.rmdirSync(tempDir)
						} catch {
							// Игнорируем ошибку, если папка не пуста
						}
					}
				} catch (cleanupError: any) {
					strapi.log.warn(
						`[CommerceML Sync] Failed to cleanup temp directory: ${cleanupError.message}`
					)
				}
			}

			// Маппим продукты с propertiesMap для характеристик и imageMap для картинок
			const mappedProducts = mapperService.mapProducts(products, propertiesMap, imageMap)

			if (mappedProducts.length === 0) {
				strapi.log.warn('[CommerceML Sync] No products mapped successfully')
				return {
					success: true,
					message: 'Catalog processed, but no products mapped',
					stats: {
						saved: 0,
						updated: 0,
						errors: 0,
						total: products.length,
					},
				}
			}

			// Синхронизируем продукты с мапой категорий
			const stats = await productSyncService.syncProducts(mappedProducts, categoryMap, categories)

			strapi.log.info(
				`[CommerceML Sync] Catalog processed: ${stats.saved} saved, ${stats.updated} updated, ${stats.errors} errors`
			)

			return {
				success: true,
				message: 'Catalog processed successfully',
				stats,
			}
		} catch (error: any) {
			strapi.log.error('[CommerceML Sync] Failed to process catalog:', error.message)
			throw error
		}
	}

	/**
	 * Обрабатывает offers.xml (цены)
	 * @param xmlString - XML строка из offers.xml
	 * @returns Результат синхронизации цен
	 */
	async function processOffers(xmlString: string) {
		try {
			strapi.log.info('[CommerceML Sync] Processing offers.xml...')

			// Логируем входящий XML если включено
			logXMLRequest(xmlString, 'offers')

			// Парсим XML
			const xmlParserService = getXmlParserService()
			const parsedXML = xmlParserService.parseXML(xmlString)

			// Валидируем структуру
			if (!xmlParserService.validateStructure(parsedXML, 'offers')) {
				throw new Error('Invalid offers XML structure')
			}

			// Синхронизируем цены
			const productSyncService = getProductSyncService()
			const stats = await productSyncService.syncPrices(parsedXML)

			strapi.log.info(
				`[CommerceML Sync] Offers processed: ${stats.updated} prices updated, ${stats.errors} errors`
			)

			return {
				success: true,
				message: 'Offers processed successfully',
				stats,
			}
		} catch (error: any) {
			strapi.log.error('[CommerceML Sync] Failed to process offers:', error.message)
			throw error
		}
	}

	/**
	 * Обрабатывает rests.xml (остатки)
	 * @param xmlString - XML строка из rests.xml
	 * @returns Результат синхронизации остатков
	 */
	async function processRests(xmlString: string) {
		try {
			strapi.log.info('[CommerceML Sync] Processing rests.xml...')

			// Логируем входящий XML если включено
			logXMLRequest(xmlString, 'rests')

			// Парсим XML
			const xmlParserService = getXmlParserService()
			const parsedXML = xmlParserService.parseXML(xmlString)

			// Валидируем структуру
			if (!xmlParserService.validateStructure(parsedXML, 'rests')) {
				throw new Error('Invalid rests XML structure')
			}

			// Синхронизируем остатки (пока не реализовано)
			const productSyncService = getProductSyncService()
			const stats = await productSyncService.syncRests(parsedXML)

			strapi.log.info('[CommerceML Sync] Rests processed (not implemented yet)')

			return {
				success: true,
				message: 'Rests processed (not implemented yet)',
				stats,
			}
		} catch (error: any) {
			strapi.log.error('[CommerceML Sync] Failed to process rests:', error.message)
			throw error
		}
	}

	/**
	 * Тестовый метод для проверки подключения
	 * @returns Статус сервиса
	 */
	async function testConnection() {
		return {
			success: true,
			message: 'CommerceML sync service is running',
			timestamp: new Date().toISOString(),
			config: {
				basicAuthConfigured:
					!!process.env.COMMERCEML_BASIC_AUTH_USER &&
					!!process.env.COMMERCEML_BASIC_AUTH_PASSWORD,
				logRequests: process.env.COMMERCEML_LOG_REQUESTS === 'true',
			},
		}
	}

	return {
		processCatalog,
		processOffers,
		processRests,
		testConnection,
	}
}
