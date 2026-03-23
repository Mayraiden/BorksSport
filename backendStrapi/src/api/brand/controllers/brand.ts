import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::brand.brand' as any, ({ strapi }) => ({
	async findHome(ctx: any) {
		try {
			const parsedLimit = parseInt(String(ctx.query.limit || '15'), 10)
			const limit = Number.isNaN(parsedLimit) ? 15 : Math.max(1, Math.min(parsedLimit, 50))

			const brands = await strapi.entityService.findMany('api::brand.brand' as any, {
				filters: {
					isActive: true,
				},
				populate: ['logo'],
				sort: 'name:asc',
				limit: -1,
			})

			const normalizedName = (name: string) =>
				String(name || '')
					.trim()
					.toLowerCase()
					.replace(/\s+/g, ' ')

			const manualBrands = [...(brands as any[])]
				.filter((brand) => Boolean(brand.showOnHome))
				.sort((a, b) => {
					const aSort = Number(a.homeSort || 0)
					const bSort = Number(b.homeSort || 0)
					if (aSort !== bSort) return aSort - bSort
					return String(a.name || '').localeCompare(String(b.name || ''), 'ru')
				})

			const selected: any[] = []
			const selectedNames = new Set<string>()
			const selectedIds = new Set<number>()

			const tryPushBrand = (brand: any) => {
				if (!brand) return
				const key = normalizedName(brand.name)
				if (!key || selectedNames.has(key) || selectedIds.has(brand.id)) return
				selected.push(brand)
				selectedNames.add(key)
				selectedIds.add(brand.id)
			}

			for (const brand of manualBrands) {
				if (selected.length >= limit) break
				tryPushBrand(brand)
			}

			if (selected.length < limit) {
				const autoCandidates = (brands as any[]).filter((brand) => !selectedIds.has(brand.id))
				const autoCandidateIds = autoCandidates.map((brand) => brand.id)

				if (autoCandidateIds.length > 0) {
					const productsQuery: any = {
						filters: {
							brandRef: { id: { $in: autoCandidateIds } },
							published: true,
						},
						fields: [
							'id',
							'stock',
							'sbisPopularityScore',
							'sbisSalesCount',
							'sbisTotalQuantitySold',
						],
						populate: ['brandRef'],
						limit: -1,
					}

					const products = await strapi.entityService.findMany(
						'api::product.product',
						productsQuery
					)

					const statsByBrandId = new Map<
						number,
						{
							productsCount: number
							inStockCount: number
							popularityScore: number
							salesCount: number
							quantitySold: number
						}
					>()

					for (const product of products as any[]) {
						const brandId = product?.brandRef?.id
						if (typeof brandId !== 'number') continue

						const current = statsByBrandId.get(brandId) || {
							productsCount: 0,
							inStockCount: 0,
							popularityScore: 0,
							salesCount: 0,
							quantitySold: 0,
						}

						current.productsCount += 1
						if (Number(product.stock || 0) > 0) {
							current.inStockCount += 1
						}
						current.popularityScore += Number(product.sbisPopularityScore || 0)
						current.salesCount += Number(product.sbisSalesCount || 0)
						current.quantitySold += Number(product.sbisTotalQuantitySold || 0)

						statsByBrandId.set(brandId, current)
					}

					const sortedAuto = autoCandidates
						.map((brand) => ({ brand, stats: statsByBrandId.get(brand.id) }))
						.filter((item) => Boolean(item.stats && item.stats.productsCount > 0))
						.sort((a, b) => {
							const sa = a.stats!
							const sb = b.stats!
							if (sb.popularityScore !== sa.popularityScore) {
								return sb.popularityScore - sa.popularityScore
							}
							if (sb.salesCount !== sa.salesCount) {
								return sb.salesCount - sa.salesCount
							}
							if (sb.quantitySold !== sa.quantitySold) {
								return sb.quantitySold - sa.quantitySold
							}
							if (sb.inStockCount !== sa.inStockCount) {
								return sb.inStockCount - sa.inStockCount
							}
							if (sb.productsCount !== sa.productsCount) {
								return sb.productsCount - sa.productsCount
							}
							return String(a.brand.name || '').localeCompare(
								String(b.brand.name || ''),
								'ru'
							)
						})

					for (const item of sortedAuto) {
						if (selected.length >= limit) break
						tryPushBrand(item.brand)
					}
				}
			}

			ctx.body = {
				success: true,
				data: selected.slice(0, limit),
				meta: {
					count: selected.slice(0, limit).length,
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = {
				success: false,
				error: error.message,
			}
		}
	},
}))
