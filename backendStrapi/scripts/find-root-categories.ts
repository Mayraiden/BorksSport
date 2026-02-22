/**
 * Скрипт для поиска всех главных категорий в архивах CommerceML
 * Запуск: npx ts-node scripts/find-root-categories.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { XMLParser } from 'fast-xml-parser'

interface Category {
	Ид: string
	Наименование: string
	level: number
	parentId: string | null
}

/**
 * Рекурсивно извлекает категории из группы
 */
function extractCategoriesRecursive(
	group: any,
	level: number,
	parentId: string | null,
	result: Category[]
): void {
	if (!group) return

	const groups = Array.isArray(group) ? group : [group]

	for (const g of groups) {
		const categoryId = g.Ид || g.Id || g.id
		const categoryName = g.Наименование || g.Name || g.name

		if (categoryId && categoryName) {
			result.push({
				Ид: categoryId,
				Наименование: categoryName,
				level,
				parentId,
			})

			// Рекурсивно обрабатываем вложенные группы
			const nestedGroups = g.Группы?.Группа || g.Groups?.Group || g.группы?.группа
			if (nestedGroups) {
				extractCategoriesRecursive(nestedGroups, level + 1, categoryId, result)
			}
		}
	}
}

/**
 * Извлекает категории из XML
 */
function extractCategories(xmlString: string): Category[] {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		textNodeName: '#text',
		parseAttributeValue: true,
		trimValues: true,
		parseTagValue: true,
	})

	const parsedXML = parser.parse(xmlString)

	const commercialInfo =
		parsedXML?.КоммерческаяИнформация ||
		parsedXML?.commercialInformation ||
		parsedXML

	const classifier =
		commercialInfo?.Классификатор ||
		commercialInfo?.Classifier ||
		commercialInfo?.классификатор

	if (!classifier) {
		return []
	}

	const groups =
		classifier?.Группы?.Группа ||
		classifier?.Groups?.Group ||
		classifier?.группы?.группа ||
		[]

	if (!groups || (Array.isArray(groups) && groups.length === 0)) {
		return []
	}

	const result: Category[] = []
	extractCategoriesRecursive(groups, 0, null, result)

	return result
}

/**
 * Главная функция
 */
function main() {
	// Папка находится в корне проекта, а не в backendStrapi/data
	const archivesDir = path.join(process.cwd(), '..', 'commerceml-archives')

	if (!fs.existsSync(archivesDir)) {
		console.error(`Папка не найдена: ${archivesDir}`)
		process.exit(1)
	}

	console.log(`Поиск XML файлов в: ${archivesDir}\n`)

	// Находим все XML файлы
	const xmlFiles: string[] = []

	function findXmlFiles(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)

			if (entry.isDirectory()) {
				findXmlFiles(fullPath)
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
				// Ищем только файлы с категориями (import, catalog)
				if (
					entry.name.toLowerCase().includes('import') ||
					entry.name.toLowerCase().includes('catalog')
				) {
					xmlFiles.push(fullPath)
				}
			}
		}
	}

	findXmlFiles(archivesDir)

	if (xmlFiles.length === 0) {
		console.log('XML файлы не найдены')
		process.exit(0)
	}

	console.log(`Найдено XML файлов: ${xmlFiles.length}\n`)

	// Собираем все главные категории
	const rootCategoriesMap = new Map<string, { name: string; files: string[] }>()

	for (const xmlFile of xmlFiles) {
		try {
			console.log(`Обработка: ${path.relative(archivesDir, xmlFile)}`)
			const xmlContent = fs.readFileSync(xmlFile, 'utf-8')
			const categories = extractCategories(xmlContent)

			// Фильтруем только главные категории (level === 0)
			const rootCategories = categories.filter((c) => c.level === 0)

			for (const category of rootCategories) {
				const existing = rootCategoriesMap.get(category.Ид)
				if (existing) {
					if (!existing.files.includes(xmlFile)) {
						existing.files.push(xmlFile)
					}
				} else {
					rootCategoriesMap.set(category.Ид, {
						name: category.Наименование,
						files: [xmlFile],
					})
				}
			}
		} catch (error: any) {
			console.error(`Ошибка при обработке ${xmlFile}:`, error.message)
		}
	}

	// Собираем ВСЕ категории (не только главные) для поиска
	const allCategoriesMap = new Map<string, { name: string; level: number; parentId: string | null; files: string[] }>()

	for (const xmlFile of xmlFiles) {
		try {
			const xmlContent = fs.readFileSync(xmlFile, 'utf-8')
			const categories = extractCategories(xmlContent)

			for (const category of categories) {
				const key = `${category.Ид}_${category.level}`
				const existing = allCategoriesMap.get(key)
				if (existing) {
					if (!existing.files.includes(xmlFile)) {
						existing.files.push(xmlFile)
					}
				} else {
					allCategoriesMap.set(key, {
						name: category.Наименование,
						level: category.level,
						parentId: category.parentId,
						files: [xmlFile],
					})
				}
			}
		} catch (error: any) {
			console.error(`Ошибка при обработке ${xmlFile}:`, error.message)
		}
	}

	// Ищем категории с упоминанием "бейсбол" или "софтбол"
	const searchTerms = ['бейсбол', 'софтбол', 'baseball', 'softball']
	const foundCategories: Array<{ id: string; name: string; level: number; parentId: string | null; files: string[] }> = []

	for (const [key, info] of allCategoriesMap.entries()) {
		const nameLower = info.name.toLowerCase()
		if (searchTerms.some(term => nameLower.includes(term.toLowerCase()))) {
			foundCategories.push({
				id: key.split('_')[0],
				name: info.name,
				level: info.level,
				parentId: info.parentId,
				files: info.files,
			})
		}
	}

	// Выводим результаты
	console.log('\n' + '='.repeat(80))
	console.log('ГЛАВНЫЕ КАТЕГОРИИ (ROOT CATEGORIES)')
	console.log('='.repeat(80) + '\n')

	if (rootCategoriesMap.size === 0) {
		console.log('Главные категории не найдены')
	} else {
		const sortedCategories = Array.from(rootCategoriesMap.entries()).sort((a, b) =>
			a[1].name.localeCompare(b[1].name)
		)

		console.log(`Всего найдено главных категорий: ${sortedCategories.length}\n`)

		for (const [id, info] of sortedCategories) {
			console.log(`ID: ${id}`)
			console.log(`Название: ${info.name}`)
			console.log(`Найдено в файлах: ${info.files.length}`)
			console.log(`  - ${info.files.map((f) => path.basename(f)).join('\n  - ')}`)
			console.log('')
		}

		console.log('\n' + '='.repeat(80))
		console.log('СПИСОК НАЗВАНИЙ ГЛАВНЫХ КАТЕГОРИЙ:')
		console.log('='.repeat(80) + '\n')

		for (const [id, info] of sortedCategories) {
			console.log(`- ${info.name}`)
		}
	}

	// Выводим результаты поиска по "бейсбол" и "софтбол"
	console.log('\n' + '='.repeat(80))
	console.log('ПОИСК КАТЕГОРИЙ: "бейсбол", "софтбол"')
	console.log('='.repeat(80) + '\n')

	if (foundCategories.length === 0) {
		console.log('❌ Категории с упоминанием "бейсбол" или "софтбол" НЕ НАЙДЕНЫ в архивах!')
		console.log('\nЭто означает, что:')
		console.log('1. Либо категория не приходит в XML файлах от Saby')
		console.log('2. Либо она называется по-другому')
		console.log('3. Либо она есть в других архивах, которые еще не обработаны')
	} else {
		console.log(`✅ Найдено категорий: ${foundCategories.length}\n`)
		for (const cat of foundCategories) {
			console.log(`ID: ${cat.id}`)
			console.log(`Название: ${cat.name}`)
			console.log(`Уровень: ${cat.level} ${cat.level === 0 ? '(ГЛАВНАЯ)' : '(подкатегория)'}`)
			console.log(`Родитель ID: ${cat.parentId || 'нет (главная)'}`)
			console.log(`Найдено в файлах: ${cat.files.length}`)
			console.log(`  - ${cat.files.map((f) => path.basename(f)).join('\n  - ')}`)
			console.log('')
		}
	}

	// Выводим статистику по всем категориям
	console.log('\n' + '='.repeat(80))
	console.log('СТАТИСТИКА ПО ВСЕМ КАТЕГОРИЯМ')
	console.log('='.repeat(80) + '\n')

	const categoriesByLevel = new Map<number, number>()
	for (const [key, info] of allCategoriesMap.entries()) {
		const level = info.level
		categoriesByLevel.set(level, (categoriesByLevel.get(level) || 0) + 1)
	}

	console.log(`Всего уникальных категорий: ${allCategoriesMap.size}`)
	console.log('\nРаспределение по уровням:')
	const sortedLevels = Array.from(categoriesByLevel.entries()).sort((a, b) => a[0] - b[0])
	for (const [level, count] of sortedLevels) {
		console.log(`  Уровень ${level}: ${count} категорий`)
	}

	// Выводим полный список всех категорий для проверки
	console.log('\n' + '='.repeat(80))
	console.log('ПОЛНЫЙ СПИСОК ВСЕХ КАТЕГОРИЙ (для проверки названий)')
	console.log('='.repeat(80) + '\n')

	const allCategoriesList = Array.from(allCategoriesMap.values()).sort((a, b) => {
		if (a.level !== b.level) return a.level - b.level
		return a.name.localeCompare(b.name)
	})

	for (const cat of allCategoriesList) {
		const indent = '  '.repeat(cat.level)
		const levelMarker = cat.level === 0 ? ' [ГЛАВНАЯ]' : ''
		console.log(`${indent}${cat.name}${levelMarker} (уровень ${cat.level})`)
	}
}

// Запуск
main()
