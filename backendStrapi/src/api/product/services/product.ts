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

			// Нормализуем модель для сравнения: SBIS иногда отдает отличия только
			// регистром или кириллическими символами, похожими на латиницу.
			const normalizeModel = (model: string | null | undefined): string | null => {
				if (!model || typeof model !== 'string') return null
				const normalized = model
					.normalize('NFKC')
					.replace(/[АВЕКМНОРСТХУ]/g, (char) => {
						const map: Record<string, string> = {
							А: 'A',
							В: 'B',
							Е: 'E',
							К: 'K',
							М: 'M',
							Н: 'H',
							О: 'O',
							Р: 'P',
							С: 'C',
							Т: 'T',
							Х: 'X',
							У: 'Y',
						}
						return map[char] || char
					})
					.replace(/[авекмнорстху]/g, (char) => {
						const map: Record<string, string> = {
							а: 'a',
							в: 'b',
							е: 'e',
							к: 'k',
							м: 'm',
							н: 'h',
							о: 'o',
							р: 'p',
							с: 'c',
							т: 't',
							х: 'x',
							у: 'y',
						}
						return map[char] || char
					})
					.replace(/\s+/g, ' ')
					.trim()
					.toLowerCase()
				return normalized || null
			}

			const normalizedModel = normalizeModel(product.model)

			if (!normalizedModel) {
				return []
			}

			// Сначала забираем опубликованные товары с model, затем сравниваем
			// нормализованные ключи в JS: Strapi-фильтр не поймает кириллицу/латиницу.
			const allProductsWithModel = await strapi.entityService.findMany(
				'api::product.product',
				{
					filters: {
						published: true,
						model: { $notNull: true },
					} as any,
					sort: { name: 'asc' },
					limit: -1,
				}
			)

			// Фильтруем на уровне JavaScript, исключая текущий товар
			const variants = (allProductsWithModel || []).filter(
				(variant: any) =>
					variant.id !== product.id &&
					normalizeModel(variant.model) === normalizedModel
			)

			return variants || []
		},
	})
)
