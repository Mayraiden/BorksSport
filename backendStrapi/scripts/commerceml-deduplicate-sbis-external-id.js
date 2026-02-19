/**
 * Дедупликация товаров по sbisExternalId перед включением unique constraint.
 *
 * По умолчанию работает в dry-run режиме:
 *   node scripts/commerceml-deduplicate-sbis-external-id.js
 *
 * Применение изменений:
 *   node scripts/commerceml-deduplicate-sbis-external-id.js --apply
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi')

function toDateValue(value) {
	if (!value) return 0
	const ts = new Date(value).getTime()
	return Number.isFinite(ts) ? ts : 0
}

function compareProductsByFreshness(a, b) {
	const aLastSync = toDateValue(a.lastSyncAt)
	const bLastSync = toDateValue(b.lastSyncAt)
	if (aLastSync !== bLastSync) return bLastSync - aLastSync

	const aUpdated = toDateValue(a.updatedAt)
	const bUpdated = toDateValue(b.updatedAt)
	if (aUpdated !== bUpdated) return bUpdated - aUpdated

	const aCreated = toDateValue(a.createdAt)
	const bCreated = toDateValue(b.createdAt)
	if (aCreated !== bCreated) return bCreated - aCreated

	return Number(b.id) - Number(a.id)
}

async function main() {
	const applyMode = process.argv.includes('--apply')
	const modeLabel = applyMode ? 'APPLY' : 'DRY-RUN'

	let app
	try {
		console.log(`[${modeLabel}] Loading Strapi...`)
		const appContext = await compileStrapi()
		app = await createStrapi(appContext).load()

		const products = await app.entityService.findMany('api::product.product', {
			filters: {
				sbisExternalId: {
					$notNull: true,
				},
			},
			fields: ['id', 'name', 'sbisExternalId', 'lastSyncAt', 'updatedAt', 'createdAt'],
			limit: -1,
		})

		const grouped = new Map()
		for (const product of products) {
			const rawKey = product.sbisExternalId
			if (typeof rawKey !== 'string') continue
			const key = rawKey.trim()
			if (!key) continue

			if (!grouped.has(key)) grouped.set(key, [])
			grouped.get(key).push(product)
		}

		const duplicates = Array.from(grouped.entries())
			.map(([key, items]) => ({ key, items }))
			.filter((entry) => entry.items.length > 1)

		console.log(`Total products with sbisExternalId: ${products.length}`)
		console.log(`Duplicate sbisExternalId groups: ${duplicates.length}`)

		if (duplicates.length === 0) {
			console.log('No duplicates found. Nothing to do.')
			return
		}

		let productsToDelete = 0
		for (const duplicate of duplicates) {
			const sorted = [...duplicate.items].sort(compareProductsByFreshness)
			const canonical = sorted[0]
			const victims = sorted.slice(1)

			productsToDelete += victims.length

			console.log('\n---')
			console.log(`sbisExternalId: ${duplicate.key}`)
			console.log(`Keep: #${canonical.id} "${canonical.name || 'N/A'}"`)
			console.log(
				`Drop: ${victims.map((v) => `#${v.id} "${v.name || 'N/A'}"`).join(', ')}`
			)
		}

		console.log('\nSummary:')
		console.log(`- Duplicate groups: ${duplicates.length}`)
		console.log(`- Products to delete: ${productsToDelete}`)

		if (!applyMode) {
			console.log('\nDry-run complete. Re-run with --apply to perform deletion.')
			return
		}

		let deleted = 0
		for (const duplicate of duplicates) {
			const sorted = [...duplicate.items].sort(compareProductsByFreshness)
			const victims = sorted.slice(1)

			for (const victim of victims) {
				await app.entityService.delete('api::product.product', victim.id)
				deleted += 1
			}
		}

		console.log(`\nApply complete. Deleted products: ${deleted}`)
	} catch (error) {
		console.error(`[${modeLabel}] Failed:`, error)
		process.exitCode = 1
	} finally {
		if (app) {
			await app.destroy()
		}
	}
}

main()
