import { factories } from '@strapi/strapi'

export default factories.createCoreController(
	'api::address.address',
	({ strapi }) => ({
		/**
		 * Get user addresses
		 * GET /api/addresses
		 */
		async find(ctx) {
			try {
				const userId = ctx.state.user?.id

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const addresses = await strapi.entityService.findMany(
					'api::address.address',
					{
						filters: { user: userId },
						sort: 'isDefault:desc,createdAt:desc',
					}
				)

				ctx.body = {
					success: true,
					data: addresses,
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Create new address
		 * POST /api/addresses
		 */
		async create(ctx) {
			try {
				const { type, fullName, phone, address, city, postalCode, isDefault } =
					ctx.request.body
				const userId = ctx.state.user?.id

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				if (!fullName || !phone || !address || !city) {
					ctx.status = 400
					ctx.body = {
						success: false,
						message: 'Required fields: fullName, phone, address, city',
					}
					return
				}

				// If setting as default, unset other defaults
				if (isDefault) {
					const existingDefaults = await strapi.entityService.findMany(
						'api::address.address',
						{
							filters: { user: userId, isDefault: true },
						}
					)
					for (const addr of existingDefaults) {
						await strapi.entityService.update('api::address.address', addr.id, {
							data: { isDefault: false },
						})
					}
				}

				const newAddress = await strapi.entityService.create(
					'api::address.address',
					{
						data: {
							user: userId,
							type: type || 'shipping',
							fullName,
							phone,
							address,
							city,
							postalCode,
							isDefault: isDefault || false,
						},
					}
				)

				ctx.body = {
					success: true,
					data: newAddress,
					message: 'Address created successfully',
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Update address
		 * PUT /api/addresses/:id
		 */
		async update(ctx) {
			try {
				const { id } = ctx.params
				const { type, fullName, phone, address, city, postalCode, isDefault } =
					ctx.request.body
				const userId = ctx.state.user?.id

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const existingAddress = await strapi.entityService.findOne(
					'api::address.address',
					id,
					{
						populate: ['user'],
					}
				)

				if (!existingAddress || (existingAddress as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Address not found',
					}
					return
				}

				// If setting as default, unset other defaults
				if (isDefault) {
					const existingDefaults = await strapi.entityService.findMany(
						'api::address.address',
						{
							filters: { user: userId, isDefault: true },
						}
					)
					for (const addr of existingDefaults) {
						await strapi.entityService.update('api::address.address', addr.id, {
							data: { isDefault: false },
						})
					}
				}

				const updatedAddress = await strapi.entityService.update(
					'api::address.address',
					id,
					{
						data: {
							type: type || existingAddress.type,
							fullName: fullName || existingAddress.fullName,
							phone: phone || existingAddress.phone,
							address: address || existingAddress.address,
							city: city || existingAddress.city,
							postalCode: postalCode || existingAddress.postalCode,
							isDefault:
								isDefault !== undefined ? isDefault : existingAddress.isDefault,
						},
					}
				)

				ctx.body = {
					success: true,
					data: updatedAddress,
					message: 'Address updated successfully',
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},

		/**
		 * Delete address
		 * DELETE /api/addresses/:id
		 */
		async delete(ctx) {
			try {
				const { id } = ctx.params
				const userId = ctx.state.user?.id

				if (!userId) {
					ctx.status = 401
					ctx.body = {
						success: false,
						message: 'User not authenticated',
					}
					return
				}

				const address = await strapi.entityService.findOne(
					'api::address.address',
					id,
					{
						populate: ['user'],
					}
				)

				if (!address || (address as any).user?.id !== userId) {
					ctx.status = 404
					ctx.body = {
						success: false,
						message: 'Address not found',
					}
					return
				}

				await strapi.entityService.delete('api::address.address', id)

				ctx.body = {
					success: true,
					message: 'Address deleted successfully',
				}
			} catch (error) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: error.message,
				}
			}
		},
	})
)
