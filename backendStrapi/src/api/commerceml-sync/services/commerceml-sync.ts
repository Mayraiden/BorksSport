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
	 * @returns Результат синхронизации
	 */
	async function processCatalog(xmlString: string) {
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

			// Маппим продукты с propertiesMap для характеристик
			const mappedProducts = mapperService.mapProducts(products, propertiesMap)

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
