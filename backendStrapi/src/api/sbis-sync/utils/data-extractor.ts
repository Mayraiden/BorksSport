/**
 * Утилиты для извлечения данных о товарах из SBIS
 */

/**
 * Извлекает размер из атрибутов товара
 * Проверяет различные варианты названий и форматы
 */
export function extractSize(attributes: Record<string, any>, productName?: string): string | null {
	if (!attributes) {
		attributes = {}
	}

	// Пробуем различные варианты названий в атрибутах
	const size =
		attributes['Размер'] ||
		attributes['размер'] ||
		attributes['Size'] ||
		attributes['size'] ||
		attributes['Размер (обуви)'] ||
		attributes['Размер обуви'] ||
		null

	if (size) {
		return String(size).trim()
	}

	// Если не нашли в атрибутах, пробуем извлечь из названия
	if (productName) {
		const name = String(productName).trim()

		// Паттерны для поиска размера в названии:
		// - "RED L", "BLUE M", "XL", "XXL"
		// - "34p", "36", "42" (числовые размеры)
		// - "S", "M", "L", "XL", "XXL", "XXXL" (буквенные размеры)

		// Буквенные размеры (S, M, L, XL, XXL, XXXL)
		const letterSizeMatch = name.match(/\b(X{0,3}L|S|M)\b/i)
		if (letterSizeMatch) {
			return letterSizeMatch[1].toUpperCase()
		}

		// Размеры типа "34p", "36p"
		const pSizeMatch = name.match(/\b(\d+)p\b/i)
		if (pSizeMatch) {
			return pSizeMatch[1]
		}

		// Чисто числовые размеры в конце названия или после цвета/модели
		// Например: "PRO RED 42", "Hockey 34"
		const numberSizeMatch = name.match(/\b(\d{2,3})\b(?!\s*p)/)
		if (numberSizeMatch) {
			const sizeNum = parseInt(numberSizeMatch[1])
			// Размеры обуви обычно 30-50, размеры одежды обычно больше
			// Проверяем разумный диапазон
			if (sizeNum >= 30 && sizeNum <= 60) {
				return String(sizeNum)
			}
		}
	}

	return null
}

/**
 * Извлекает цвет из атрибутов товара
 * Проверяет различные варианты названий
 */
export function extractColor(attributes: Record<string, any>, productName?: string): string | null {
	if (!attributes) {
		attributes = {}
	}

	// Пробуем различные варианты названий в атрибутах
	const color =
		attributes['Цвет'] ||
		attributes['цвет'] ||
		attributes['Color'] ||
		attributes['color'] ||
		attributes['Цвет товара'] ||
		null

	if (color) {
		return String(color).trim()
	}

	// Если не нашли в атрибутах, пробуем извлечь из названия
	if (productName) {
		const name = String(productName).trim()

		// Известные цвета на английском
		const englishColors = [
			'RED',
			'BLUE',
			'GREEN',
			'YELLOW',
			'BLACK',
			'WHITE',
			'GRAY',
			'GREY',
			'BROWN',
			'ORANGE',
			'PURPLE',
			'PINK',
			'SILVER',
			'GOLD',
		]

		// Известные цвета на русском (транслитерация или прямые названия)
		const russianColors = [
			'КРАСНЫЙ',
			'СИНИЙ',
			'ЗЕЛЕНЫЙ',
			'ЖЕЛТЫЙ',
			'ЧЕРНЫЙ',
			'БЕЛЫЙ',
			'СЕРЫЙ',
			'КОРИЧНЕВЫЙ',
			'ОРАНЖЕВЫЙ',
			'ФИОЛЕТОВЫЙ',
			'РОЗОВЫЙ',
		]

		const allColors = [...englishColors, ...russianColors]

		// Ищем цвет в названии (обычно после модели или перед размером)
		for (const colorName of allColors) {
			const regex = new RegExp(`\\b${colorName}\\b`, 'i')
			if (regex.test(name)) {
				return colorName.charAt(0) + colorName.slice(1).toLowerCase()
			}
		}
	}

	return null
}

/**
 * Парсит комбинированное поле "Ш/В/Д" (220/130/360 или 220,130,360).
 * Порядок: Ширина, Высота, Длина (или Глубина).
 * Возвращает [width, height, length] или null при неудаче.
 */
function parseCombinedDimensions(value: any): [number, number, number] | null {
	if (value === null || value === undefined) return null
	const str = String(value).trim().replace(/\s+/g, ' ')
	if (!str) return null
	// Разделители: / или , или пробел
	const parts = str.split(/[/,\s]+/).map((s) => s.replace(/[^\d.,]/g, '').replace(',', '.'))
	const nums = parts.map((s) => (s ? parseFloat(s) : NaN)).filter((n) => !isNaN(n))
	if (nums.length >= 3) {
		return [nums[0], nums[1], nums[2]]
	}
	return null
}

/**
 * Извлекает габариты (длина, ширина, высота, вес) из данных товара.
 * Поддерживает:
 * - отдельные поля: Ширина, Высота, Длина, Глубина, Вес;
 * - комбинированное поле "Ш/В/Д" (или "Ш В Д") со значением вида "220/130/360" (как в 1С/Saby).
 */
export function extractDimensions(productData: any): {
	length: number | null
	width: number | null
	height: number | null
	weight: number | null
} {
	const dimensions = productData.dimensions || {}
	const attributes = productData.attributes || {}

	// Конвертируем в числа, если возможно
	const parseNumber = (value: any): number | null => {
		if (value === null || value === undefined) return null
		const s = String(value).trim().replace(/[^\d.,]/g, '').replace(',', '.')
		if (!s) return null
		const num = parseFloat(s)
		return isNaN(num) ? null : num
	}

	// Сначала проверяем комбинированное поле "Ш/В/Д" (как в интерфейсе Saby/1С)
	const combinedKeys = [
		'Ш/В/Д',
		'Ш В Д',
		'Ш/В/Д (мм)',
		'Габариты',
		'Габариты (Ш/В/Д)',
		'Ширина/Высота/Длина',
		'Ширина/Высота/Длинна', // опечатка, часто в 1С
		'Ширина / Высота / Длина',
		'Ширина / Высота / Длинна',
	]
	let fromCombined: [number, number, number] | null = null
	for (const key of combinedKeys) {
		const raw = attributes?.[key]
		fromCombined = parseCombinedDimensions(raw)
		if (fromCombined) break
	}
	// Вариант по ключу с регистронезависимым поиском (Ш/В/Д, габариты, ширина/высота/длин(а))
	if (!fromCombined && attributes && typeof attributes === 'object') {
		for (const [k, v] of Object.entries(attributes)) {
			const key = String(k).trim()
			if (
				/^ш\s*\/?\s*в\s*\/?\s*д$/i.test(key) ||
				/габарит/i.test(key) ||
				/^ширина\s*\/\s*высота\s*\/\s*длин[на]$/i.test(key)
			) {
				fromCombined = parseCombinedDimensions(v)
				if (fromCombined) break
			}
		}
	}

	const length =
		(fromCombined ? fromCombined[2] : null) ??
		productData.length ??
		productData.Length ??
		dimensions.length ??
		dimensions.Length ??
		attributes?.['Длина'] ??
		attributes?.['длина'] ??
		attributes?.['Глубина'] ??
		attributes?.['глубина'] ??
		null

	const width =
		(fromCombined ? fromCombined[0] : null) ??
		productData.width ??
		productData.Width ??
		dimensions.width ??
		dimensions.Width ??
		attributes?.['Ширина'] ??
		attributes?.['ширина'] ??
		null

	const height =
		(fromCombined ? fromCombined[1] : null) ??
		productData.height ??
		productData.Height ??
		dimensions.height ??
		dimensions.Height ??
		attributes?.['Высота'] ??
		attributes?.['высота'] ??
		null

	const weight =
		productData.weight ??
		productData.Weight ??
		dimensions.weight ??
		dimensions.Weight ??
		attributes?.['Вес'] ??
		attributes?.['вес'] ??
		null

	return {
		length: parseNumber(length),
		width: parseNumber(width),
		height: parseNumber(height),
		weight: parseNumber(weight),
	}
}

/**
 * Очищает HTML теги из описания
 * Удаляет теги <p>, но сохраняет текст внутри
 */
export function cleanDescriptionHtml(description: string | null | undefined): string {
	if (!description) {
		return ''
	}

	let cleaned = String(description)

	// Удаляем открывающие и закрывающие теги <p> и </p>
	cleaned = cleaned.replace(/<\/?p[^>]*>/gi, '')

	// Удаляем другие HTML теги (опционально, можно расширить)
	// cleaned = cleaned.replace(/<[^>]+>/g, '')

	// Убираем лишние пробелы и переносы строк
	cleaned = cleaned.trim().replace(/\s+/g, ' ')

	return cleaned
}

