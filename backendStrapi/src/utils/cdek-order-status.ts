/**
 * Достаёт «текущий» статус доставки из ответов CDEK v2 (заказ по uuid / по cdek_number / вебхук).
 * В ответах часто нет entity.status, а есть массив entity.statuses[] с code/name.
 */
export function extractCdekDeliveryStatusString(raw: unknown): string | null {
	if (!raw || typeof raw !== 'object') return null
	const root = raw as Record<string, unknown>
	const entity = (root.entity ?? root) as Record<string, unknown> | null
	if (!entity || typeof entity !== 'object') return null

	const direct =
		entity.status ??
		entity.state ??
		entity.status_code ??
		(entity as any).order_status ??
		(entity as any).orderStatus
	if (direct != null && String(direct).trim()) {
		return String(direct).trim()
	}

	const statuses = entity.statuses
	if (Array.isArray(statuses) && statuses.length > 0) {
		// CDEK v2 отдаёт statuses от нового к старому; раньше брали последний → ACCEPTED вместо DELIVERED.
		let latest: Record<string, unknown> | undefined
		let latestTs = -Infinity
		for (const item of statuses) {
			if (!item || typeof item !== 'object') continue
			const row = item as Record<string, unknown>
			const rawDate = row.date_time ?? row.dateTime
			const ts = rawDate ? Date.parse(String(rawDate)) : NaN
			if (!Number.isFinite(ts)) {
				if (!latest) latest = row
				continue
			}
			if (ts >= latestTs) {
				latestTs = ts
				latest = row
			}
		}
		const picked = latest ?? (statuses[0] as Record<string, unknown>)
		if (picked && typeof picked === 'object') {
			const code = picked.code ?? picked.name ?? picked.status
			if (code != null && String(code).trim()) {
				return String(code).trim()
			}
		}
	}

	return null
}

export function mapCdekStatusToOrderStatus(
	rawStatus: unknown
): 'shipped' | 'delivered' | undefined {
	const value = String(rawStatus ?? '').trim()
	if (!value) return undefined

	const normalized = value.toLowerCase()

	if (
		normalized.includes('delivered') ||
		normalized.includes('handed') ||
		normalized.includes('received') ||
		normalized.includes('вручен') ||
		normalized.includes('доставлен')
	) {
		return 'delivered'
	}

	if (
		normalized === 'sent' ||
		normalized.includes('shipped') ||
		normalized.includes('in_transit') ||
		normalized.includes('transit') ||
		normalized.includes('accepted') ||
		normalized.includes('created') ||
		normalized.includes('pickup') ||
		normalized.includes('передан') ||
		normalized.includes('принят') ||
		normalized.includes('в пути') ||
		normalized.includes('отправ') ||
		normalized.includes('out_for_delivery') ||
		normalized.includes('на доставке') ||
		normalized.includes('курьер')
	) {
		return 'shipped'
	}

	return undefined
}
