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
 * @param level - Уровень вложенности (0 - виды спорта, 1 - категории товаров, 2 - бренды)
 */
export const useCategoriesByLevel = (level: number) => {
	return useQuery({
		queryKey: ['categories', 'by-level', level],
		queryFn: () => categoryApi.getCategoriesByLevel(level),
		staleTime: 10 * 60 * 1000, // 10 минут
		gcTime: 30 * 60 * 1000, // 30 минут
		refetchOnWindowFocus: false,
	})
}
