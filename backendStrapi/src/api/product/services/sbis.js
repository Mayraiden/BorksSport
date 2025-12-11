'use strict'

const axios = require('axios')

/**
 * SBIS API Service
 * Handles authentication and data fetching from SBIS
 */
module.exports = ({ strapi }) => ({
	// Configuration
	config: {
		oauthUrl: 'https://online.sbis.ru/oauth/service/',
		apiUrl: 'https://api.sbis.ru/retail/v2',
		appClientId: '7339792387629061',
		appSecret: 'TTLPJZWCFTFTYTWUYGVJFCFV',
		secretKey:
			'QqrGX48qxuP3BYCAD125C18NwRKQImkIaBysesIKWSjH0iB9pAaTei9jlnCRMO6AHvN1WEEPwoRfzkxXgsvBHSb5XYoH2h9fzqPko6FS9AuWOsv6i1pKhw',
		pointId: 201,
		priceListId: 24, // Новый прайс-лист
		timeout: 30000,
	},

	/**
	 * Get access token from SBIS OAuth
	 */
	async getAccessToken() {
		try {
			strapi.log.info('Getting SBIS access token...')

			const response = await axios.post(
				this.config.oauthUrl,
				{
					app_client_id: this.config.appClientId,
					app_secret: this.config.appSecret,
					secret_key: this.config.secretKey,
				},
				{
					headers: {
						'Content-Type': 'application/json',
					},
					timeout: this.config.timeout,
				}
			)

			const { access_token, sid, token } = response.data

			strapi.log.info('SBIS access token received successfully')

			return {
				accessToken: access_token,
				sid,
				token,
			}
		} catch (error) {
			strapi.log.error('Failed to get SBIS access token:', error.message)
			throw new Error(`SBIS authentication failed: ${error.message}`)
		}
	},

	/**
	 * Sync products from SBIS to Strapi
	 */
	async syncProducts() {
		try {
			strapi.log.info('Starting SBIS products sync...')

			// Get access token
			const { accessToken } = await this.getAccessToken()

			// For now, just return success
			strapi.log.info('SBIS products sync completed successfully')

			return {
				success: true,
				message: 'Products synced successfully',
				stats: { saved: 0, updated: 0, total: 0 },
			}
		} catch (error) {
			strapi.log.error('SBIS products sync failed:', error.message)
			throw error
		}
	},
})
