/**
 * One-time backfill for global Brand collection and Product.brandRef relation.
 *
 * Run:
 *   npx ts-node scripts/backfill-brands.ts
 */

export {}

type StrapiLike = any

const normalizeBrandName = (value?: string | null): string =>
	String(value || '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ')

async function ensureBrand(
	strapi: StrapiLike,
	rawName: string,
	cache: Map<string, number>
): Promise<number | undefined> {
	const name = String(rawName || '').trim()
	const normalizedName = normalizeBrandName(name)
	if (!name || !normalizedName) return undefined

	if (cache.has(normalizedName)) {
		return cache.get(normalizedName)
	}

	const existing = await strapi.db.query('api::brand.brand').findOne({
		where: { normalizedName },
		select: ['id', 'name'],
	})

	let id: number
	if (existing) {
		id = typeof existing.id === 'number' ? existing.id : parseInt(String(existing.id), 10)
		await strapi.entityService.update('api::brand.brand', id, {
			data: {
				name,
				isActive: true,
			},
		})
	} else {
		const created = await strapi.entityService.create('api::brand.brand', {
			data: {
				name,
				normalizedName,
				isActive: true,
			},
		})
		id = typeof created.id === 'number' ? created.id : parseInt(String(created.id), 10)
	}

	cache.set(normalizedName, id)
	return id
}

async function main() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Strapi = require('@strapi/strapi')
	const strapi = await (Strapi as any)().load()
	await strapi.start()

	try {
		const cache = new Map<string, number>()

		// 1) Seed brands from legacy category nodes (type=brand)
		const legacyCategories = await strapi.entityService.findMany('api::category.category', {
			filters: { type: 'brand', isActive: true },
			fields: ['id', 'name'],
			limit: -1,
		})

		let seededFromCategories = 0
		for (const category of legacyCategories as any[]) {
			const name = String(category?.name || '').trim()
			if (!name) continue
			const ensured = await ensureBrand(strapi, name, cache)
			if (ensured) seededFromCategories++
		}

		// 2) Ensure brands from products and backfill brandRef
		const products = await strapi.entityService.findMany('api::product.product', {
			fields: ['id', 'categoryName'],
			populate: ['brand'],
			limit: -1,
		})

		let productsUpdated = 0
		let productsSkipped = 0

		for (const product of products as any[]) {
			const legacyBrandName = String(product?.brand?.name || '').trim()
			const fallbackName = String(product?.categoryName || '').trim()
			const resolvedName = legacyBrandName || fallbackName

			if (!resolvedName) {
				productsSkipped++
				continue
			}

			const brandRefId = await ensureBrand(strapi, resolvedName, cache)
			if (!brandRefId) {
				productsSkipped++
				continue
			}

			await strapi.entityService.update('api::product.product', product.id, {
				data: {
					brandRef: brandRefId,
				},
			})
			productsUpdated++
		}

		// 3) Output stats
		const totalBrands = await strapi.entityService.count('api::brand.brand', {
			filters: {},
		})

		console.log('[Backfill Brands] Done')
		console.log(`[Backfill Brands] Seeded from categories: ${seededFromCategories}`)
		console.log(`[Backfill Brands] Products updated with brandRef: ${productsUpdated}`)
		console.log(`[Backfill Brands] Products skipped: ${productsSkipped}`)
		console.log(`[Backfill Brands] Total brands in collection: ${totalBrands}`)
	} finally {
		await strapi.destroy()
		process.exit(0)
	}
}

main().catch((error) => {
	console.error('[Backfill Brands] Failed:', error)
	process.exit(1)
})
