/**
 * Management (manager-only) endpoints.
 *
 * Notes:
 * - We intentionally keep Strapi route auth disabled and verify JWT manually,
 *   matching the existing pattern used in other custom controllers.
 * - Access is restricted to users-permissions role "manager".
 */
const resolveUserId = async (strapi: any, ctx: any): Promise<number | null> => {
	let userId = ctx.state.user?.id

	if (!userId) {
		const authHeader = ctx.request.header?.authorization
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7)

			try {
				const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token)
				userId = id
			} catch {
				// ignore token errors, will fall back to 401 below
			}
		}
	}

	return userId ?? null
}

const requireManager = async (strapi: any, ctx: any, userId: number): Promise<boolean> => {
	const user = await strapi.db.query('plugin::users-permissions.user').findOne({
		where: { id: userId },
		select: ['id'],
		populate: ['role'],
	})

	const roleName = String((user as any)?.role?.name || '').toLowerCase()
	if (roleName === 'manager') {
		return true
	}

	ctx.status = 403
	ctx.body = {
		success: false,
		message: 'Forbidden',
		code: 'NOT_MANAGER',
	}
	return false
}

const parseBoolean = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value
	if (typeof value !== 'string') return false
	return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

const parseIntOr = (value: unknown, fallback: number): number => {
	const parsed = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN
	return Number.isFinite(parsed) ? parsed : fallback
}

export default {
	/**
	 * Manager: list orders with filters
	 * GET /api/management/orders
	 */
	async orders(ctx: any) {
		try {
			const userId = await resolveUserId(strapi, ctx)

			if (!userId) {
				ctx.status = 401
				ctx.body = { success: false, message: 'User not authenticated' }
				return
			}

			const ok = await requireManager(strapi, ctx, userId)
			if (!ok) return

			const {
				status,
				q,
				dateFrom,
				dateTo,
				deliveryType,
				paymentMethod,
				problemOnly,
				page,
				pageSize,
			} = ctx.query || {}

			const normalizedPage = Math.max(1, parseIntOr(page, 1))
			const normalizedPageSize = Math.min(100, Math.max(1, parseIntOr(pageSize, 25)))
			const start = (normalizedPage - 1) * normalizedPageSize

			const filters: any = {}

			if (status) {
				filters.status = status
			}
			if (deliveryType) {
				filters.deliveryType = deliveryType
			}
			if (paymentMethod) {
				filters.paymentMethod = paymentMethod
			}
			if (dateFrom || dateTo) {
				filters.createdAt = {}
				if (dateFrom) filters.createdAt.$gte = dateFrom
				if (dateTo) filters.createdAt.$lte = dateTo
			}

			const qStr = typeof q === 'string' ? q.trim() : ''
			const orFilters: any[] = []
			if (qStr) {
				orFilters.push(
					{ orderNumber: { $containsi: qStr } },
					{ trackingNumber: { $containsi: qStr } },
					{ cdekTrackNumber: { $containsi: qStr } }
				)
			}

			if (parseBoolean(problemOnly)) {
				orFilters.push(
					{ status: { $eq: 'payment_failed' } },
					{ cdekStatus: { $eq: 'CREATION_FAILED' } }
				)
			}

			if (orFilters.length) {
				filters.$or = orFilters
			}

			const [data, total] = await Promise.all([
				strapi.entityService.findMany('api::order.order', {
					filters,
					sort: 'createdAt:desc',
					start,
					limit: normalizedPageSize,
				}),
				strapi.entityService.count('api::order.order', { filters }),
			])

			ctx.body = {
				success: true,
				data,
				meta: {
					pagination: {
						page: normalizedPage,
						pageSize: normalizedPageSize,
						total,
						pageCount: Math.ceil(total / normalizedPageSize),
					},
				},
			}
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, error: error.message }
		}
	},

	/**
	 * Manager: order by id
	 * GET /api/management/orders/:id
	 */
	async orderById(ctx: any) {
		try {
			const userId = await resolveUserId(strapi, ctx)

			if (!userId) {
				ctx.status = 401
				ctx.body = { success: false, message: 'User not authenticated' }
				return
			}

			const ok = await requireManager(strapi, ctx, userId)
			if (!ok) return

			const { id } = ctx.params
			const order = await strapi.entityService.findOne('api::order.order', id, {
				populate: ['user'],
			})

			if (!order) {
				ctx.status = 404
				ctx.body = { success: false, message: 'Order not found' }
				return
			}

			ctx.body = { success: true, data: order }
		} catch (error: any) {
			ctx.status = 500
			ctx.body = { success: false, error: error.message }
		}
	},
}

