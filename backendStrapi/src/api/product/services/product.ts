/**
 * product service
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreService(
	'api::product.product',
	({ strapi }) => ({
		/**
		 * Находит варианты товара по model (CommerceML вариации).
		 * Вариантами считаются товары с одинаковым model.
		 * Если у товара model не задан — вариантов нет.
		 */
		async findVariants(product: any): Promise<any[]> {
			if (!product) {
				return []
			}

			// Нормализуем модель для сравнения (trim, но сохраняем регистр)
			const normalizeModel = (model: string | null | undefined): string | null => {
				if (!model || typeof model !== 'string') return null
				return model.trim() || null
			}

			const normalizedModel = normalizeModel(product.model)

			if (!normalizedModel) {
				return []
			}

			// Ищем другие товары с тем же model, но другим ID
			const filters: any = {
				published: true,
				model: normalizedModel,
			}

			const allVariants = await strapi.entityService.findMany(
				'api::product.product',
				{
					filters,
					sort: { name: 'asc' },
				}
			)

			// Фильтруем на уровне JavaScript, исключая текущий товар
			const variants = (allVariants || []).filter(
				(variant: any) => variant.id !== product.id
			)

			return variants || []
		},
	})
)
