/**
 * Утилиты для обработки изображений из SBIS
 */

/**
 * Извлекает URL изображения из строки параметров SBIS
 * Формат: строка с параметрами в формате params=base64(...) или params=urlEncoded(...)
 * Внутри параметров содержится JSON с полем PhotoURL
 */
export function extractImageUrl(imageData: string): string | null {
	if (!imageData || typeof imageData !== 'string') {
		return null
	}

	try {
		// Проверяем, есть ли параметры в строке
		const paramsMatch = imageData.match(/params=(.+)/)
		if (!paramsMatch) {
			// Если это уже прямой URL, возвращаем его
			if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
				return imageData
			}
			return null
		}

		const rawParams = paramsMatch[1]

		// Пробуем декодировать base64
		try {
			const decodedParams = Buffer.from(rawParams, 'base64').toString('utf-8')
			const params = JSON.parse(decodedParams)
			if (params.PhotoURL) {
				return params.PhotoURL
			}
		} catch {
			// Если не base64, пробуем URL decode
			try {
				const decodedParams = decodeURIComponent(rawParams)
				const params = JSON.parse(decodedParams)
				if (params.PhotoURL) {
					return params.PhotoURL
				}
			} catch {
				// Если и это не помогло, возвращаем null
				return null
			}
		}
	} catch (error) {
		console.error('Error extracting image URL:', error)
		return null
	}

	return null
}

/**
 * Обрабатывает массив изображений из SBIS и возвращает массив URL
 */
export function processImageArray(images: any[]): string[] {
	if (!Array.isArray(images)) {
		return []
	}

	const processedImages: string[] = []

	for (const image of images) {
		if (typeof image === 'string') {
			const url = extractImageUrl(image)
			if (url) {
				processedImages.push(url)
			}
		} else if (image && typeof image === 'object' && image.PhotoURL) {
			// Если изображение уже в формате объекта с PhotoURL
			processedImages.push(image.PhotoURL)
		} else if (image && typeof image === 'object' && image.url) {
			// Если изображение уже имеет поле url
			processedImages.push(image.url)
		}
	}

	return processedImages
}

