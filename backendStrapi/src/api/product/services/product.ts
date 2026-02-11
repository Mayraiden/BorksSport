/**
 * product service
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreService(
	'api::product.product',
	({ strapi }) => ({
		/**
		 * Находит варианты товара по article (только CommerceML, без sbisNomNumber)
		 * Вариантами считаются товары с одинаковым article
		 */
		async findVariants(product: any): Promise<any[]> {
			if (!product) {
				return []
			}

			// Нормализуем артикул для сравнения (trim, но сохраняем регистр)
			const normalizeArticle = (article: string | null | undefined): string | null => {
				if (!article || typeof article !== 'string') return null
				return article.trim() || null
			}

			// Используем только article для группировки (CommerceML)
			const normalizedArticle = normalizeArticle(product.article)

			if (!normalizedArticle) {
				return []
			}

			// Ищем другие товары с тем же артикулом, но другим ID
			const filters: any = {
				published: true,
				article: normalizedArticle,
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
