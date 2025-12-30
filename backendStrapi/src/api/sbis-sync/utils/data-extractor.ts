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
 * Извлекает габариты (длина, ширина, высота, вес) из данных товара
 */
export function extractDimensions(productData: any): {
	length: number | null
	width: number | null
	height: number | null
	weight: number | null
} {
	const dimensions = productData.dimensions || {}
	const attributes = productData.attributes || {}

	const length =
		productData.length ??
		productData.Length ??
		dimensions.length ??
		dimensions.Length ??
		attributes?.['Длина'] ??
		attributes?.['длина'] ??
		null

	const width =
		productData.width ??
		productData.Width ??
		dimensions.width ??
		dimensions.Width ??
		attributes?.['Ширина'] ??
		attributes?.['ширина'] ??
		null

	const height =
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

	// Конвертируем в числа, если возможно
	const parseNumber = (value: any): number | null => {
		if (value === null || value === undefined) return null
		const num = typeof value === 'number' ? value : parseFloat(String(value))
		return isNaN(num) ? null : num
	}

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

