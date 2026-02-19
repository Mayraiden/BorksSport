/**
 * Обнуляет sbisId у товаров CommerceML (где sbisExternalId выглядит как UUID).
 *
 * По умолчанию dry-run:
 *   node scripts/commerceml-nullify-sbisid.js
 *
 * Применение:
 *   node scripts/commerceml-nullify-sbisid.js --apply
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi')

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
				sbisId: {
					$notNull: true,
				},
				sbisExternalId: {
					$notNull: true,
				},
			},
			fields: ['id', 'name', 'sbisId', 'sbisExternalId'],
			limit: -1,
		})

		const targets = products.filter((product) => {
			const externalId = String(product.sbisExternalId || '').trim()
			return UUID_PATTERN.test(externalId)
		})

		console.log(`Products with non-null sbisId: ${products.length}`)
		console.log(`CommerceML-like UUID products to nullify: ${targets.length}`)

		if (targets.length === 0) {
			console.log('Nothing to update.')
			return
		}

		for (const product of targets.slice(0, 50)) {
			console.log(
				`#${product.id} sbisId=${product.sbisId} sbisExternalId=${product.sbisExternalId} name="${product.name || 'N/A'}"`
			)
		}
		if (targets.length > 50) {
			console.log(`... and ${targets.length - 50} more`)
		}

		if (!applyMode) {
			console.log('\nDry-run complete. Re-run with --apply to update records.')
			return
		}

		let updated = 0
		for (const product of targets) {
			await app.entityService.update('api::product.product', product.id, {
				data: {
					sbisId: null,
				},
			})
			updated += 1
		}

		console.log(`\nApply complete. Updated products: ${updated}`)
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
