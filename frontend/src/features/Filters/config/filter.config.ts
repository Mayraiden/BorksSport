// src/features/Filters/config/filters.config.ts
import { FilterSection } from '@shared/types/filters.types'

export const FILTERS_CONFIG: FilterSection[] = [
	{
		id: 'price',
		label: 'Цена',
		expanded: true,
		filters: [
			{
				id: 'priceRange',
				label: 'Диапазон цен',
				type: 'range',
				min: 0,
				max: 300000,
				step: 1000,
				default: { min: 0, max: 300000 },
			},
		],
	},
	{
		id: 'sportType',
		label: 'Вид спорта',
		expanded: true,
		filters: [
			{
				id: 'sports',
				label: 'Выберите виды спорта',
				type: 'checkbox',
				options: [
					{ value: 'basketball', label: 'Баскетбол' },
					{ value: 'football', label: 'Футбол' },
					{ value: 'baseball', label: 'Бейсбол' },
					{ value: 'softball', label: 'Софтбол' },
					{ value: 'volleyball', label: 'Волейбол' },
				],
				default: [],
			},
		],
	},
	{
		id: 'category',
		label: 'Категория',
		expanded: false,
		filters: [
			{
				id: 'categories',
				label: 'Выберите категории',
				type: 'checkbox',
				options: [
					{ value: 'clothing', label: 'Одежда' },
					{ value: 'shoes', label: 'Обувь' },
					{ value: 'equipment', label: 'Снаряжение' },
					{ value: 'accessories', label: 'Аксессуары' },
				],
				default: [],
			},
		],
	},
	{
		id: 'gender',
		label: 'Пол',
		expanded: false,
		filters: [
			{
				id: 'genders',
				label: 'Выберите пол',
				type: 'checkbox',
				options: [
					{ value: 'male', label: 'Мужской' },
					{ value: 'female', label: 'Женский' },
					{ value: 'unisex', label: 'Унисекс' },
				],
				default: [],
			},
		],
	},
	{
		id: 'brand',
		label: 'Бренд',
		expanded: false,
		filters: [
			{
				id: 'brands',
				label: 'Выберите бренды',
				type: 'checkbox',
				options: [
					{ value: 'nike', label: 'Nike' },
					{ value: 'adidas', label: 'Adidas' },
					{ value: 'newBalance', label: 'New Balance' },
					{ value: 'puma', label: 'Puma' },
					{ value: 'reebok', label: 'Reebok' },
					{ value: 'asics', label: 'Asics' },
				],
				default: [],
			},
		],
	},
]
