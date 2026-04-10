import type { Core } from '@strapi/strapi'

type StockOpKind = 'reserve' | 'release' | 'commit' | 'return'

export interface OrderItemLike {
	productId: number
	quantity: number
}

export interface StockOpsState {
	reservedAt?: string
	releasedAt?: string
	committedAt?: string
	returnedAt?: string
}

function toInt(value: unknown): number {
	const n = Number(value)
	if (!Number.isFinite(n)) return 0
	return Math.trunc(n)
}

function normalizeItems(items: unknown): OrderItemLike[] {
	if (!Array.isArray(items)) return []
	const map = new Map<number, number>()
	for (const it of items as any[]) {
		const productId = toInt(it?.productId ?? it?.product?.id ?? it?.product)
		const quantity = toInt(it?.quantity)
		if (!productId || quantity <= 0) continue
		map.set(productId, (map.get(productId) || 0) + quantity)
	}
	return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }))
}

function nowIso() {
	return new Date().toISOString()
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	const knex = strapi.db.connection

	const productsTable = 'products'
	const ordersTable = 'orders'

	async function withOrderLock<T>(
		trx: any,
		orderId: number,
		fn: (lockedOrder: any) => Promise<T>
	): Promise<T> {
		const locked = await knex(ordersTable).transacting(trx).where({ id: orderId }).forUpdate().first()
		if (!locked) {
			throw new Error(`Order not found: ${orderId}`)
		}
		return await fn(locked)
	}

	function ensureOpsShape(value: unknown): StockOpsState {
		if (!value) return {}
		if (typeof value === 'string') {
			try {
				const parsed = JSON.parse(value) as unknown
				if (parsed && typeof parsed === 'object') return parsed as StockOpsState
			} catch {
				return {}
			}
		}
		if (typeof value !== 'object') return {}
		return value as StockOpsState
	}

	async function applyProductDelta(
		trx: any,
		productId: number,
		deltas: { reservedDelta?: number; soldDelta?: number },
		guard?: { requireAvailableGte?: number }
	): Promise<boolean> {
		const reservedDelta = toInt(deltas.reservedDelta ?? 0)
		const soldDelta = toInt(deltas.soldDelta ?? 0)

		const update: Record<string, any> = {}
		if (reservedDelta !== 0) {
			update.reserved_stock = knex.raw('COALESCE(reserved_stock, 0) + ?', [reservedDelta])
		}
		if (soldDelta !== 0) {
			update.sold_but_not_synced = knex.raw('COALESCE(sold_but_not_synced, 0) + ?', [soldDelta])
		}

		if (Object.keys(update).length === 0) {
			return true
		}

		let q = knex(productsTable).transacting(trx).where({ id: productId })

		// Guard: require stock - reserved_stock - sold_but_not_synced >= N
		if (guard?.requireAvailableGte && guard.requireAvailableGte > 0) {
			q = q.andWhereRaw(
				'COALESCE(stock, 0) - COALESCE(reserved_stock, 0) - COALESCE(sold_but_not_synced, 0) >= ?',
				[guard.requireAvailableGte]
			)
		}

		// Guard against going below zero for counters.
		if (reservedDelta < 0) {
			q = q.andWhereRaw('COALESCE(reserved_stock, 0) >= ?', [-reservedDelta])
		}
		if (soldDelta < 0) {
			q = q.andWhereRaw('COALESCE(sold_but_not_synced, 0) >= ?', [-soldDelta])
		}

		const updated = await q.update(update)
		return updated === 1
	}

	async function reserveItems(trx: any, items: OrderItemLike[]) {
		for (const it of items) {
			const ok = await applyProductDelta(
				trx,
				it.productId,
				{ reservedDelta: it.quantity },
				{ requireAvailableGte: it.quantity }
			)
			if (!ok) {
				throw new Error(`INSUFFICIENT_STOCK:${it.productId}`)
			}
		}
	}

	async function releaseItems(trx: any, items: OrderItemLike[]) {
		for (const it of items) {
			const ok = await applyProductDelta(trx, it.productId, { reservedDelta: -it.quantity })
			if (!ok) {
				// If inconsistent, fail fast to avoid silently corrupting counters.
				throw new Error(`FAILED_TO_RELEASE_RESERVE:${it.productId}`)
			}
		}
	}

	async function commitItems(trx: any, items: OrderItemLike[]) {
		for (const it of items) {
			// Commit: reservedStock -= qty; soldButNotSynced += qty
			const ok = await applyProductDelta(trx, it.productId, {
				reservedDelta: -it.quantity,
				soldDelta: it.quantity,
			})
			if (!ok) {
				throw new Error(`FAILED_TO_COMMIT:${it.productId}`)
			}
		}
	}

	async function returnItems(trx: any, items: OrderItemLike[]) {
		for (const it of items) {
			// Return: soldButNotSynced -= qty (availability increases back)
			const ok = await applyProductDelta(trx, it.productId, { soldDelta: -it.quantity })
			if (!ok) {
				throw new Error(`FAILED_TO_RETURN:${it.productId}`)
			}
		}
	}

	async function applyOrderStockOp(params: {
		trx: any
		orderId: number
		kind: StockOpKind
		items?: unknown
	}) {
		const { trx, orderId, kind } = params

		await withOrderLock(trx, orderId, async (orderRow) => {
			const ops = ensureOpsShape(orderRow.stock_ops)
			const items = normalizeItems(params.items ?? orderRow.items)

			const ts = nowIso()

			if (kind === 'reserve') {
				if (ops.reservedAt) return
				await reserveItems(trx, items)
				ops.reservedAt = ts
			}

			if (kind === 'release') {
				if (ops.releasedAt) return
				/**
				 * We normally require `reservedAt` (set by `reserve`) to release.
				 * But in practice, stock may be reserved while `stock_ops` wasn't persisted
				 * (migration edge-cases, manual DB edits, older rows, etc).
				 *
				 * For unpaid order cancellations we prefer to be self-healing:
				 * attempt to release based on order items, and only fail if counters are inconsistent.
				 */
				await releaseItems(trx, items)
				ops.releasedAt = ts
			}

			if (kind === 'commit') {
				if (!ops.reservedAt || ops.committedAt) return
				await commitItems(trx, items)
				ops.committedAt = ts
			}

			if (kind === 'return') {
				if (!ops.committedAt || ops.returnedAt) return
				await returnItems(trx, items)
				ops.returnedAt = ts
			}

			await knex(ordersTable)
				.transacting(trx)
				.where({ id: orderId })
				.update({ stock_ops: ops })
		})
	}

	async function getAvailableStock(productId: number): Promise<number> {
		const row = await knex(productsTable)
			.select(['stock', 'reserved_stock', 'sold_but_not_synced'])
			.where({ id: productId })
			.first()
		if (!row) return 0
		const stock = toInt(row.stock)
		const reserved = toInt(row.reserved_stock)
		const sold = toInt(row.sold_but_not_synced)
		return Math.max(0, stock - reserved - sold)
	}

	return {
		normalizeItems,
		getAvailableStock,
		applyOrderStockOp,
	}
}

