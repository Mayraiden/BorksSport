import { useQuery } from '@tanstack/react-query'
import { categoryApi } from '../api/categoryApi'

/**
 * Хук для получения главных категорий (level 0 - виды спорта)
 */
export const useMainCategories = () => {
	return useQuery({
		queryKey: ['categories', 'main'],
		queryFn: () => categoryApi.getMainCategories(),
		staleTime: 10 * 60 * 1000, // 10 минут
		gcTime: 30 * 60 * 1000, // 30 минут
		refetchOnWindowFocus: false,
	})
}

/**
 * Хук для получения категорий по уровню вложенности
 * @param level - Уровень вложенности
 * @param type - Тип категории (опционально)
 */
export const useCategoriesByLevel = (level: number, type?: string, sports?: string[]) => {
	return useQuery({
		queryKey: [
			'categories',
			'by-level',
			level,
			type || 'any',
			sports && sports.length > 0 ? [...sports].sort().join('|') : 'all',
		],
		queryFn: () => categoryApi.getCategoriesByLevel(level, type, sports),
		staleTime: 10 * 60 * 1000, // 10 минут
		gcTime: 30 * 60 * 1000, // 30 минут
		refetchOnWindowFocus: false,
	})
}
