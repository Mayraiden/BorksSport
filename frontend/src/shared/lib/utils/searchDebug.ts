// Utility functions for debugging Meilisearch integration

export const checkMeilisearchStatus = async (
	baseUrl: string = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'
) => {
	try {
		const response = await fetch(
			`${baseUrl}/api/products?meilisearch=true&q=test&limit=1`
		)

		if (response.ok) {
			const data = await response.json()
			return { available: true, data }
		}

		return { available: false, error: response.status }
	} catch (error) {
		return { available: false, error: error }
	}
}

export const testMeilisearchQueries = async (
	baseUrl: string = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'
) => {
	const testQueries = [
		'ball',
		'сумка',
		'X7174593',
		'TeamMate',
		'bag',
	]

	for (const query of testQueries) {
		try {
			await fetch(
				`${baseUrl}/api/products?meilisearch=true&q=${encodeURIComponent(query)}&limit=3`
			)
		} catch {
			// ignore
		}
	}
}

export function logSearchRequest() {}

export function logSearchResponse() {}
