/**
 * Миграция: заполнение Product.model из существующих данных (в основном name)
 *
 * Запуск:
 *  - npx ts-node scripts/migrate-product-model.ts
 *
 * Цель: чтобы после добавления поля `model` группировка в каталоге начала работать
 * хотя бы частично на уже импортированных товарах.
 */

async function main() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Strapi = require('@strapi/strapi')

	const strapi = await (Strapi as any)().load()
	await strapi.start()

	const products = await strapi.entityService.findMany('api::product.product', {
		fields: ['id', 'name', 'article', 'model'],
		limit: -1,
	})

	console.log(`[Migrate:model] Found ${products.length} products`)

	let updated = 0

	function extractModelFromName(name: string): string | null {
		if (!name) return null
		// Пытаемся извлечь токен с буквами+цифрами (например SMVELOK2),
		// но исключаем артикулы вида X123456.
		const tokens = String(name).match(/\b[A-Z0-9][A-Z0-9-]{3,}\b/g) || []
		for (const tokenRaw of tokens) {
			const token = tokenRaw.trim()
			if (!token) continue
			if (/^X\d+$/i.test(token)) continue
			// Нужно минимум одна буква и одна цифра
			if (!/[A-Z]/i.test(token) || !/\d/.test(token)) continue
			return token.toUpperCase().replace(/[^A-Z0-9-]/g, '')
		}
		return null
	}

	for (const product of products) {
		if (product.model && String(product.model).trim().length > 0) continue

		const candidate = extractModelFromName(product.name)
		if (!candidate) continue

		await strapi.entityService.update('api::product.product', product.id, {
			data: { model: candidate },
		})
		updated++
	}

	console.log(`[Migrate:model] Updated ${updated} products`)

	await strapi.destroy()
	process.exit(0)
}

main().catch((err: any) => {
	console.error('[Migrate:model] Error:', err)
	process.exit(1)
})

