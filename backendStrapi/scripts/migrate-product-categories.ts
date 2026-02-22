/**
 * Миграция: заполнение sportCategory, productCategory, subcategory, brand
 * из существующих categoryName, rootCategoryName, category
 *
 * Запуск: npm run migrate:categories (из backendStrapi)
 * или: npx ts-node scripts/migrate-product-categories.ts
 */

import { SUBCATEGORY_TO_PRODUCT_CATEGORY } from '../src/api/commerceml-sync/config/category-mapping'

type CategoryType = 'sport' | 'productType' | 'subcategory' | 'brand'

async function ensureCategory(
	strapi: any,
	name: string,
	type: CategoryType,
	parentId?: number
): Promise<number | undefined> {
	if (!name || !name.trim()) return undefined

	const level = type === 'sport' ? 0 : type === 'productType' ? 1 : 2

	let existing = await strapi.db.query('api::category.category').findOne({
		where: { name: name.trim() },
	})

	if (existing) {
		const updates: Record<string, unknown> = {}
		if (existing.type !== type) updates.type = type
		if (existing.level !== level) updates.level = level
		if (parentId != null && existing.parent !== parentId) updates.parent = parentId
		if (Object.keys(updates).length > 0) {
			await strapi.entityService.update('api::category.category', existing.id, { data: updates })
		}
		return typeof existing.id === 'number' ? existing.id : parseInt(String(existing.id), 10)
	}

	const categoryData: Record<string, unknown> = {
		name: name.trim(),
		level,
		type,
		isActive: true,
	}
	if (parentId != null) categoryData.parent = parentId

	const created = await strapi.entityService.create('api::category.category', { data: categoryData })
	return typeof created.id === 'number' ? created.id : parseInt(String(created.id), 10)
}

async function main() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Strapi = require('@strapi/strapi')

	const strapi = await (Strapi as any)().load()
	await strapi.start()

	const products = await strapi.entityService.findMany('api::product.product', {
		filters: {},
		limit: 10000,
	})

	console.log(`[Migrate] Found ${products.length} products`)

	let updated = 0
	for (const product of products) {
		const updates: Record<string, unknown> = {}

		// rootCategoryName -> sportCategory
		if (product.rootCategoryName) {
			const id = await ensureCategory(strapi, product.rootCategoryName, 'sport')
			if (id) updates.sportCategory = id
		}

		// categoryName -> productCategory, subcategory
		if (product.categoryName) {
			const productCategoryName = SUBCATEGORY_TO_PRODUCT_CATEGORY[product.categoryName] || product.categoryName
			const productCategoryId = await ensureCategory(strapi, productCategoryName, 'productType')
			if (productCategoryId) updates.productCategory = productCategoryId

			if (SUBCATEGORY_TO_PRODUCT_CATEGORY[product.categoryName]) {
				const subcategoryId = await ensureCategory(
					strapi,
					product.categoryName,
					'subcategory',
					productCategoryId
				)
				if (subcategoryId) updates.subcategory = subcategoryId
			}
		}

		// category (relation) - если level=2 и не подкатегория, возможно это brand
		const categoryId = product.category
		if (categoryId) {
			const cat =
				typeof categoryId === 'object'
					? categoryId
					: await strapi.entityService.findOne('api::category.category', categoryId)
			if (cat) {
				const catLevel = cat.level ?? 2
				const catType = cat.type
				const catName = cat.name
				if (catLevel === 2 && catType !== 'subcategory' && catName) {
					const brandId = await ensureCategory(strapi, catName, 'brand')
					if (brandId) updates.brand = brandId
				}
			}
		}

		if (Object.keys(updates).length > 0) {
			await strapi.entityService.update('api::product.product', product.id, { data: updates })
			updated++
		}
	}

	console.log(`[Migrate] Updated ${updated} products`)

	await strapi.destroy()
	process.exit(0)
}

main().catch((err) => {
	console.error('[Migrate] Error:', err)
	process.exit(1)
})
