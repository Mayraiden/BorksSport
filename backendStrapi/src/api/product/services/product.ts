/**
 * product service
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreService(
	'api::product.product',
	({ strapi }) => ({
		/**
		 * Находит варианты товара по sbisNomNumber или article
		 * Вариантами считаются товары с одинаковым sbisNomNumber (если есть) или article
		 */
		async findVariants(product: any): Promise<any[]> {
			if (!product) {
				return []
			}

			// Определяем ключ для группировки
			const groupKey = product.sbisNomNumber || product.article

			if (!groupKey) {
				return []
			}

			// Ищем другие товары с тем же ключом, но другим ID
			const filters: any = {
				published: true,
			}

			// Добавляем фильтр по группировочному ключу
			if (product.sbisNomNumber) {
				filters.sbisNomNumber = product.sbisNomNumber
			} else if (product.article) {
				filters.article = product.article
			} else {
				return []
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
