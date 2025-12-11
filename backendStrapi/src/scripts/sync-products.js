const API_URL = 'http://localhost:1337'

async function syncProducts() {
	try {
		console.log('🚀 Starting products sync from SBIS...')
		console.log(`📡 Calling: ${API_URL}/api/products/sync-from-sbis`)
		console.log('⏳ This may take several minutes...\n')
		
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes timeout
		
		const response = await fetch(`${API_URL}/api/products/sync-from-sbis`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			signal: controller.signal,
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
		}

		const data = await response.json()

		console.log('✅ Sync completed!')
		console.log('📊 Response:', JSON.stringify(data, null, 2))
		
		if (data.success) {
			console.log(`\n📦 Stats:`)
			console.log(`   - Saved: ${data.data?.stats?.saved || 0}`)
			console.log(`   - Updated: ${data.data?.stats?.updated || 0}`)
			console.log(`   - Total: ${data.data?.stats?.total || 0}`)
		}
	} catch (error) {
		console.error('❌ Sync failed:', error.message)
		if (error.name === 'AbortError') {
			console.error('⏱️  Request timed out after 10 minutes')
		}
		process.exit(1)
	}
}

syncProducts()

