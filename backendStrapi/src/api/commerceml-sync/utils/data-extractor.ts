/**
 * Shared extraction utilities for CommerceML product mapping.
 */

export function extractSize(attributes: Record<string, any>, productName?: string): string | null {
	if (!attributes) {
		attributes = {}
	}

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

	if (productName) {
		const name = String(productName).trim()
		const letterSizeMatch = name.match(/\b(X{0,3}L|S|M)\b/i)
		if (letterSizeMatch) {
			return letterSizeMatch[1].toUpperCase()
		}

		const pSizeMatch = name.match(/\b(\d+)p\b/i)
		if (pSizeMatch) {
			return pSizeMatch[1]
		}

		const numberSizeMatch = name.match(/\b(\d{2,3})\b(?!\s*p)/)
		if (numberSizeMatch) {
			const sizeNum = parseInt(numberSizeMatch[1])
			if (sizeNum >= 30 && sizeNum <= 60) {
				return String(sizeNum)
			}
		}
	}

	return null
}

export function extractColor(attributes: Record<string, any>, productName?: string): string | null {
	if (!attributes) {
		attributes = {}
	}

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

	if (productName) {
		const name = String(productName).trim()
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

		for (const colorName of allColors) {
			const regex = new RegExp(`\\b${colorName}\\b`, 'i')
			if (regex.test(name)) {
				return colorName.charAt(0) + colorName.slice(1).toLowerCase()
			}
		}
	}

	return null
}

function parseCombinedDimensions(value: any): [number, number, number] | null {
	if (value === null || value === undefined) return null
	const str = String(value).trim().replace(/\s+/g, ' ')
	if (!str) return null
	const parts = str.split(/[/,\s]+/).map((s) => s.replace(/[^\d.,]/g, '').replace(',', '.'))
	const nums = parts.map((s) => (s ? parseFloat(s) : NaN)).filter((n) => !isNaN(n))
	if (nums.length >= 3) {
		return [nums[0], nums[1], nums[2]]
	}
	return null
}

export function extractDimensions(productData: any): {
	length: number | null
	width: number | null
	height: number | null
	weight: number | null
} {
	const dimensions = productData.dimensions || {}
	const attributes = productData.attributes || {}

	const parseNumber = (value: any): number | null => {
		if (value === null || value === undefined) return null
		const s = String(value).trim().replace(/[^\d.,]/g, '').replace(',', '.')
		if (!s) return null
		const num = parseFloat(s)
		return isNaN(num) ? null : num
	}

	const combinedKeys = [
		'Ш/В/Д',
		'Ш В Д',
		'Ш/В/Д (мм)',
		'Габариты',
		'Габариты (Ш/В/Д)',
		'Ширина/Высота/Длина',
		'Ширина/Высота/Длинна',
		'Ширина / Высота / Длина',
		'Ширина / Высота / Длинна',
	]
	let fromCombined: [number, number, number] | null = null
	for (const key of combinedKeys) {
		const raw = attributes?.[key]
		fromCombined = parseCombinedDimensions(raw)
		if (fromCombined) break
	}
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
