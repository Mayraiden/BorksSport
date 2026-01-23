/**
 * XML Parser Service для CommerceML
 * Парсит XML от Saby в JSON структуру
 */

import { XMLParser } from 'fast-xml-parser'
import type { Core } from '@strapi/strapi'

export interface ParsedCommerceML {
	catalog?: any
	offers?: any
	rests?: any
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		textNodeName: '#text',
		parseAttributeValue: true,
		trimValues: true,
		parseTagValue: true,
	})

	return {
		/**
		 * Парсит XML строку в JSON объект
		 * @param xmlString - XML строка для парсинга
		 * @returns Парсированный JSON объект
		 */
		parseXML(xmlString: string): any {
			try {
				strapi.log.debug('[CommerceML XML Parser] Starting XML parsing...')
				const result = parser.parse(xmlString)
				strapi.log.debug('[CommerceML XML Parser] XML parsed successfully')
				return result
			} catch (error: any) {
				strapi.log.error('[CommerceML XML Parser] Failed to parse XML:', error.message)
				throw new Error(`XML parsing failed: ${error.message}`)
			}
		},

		/**
		 * Валидирует структуру CommerceML XML
		 * @param parsedData - Парсированные данные
		 * @param type - Тип документа (catalog, offers, rests)
		 * @returns true если структура валидна
		 */
		validateStructure(parsedData: any, type: 'catalog' | 'offers' | 'rests'): boolean {
			try {
				if (type === 'catalog') {
					// Проверяем наличие корневого элемента CommerceML
					return !!(
						parsedData?.КоммерческаяИнформация ||
						parsedData?.commercialInformation ||
						parsedData?.Каталог ||
						parsedData?.catalog
					)
				}

				if (type === 'offers') {
					return !!(
						parsedData?.КоммерческаяИнформация ||
						parsedData?.commercialInformation ||
						parsedData?.ПакетПредложений ||
						parsedData?.offersPackage
					)
				}

				if (type === 'rests') {
					return !!(
						parsedData?.КоммерческаяИнформация ||
						parsedData?.commercialInformation ||
						parsedData?.ПакетПредложений ||
						parsedData?.offersPackage
					)
				}

				return false
			} catch (error: any) {
				strapi.log.error('[CommerceML XML Parser] Validation failed:', error.message)
				return false
			}
		},
	}
}
