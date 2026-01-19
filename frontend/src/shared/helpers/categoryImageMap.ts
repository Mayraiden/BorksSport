/**
 * Маппинг названий категорий на изображения
 * Используется для отображения категорий из Strapi с соответствующими изображениями
 */
const categoryImageMap: Record<string, string> = {
	'Хоккей на траве': '/hokkeyGrass.jpg',
	'Бейсбол и Софтбол': '/baseball.jpg',
	Бейсбол: '/baseball.jpg',
	Софтбол: '/softball.jpg',
	Бадминтон: '/badminton.jpg',
	Баскетбол: '/basket.jpg',
	Волейбол: '/walleyball.jpg',
	Крикет: '/cricket.jpg',
	Сквош: '/squosh.jpg',
	Теннис: '/tennis.jpg',
	Футбол: '/football.jpg',
}

/**
 * Получить путь к изображению для категории по её названию
 * @param categoryName - Название категории
 * @returns Путь к изображению или дефолтное изображение
 */
export const getCategoryImage = (categoryName: string): string => {
	// Пробуем найти точное совпадение
	if (categoryImageMap[categoryName]) {
		return categoryImageMap[categoryName]
	}

	// Пробуем найти частичное совпадение (case-insensitive)
	const normalizedName = categoryName.toLowerCase().trim()
	for (const [key, value] of Object.entries(categoryImageMap)) {
		if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
			return value
		}
	}

	// Дефолтное изображение, если ничего не найдено
	return '/heroImage.jpg'
}
