import type { Core } from '@strapi/strapi'
import axios from 'axios'

type RawNomenclature = Record<string, any>

interface FetchOptions {
	apiUrl: string
	accessToken: string
	pointID?: number
	pointId?: number
	priceListId?: number
	pageSize: number
	withBalance: boolean
	withBarcode: boolean
	position?: number | null
}

interface SbisSyncSummary {
	processed: number
	created: number
	updated: number
	categories: number
	categoriesCreated: number
	categoriesUpdated: number
	errors: number
	durationMs: number
	pagesFetched: number
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
	function normalizeName(value?: string | null): string {
		return String(value || '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, ' ')
	}

	function requiredEnv(name: string): string {
		const value = process.env[name]
		if (!value) {
			throw new Error(`Missing required env: ${name}`)
		}
		return value
	}

	function parsePositiveInt(value: unknown, fallback: number): number {
		const num = Number(value)
		if (!Number.isFinite(num) || num <= 0) return fallback
		return Math.floor(num)
	}

	function parseBoolean(value: unknown, fallback = false): boolean {
		if (value === undefined || value === null) return fallback
		if (typeof value === 'boolean') return value
		const normalized = String(value).trim().toLowerCase()
		if (['true', '1', 'yes', 'y'].includes(normalized)) return true
		if (['false', '0', 'no', 'n'].includes(normalized)) return false
		return fallback
	}

	function toNumberOrNull(value: unknown): number | null {
		if (value === null || value === undefined) return null
		if (typeof value === 'string') {
			const raw = value.trim()
			if (!raw) return null
			const cleaned = raw
				.replace(/\s+/g, '')
				.replace(/,(?=\d{3}\b)/g, '')
				.replace(',', '.')
			const parsed = Number(cleaned)
			return Number.isFinite(parsed) ? parsed : null
		}
		const num = Number(value)
		return Number.isFinite(num) ? num : null
	}

	function hasPositiveStock(item: RawNomenclature): boolean {
		const balance = toNumberOrNull(item?.balance)
		return balance !== null && balance > 0
	}

	function nomenclatureKey(item: RawNomenclature): string | null {
		if (item?.isParent === true) {
			const categoryId = toNumberOrNull(item?.hierarchicalId)
			return categoryId === null ? null : `c:${categoryId}`
		}
		const productId = toNumberOrNull(item?.id)
		if (productId !== null) return `p:${productId}`
		const externalId = String(item?.externalId || '').trim()
		if (externalId) return `e:${externalId}`
		const hierarchicalId = toNumberOrNull(item?.hierarchicalId)
		return hierarchicalId === null ? null : `h:${hierarchicalId}`
	}

	function asHtmlDescription(item: RawNomenclature): string | null {
		const raw = item?.description || item?.description_simple
		if (typeof raw !== 'string') return null
		const text = raw.trim()
		return text.length > 0 ? text : null
	}

	function extractAttribute(item: RawNomenclature, key: string): string | null {
		const attrs = item?.attributes
		if (!attrs || typeof attrs !== 'object') return null
		const value = attrs[key]
		if (value === undefined || value === null) return null
		const normalized = String(value).trim()
		return normalized.length > 0 ? normalized : null
	}

	function extractAttributeByAliases(item: RawNomenclature, aliases: string[]): string | null {
		const attrs = item?.attributes
		if (!attrs || typeof attrs !== 'object') return null
		const attrEntries = Object.entries(attrs).map(([key, value]) => [normalizeName(key), value] as const)
		for (const alias of aliases) {
			const normalizedAlias = normalizeName(alias)
			const found = attrEntries.find(([key]) => key === normalizedAlias)
			if (!found) continue
			const value = found[1]
			if (value === undefined || value === null) continue
			const normalized = String(value).trim()
			if (normalized) return normalized
		}
		return null
	}

	function normalizeNomenclatures(value: unknown): RawNomenclature[] {
		if (Array.isArray(value)) return value
		return []
	}

	async function getToken(
		oauthUrl: string,
		creds: { clientId: string; appSecret: string; secretKey: string }
	): Promise<string> {
		const attempts = [
			{
				headers: { 'Content-Type': 'application/json' },
				data: {
					app_client_id: creds.clientId,
					app_secret: creds.appSecret,
					secret_key: creds.secretKey,
				},
			},
			{
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				data: new URLSearchParams({
					app_client_id: creds.clientId,
					app_secret: creds.appSecret,
					secret_key: creds.secretKey,
				}).toString(),
			},
		]

		let lastError: Error | null = null

		for (const attempt of attempts) {
			try {
				const response = await axios.post(oauthUrl, attempt.data, {
					headers: attempt.headers,
					timeout: 30000,
					validateStatus: () => true,
				})
				if (response.status >= 200 && response.status < 300 && response.data?.access_token) {
					return String(response.data.access_token)
				}
				lastError = new Error(`SBIS auth failed: status=${response.status}`)
			} catch (error: any) {
				lastError = new Error(`SBIS auth request failed: ${error?.message || error}`)
			}
		}

		throw lastError || new Error('SBIS auth failed')
	}

	async function fetchNomenclaturePage(options: FetchOptions) {
		const { apiUrl, accessToken, pointID, pointId, priceListId, pageSize, withBalance, withBarcode, position } = options
		const params: Record<string, unknown> = { pageSize, withBalance, withBarcode }
		if (typeof pointID === 'number') params.pointID = pointID
		if (typeof pointId === 'number') params.pointId = pointId
		if (typeof priceListId === 'number') params.priceListId = priceListId
		if (position !== null && position !== undefined) {
			params.position = position
			params.order = 'after'
		}

		const response = await axios.get(`${apiUrl}/nomenclature/list`, {
			timeout: 30000,
			validateStatus: () => true,
			headers: { Authorization: `Bearer ${accessToken}` },
			params,
		})

		const nomenclatures = normalizeNomenclatures(response.data?.nomenclatures)
		return {
			status: response.status,
			nomenclatures,
			hasMore: response.data?.outcome?.hasMore === true,
			rawData: response.data,
		}
	}

	async function fetchCatalogRootWise(args: Omit<FetchOptions, 'position' | 'pointID' | 'pointId' | 'priceListId'> & { maxPages: number }) {
		async function fetchRoots(): Promise<RawNomenclature[]> {
			const roots = new Map<number, RawNomenclature>()
			for (const pageSize of [500, 250, 100, 50, args.pageSize]) {
				const page = await fetchNomenclaturePage({
					...args,
					pageSize,
					position: null,
				})
				if (page.status < 200 || page.status >= 300) {
					throw new Error(`SBIS root page failed: status=${page.status}, body=${JSON.stringify(page.rawData)}`)
				}
				for (const row of page.nomenclatures) {
					if (row?.isParent === true && toNumberOrNull(row?.hierarchicalParent) === null) {
						const id = toNumberOrNull(row?.hierarchicalId)
						if (id !== null && !roots.has(id)) {
							roots.set(id, row)
						}
					}
				}
			}
			return [...roots.values()].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ru'))
		}

		async function fetchBranch(root: RawNomenclature): Promise<{ items: RawNomenclature[]; pages: number }> {
			const items = new Map<string, RawNomenclature>()
			const rootKey = nomenclatureKey(root)
			if (rootKey) items.set(rootKey, root)

			let position = toNumberOrNull(root?.hierarchicalId)
			let pages = 0
			for (let pageIndex = 1; pageIndex <= args.maxPages; pageIndex += 1) {
				const page = await fetchNomenclaturePage({
					...args,
					pageSize: args.pageSize,
					position,
				})
				pages += 1
				if (page.status < 200 || page.status >= 300) {
					throw new Error(`SBIS branch page failed: root=${root?.name}, page=${pageIndex}, status=${page.status}, body=${JSON.stringify(page.rawData)}`)
				}
				if (page.nomenclatures.length === 0) break

				const nextRootIndex = page.nomenclatures.findIndex(
					(row) =>
						row?.isParent === true &&
						toNumberOrNull(row?.hierarchicalParent) === null &&
						toNumberOrNull(row?.hierarchicalId) !== toNumberOrNull(root?.hierarchicalId)
				)
				const branchRows = nextRootIndex >= 0
					? page.nomenclatures.slice(0, nextRootIndex)
					: page.nomenclatures

				for (const row of branchRows) {
					const key = nomenclatureKey(row)
					if (key && !items.has(key)) {
						items.set(key, row)
					}
				}
				if (nextRootIndex >= 0 || !page.hasMore) break

				const last = page.nomenclatures[page.nomenclatures.length - 1]
				const nextPosition = toNumberOrNull(last?.hierarchicalId)
				if (nextPosition === null || nextPosition === position) break
				position = nextPosition
			}

			return { items: [...items.values()], pages }
		}

		const roots = await fetchRoots()
		const merged = new Map<string, RawNomenclature>()
		let pagesFetched = 0

		strapi.log.info(
			`[SBIS Sync] Root-wise catalog traversal: roots=${roots.map((root) => `${root?.name}#${root?.hierarchicalId}`).join(', ')}`
		)

		for (const root of roots) {
			const branch = await fetchBranch(root)
			pagesFetched += branch.pages
			const products = branch.items.filter((item) => item?.isParent !== true)
			const publishedWithListBalance = products.filter(
				(item) => item?.published === true && hasPositiveStock(item)
			)
			strapi.log.info(
				`[SBIS Sync] Root branch fetched: root=${root?.name}, pages=${branch.pages}, rows=${branch.items.length}, products=${products.length}, publishedWithListBalance=${publishedWithListBalance.length}`
			)
			for (const item of branch.items) {
				const key = nomenclatureKey(item)
				if (key && !merged.has(key)) {
					merged.set(key, item)
				}
			}
		}

		return { allItems: [...merged.values()], pagesFetched }
	}

	async function fetchWarehouseBalances(args: {
		apiUrl: string
		accessToken: string
		companyId: number
		warehouseId: number
		nomenclatureIds: number[]
	}): Promise<Map<number, number>> {
		const balances = new Map<number, number>()
		const baseUrl = args.apiUrl.replace(/\/v2\/?$/, '')
		const chunkSize = 200

		for (let index = 0; index < args.nomenclatureIds.length; index += chunkSize) {
			const chunk = args.nomenclatureIds.slice(index, index + chunkSize)
			const response = await axios.get(`${baseUrl}/nomenclature/balances`, {
				timeout: 30000,
				validateStatus: () => true,
				headers: { Authorization: `Bearer ${args.accessToken}` },
				params: {
					companies: JSON.stringify([args.companyId]),
					warehouses: JSON.stringify([args.warehouseId]),
					nomenclatures: JSON.stringify(chunk),
				},
			})
			if (response.status < 200 || response.status >= 300) {
				throw new Error(
					`SBIS balances failed: status=${response.status}, body=${JSON.stringify(response.data)}`
				)
			}

			const rows =
				response.data?.balances ||
				response.data?.items ||
				response.data?.result ||
				[]
			for (const row of Array.isArray(rows) ? rows : []) {
				const productId = toNumberOrNull(row?.nomenclature)
				const balance = toNumberOrNull(row?.balance)
				if (productId !== null && balance !== null) {
					balances.set(productId, balance)
				}
			}
		}

		return balances
	}

	async function fetchAllNomenclatures(args: Omit<FetchOptions, 'position'> & { maxPages: number }) {
		async function fetchByCursor(pageSizeOverride: number): Promise<{ items: RawNomenclature[]; pages: number }> {
			const items: RawNomenclature[] = []
			let position: number | null = null
			let pages = 0

			for (let pageIndex = 1; pageIndex <= args.maxPages; pageIndex += 1) {
				const page = await fetchNomenclaturePage({
					...args,
					pageSize: pageSizeOverride,
					position,
				})
				pages += 1
				if (page.status < 200 || page.status >= 300) {
					throw new Error(
						`SBIS nomenclature page failed: page=${pageIndex}, status=${page.status}, body=${JSON.stringify(page.rawData)}`
					)
				}
				items.push(...page.nomenclatures)
				if (page.nomenclatures.length === 0 || !page.hasMore) {
					break
				}

				const lastItem = page.nomenclatures[page.nomenclatures.length - 1]
				const nextPosition = toNumberOrNull(lastItem?.hierarchicalId)
				if (nextPosition === null) break
				position = nextPosition
			}

			return { items, pages }
		}

		const candidatePageSizes = Array.from(
			new Set([
				args.pageSize,
				100,
				50,
			].filter((x) => Number.isFinite(x) && x > 0))
		)
		const attempts: Array<{ pageSize: number; items: RawNomenclature[]; pages: number }> = []
		for (const pageSize of candidatePageSizes) {
			const fetched = await fetchByCursor(pageSize)
			attempts.push({ pageSize, items: fetched.items, pages: fetched.pages })
		}

		const itemKey = (item: RawNomenclature): string | null => {
			if (item?.isParent === true) {
				const categoryKey = toNumberOrNull(item?.hierarchicalId)
				return categoryKey === null ? null : `c:${categoryKey}`
			}
			const productId = toNumberOrNull(item?.id)
			if (productId !== null) return `p:${productId}`
			const ext = String(item?.externalId || '').trim()
			if (ext) return `e:${ext}`
			const hier = toNumberOrNull(item?.hierarchicalId)
			return hier === null ? null : `h:${hier}`
		}
		const productCountOf = (items: RawNomenclature[]): number => {
			const seen = new Set<string>()
			for (const item of items) {
				if (item?.isParent === true) continue
				const key = itemKey(item)
				if (key) seen.add(key)
			}
			return seen.size
		}

		attempts.sort((a, b) => {
			const byProducts = productCountOf(b.items) - productCountOf(a.items)
			if (byProducts !== 0) return byProducts
			return b.items.length - a.items.length
		})
		const best = attempts[0]

		const mergedByKey = new Map<string, RawNomenclature>()
		const keyOf = (item: RawNomenclature): string | null => {
			if (item?.isParent === true) {
				const categoryKey = toNumberOrNull(item?.hierarchicalId)
				return categoryKey === null ? null : `c:${categoryKey}`
			}
			const productId = toNumberOrNull(item?.id)
			if (productId !== null) return `p:${productId}`
			const ext = String(item?.externalId || '').trim()
			if (ext) return `e:${ext}`
			const hier = toNumberOrNull(item?.hierarchicalId)
			return hier === null ? null : `h:${hier}`
		}
		for (const attempt of attempts) {
			strapi.log.info(
				`[SBIS Sync] Pagination attempt: pageSize=${attempt.pageSize}, pages=${attempt.pages}, rows=${attempt.items.length}, products=${productCountOf(attempt.items)}`
			)
		}
		for (const item of attempts.flatMap((attempt) => attempt.items)) {
			const key = keyOf(item)
			if (!key) continue
			if (!mergedByKey.has(key)) {
				mergedByKey.set(key, item)
			}
		}

		const mergedItems = [...mergedByKey.values()]
		if (mergedItems.length > best.items.length) {
			strapi.log.warn(
				`[SBIS Sync] Pagination stabilization merged additional rows: bestRows=${best.items.length}, mergedRows=${mergedItems.length}`
			)
		}

		return { allItems: mergedItems, pagesFetched: attempts.reduce((acc, x) => acc + x.pages, 0) }
	}

	function inferCategoryType(level: number): 'sport' | 'productType' | 'subcategory' | 'brand' {
		if (level === 0) return 'sport'
		if (level === 1) return 'productType'
		if (level === 2) return 'brand'
		return 'subcategory'
	}

	async function upsertGlobalBrand(
		brandName: string,
		cache?: Map<string, number>
	): Promise<number | undefined> {
		const normalizedBrandName = normalizeName(brandName)
		const displayName = String(brandName || '').trim()
		if (!normalizedBrandName || !displayName) return undefined

		if (cache?.has(normalizedBrandName)) {
			return cache.get(normalizedBrandName)
		}

		const existing = await strapi.db.query('api::brand.brand').findOne({
			where: { normalizedName: normalizedBrandName },
			select: ['id', 'name'],
		})

		let brandId: number
		if (existing?.id) {
			brandId = Number(existing.id)
			await strapi.entityService.update('api::brand.brand' as any, brandId, {
				data: {
					name: displayName,
					isActive: true,
				},
			})
		} else {
			const created = await strapi.entityService.create('api::brand.brand' as any, {
				data: {
					name: displayName,
					normalizedName: normalizedBrandName,
					isActive: true,
				},
			})
			brandId = Number(created.id)
		}

		cache?.set(normalizedBrandName, brandId)
		return brandId
	}

	async function upsertCategories(
		categories: RawNomenclature[]
	): Promise<{
		categoryIdBySbisId: Map<number, number>
		categoriesCreated: number
		categoriesUpdated: number
	}> {
		const uniqueByHierId = new Map<number, RawNomenclature>()
		for (const category of categories) {
			const hierId = toNumberOrNull(category?.hierarchicalId)
			if (hierId === null) continue
			if (!uniqueByHierId.has(hierId)) {
				uniqueByHierId.set(hierId, category)
			}
		}

		const levelCache = new Map<number, number>()
		function computeLevel(hierId: number, safety = 0): number {
			if (levelCache.has(hierId)) return levelCache.get(hierId)!
			if (safety > 100) return 0
			const node = uniqueByHierId.get(hierId)
			const parentId = toNumberOrNull(node?.hierarchicalParent)
			if (parentId === null || !uniqueByHierId.has(parentId)) {
				levelCache.set(hierId, 0)
				return 0
			}
			const level = computeLevel(parentId, safety + 1) + 1
			levelCache.set(hierId, level)
			return level
		}

		const sortedCategories = [...uniqueByHierId.values()].sort((a, b) => {
			const aId = toNumberOrNull(a?.hierarchicalId) || 0
			const bId = toNumberOrNull(b?.hierarchicalId) || 0
			return computeLevel(aId) - computeLevel(bId)
		})

		const categoryIdBySbisId = new Map<number, number>()
		let categoriesCreated = 0
		let categoriesUpdated = 0

		for (const category of sortedCategories) {
			const sbisId = toNumberOrNull(category?.hierarchicalId)
			const name = String(category?.name || '').trim()
			if (sbisId === null || !name) continue

			const parentSbisId = toNumberOrNull(category?.hierarchicalParent)
			const level = computeLevel(sbisId)
			const type = inferCategoryType(level)
			const parentStrapiId = parentSbisId !== null ? categoryIdBySbisId.get(parentSbisId) : undefined

			const data: Record<string, any> = {
				name,
				level,
				type,
				isActive: true,
				sbisId,
				sbisParentId: parentSbisId,
			}
			if (typeof parentStrapiId === 'number') {
				data.parent = parentStrapiId
			} else {
				data.parent = null
			}

			const existing = await strapi.db.query('api::category.category').findOne({
				where: { sbisId },
				select: ['id'],
			})

			if (existing?.id) {
				const updated = await strapi.entityService.update('api::category.category', existing.id, { data: data as any })
				categoryIdBySbisId.set(sbisId, Number(updated.id))
				categoriesUpdated += 1
			} else {
				const created = await strapi.entityService.create('api::category.category', { data: data as any })
				categoryIdBySbisId.set(sbisId, Number(created.id))
				categoriesCreated += 1
			}
		}

		return { categoryIdBySbisId, categoriesCreated, categoriesUpdated }
	}

	function resolveCategoryChain(
		parentHierId: number | null,
		categoriesByHierId: Map<number, RawNomenclature>
	): RawNomenclature[] {
		const chain: RawNomenclature[] = []
		let cursor = parentHierId
		let safety = 0
		while (cursor !== null && safety < 100) {
			const node = categoriesByHierId.get(cursor)
			if (!node) break
			chain.unshift(node)
			cursor = toNumberOrNull(node?.hierarchicalParent)
			safety += 1
		}
		return chain
	}

	function toAbsoluteImageUrl(image: string, apiUrl: string): string {
		if (!image) return image
		if (image.startsWith('http://') || image.startsWith('https://')) return image
		if (image.startsWith('/')) {
			return `${apiUrl}${image}`
		}
		return image
	}

	async function syncProducts(
		products: RawNomenclature[],
		apiUrl: string,
		categoryIdBySbisId: Map<number, number>,
		categoriesByHierId: Map<number, RawNomenclature>
	): Promise<{ created: number; updated: number; errors: number }> {
		let created = 0
		let updated = 0
		let errors = 0
		const globalBrandCache = new Map<string, number>()
		let productsWithBrandAttr = 0
		let productsWithBrandCategory = 0
		let productsWithBrandRef = 0
		let productsWithoutSport = 0

		for (const item of products) {
			try {
				const sbisId = toNumberOrNull(item?.id)
				const hierarchicalId = toNumberOrNull(item?.hierarchicalId)
				const rawName = String(item?.name || '').trim()
				if (!rawName) {
					errors += 1
					continue
				}

				const parentHierId = toNumberOrNull(item?.hierarchicalParent)
				const chain = resolveCategoryChain(parentHierId, categoriesByHierId)
				const sport = chain[0]
				const productType = chain[1]
				const brandOrSub = chain[2]

				const sportSbisId = toNumberOrNull(sport?.hierarchicalId)
				const productTypeSbisId = toNumberOrNull(productType?.hierarchicalId)
				const fallbackBrandSbisId = toNumberOrNull(brandOrSub?.hierarchicalId)

				const brandNameFromAttributes = extractAttributeByAliases(item, ['Бренд', 'Брэнд'])
				const normalizedBrandName = normalizeName(brandNameFromAttributes)
				const brandCategorySbisId = normalizedBrandName
					? (() => {
							for (const node of chain) {
								if (normalizeName(node?.name) === normalizedBrandName) {
									return toNumberOrNull(node?.hierarchicalId)
								}
							}
							return null
					  })()
					: null
				const brandSbisId = brandCategorySbisId
				const globalBrandId = brandNameFromAttributes
					? await upsertGlobalBrand(brandNameFromAttributes, globalBrandCache)
					: undefined

				const images = Array.isArray(item?.images)
					? item.images.map((img: any) => toAbsoluteImageUrl(String(img || '').trim(), apiUrl)).filter(Boolean)
					: []

				const externalId = String(item?.externalId || '').trim()
				const fallbackExternalId =
					hierarchicalId !== null ? `sbis-hier-${hierarchicalId}` : `sbis-name-${rawName.toLowerCase()}`
				const sbisExternalId = externalId || fallbackExternalId

				const now = new Date()
				const data: Record<string, any> = {
					name: rawName,
					description: asHtmlDescription(item),
					price: toNumberOrNull(item?.cost),
					article: item?.article ? String(item.article) : null,
					model: extractAttribute(item, 'Модель') || extractAttribute(item, 'model'),
					unit: item?.unit ? String(item.unit) : null,
					length: toNumberOrNull(extractAttribute(item, 'Длина')),
					width: toNumberOrNull(extractAttribute(item, 'Ширина')),
					height: toNumberOrNull(extractAttribute(item, 'Высота')),
					weight: toNumberOrNull(extractAttribute(item, 'Вес')),
					images,
					published: true,
					sbisId,
					sbisExternalId,
					sbisNomNumber: item?.nomNumber ? String(item.nomNumber) : null,
					categoryName: String(
						brandNameFromAttributes || brandOrSub?.name || productType?.name || sport?.name || ''
					).trim() || null,
					rootCategoryName: String(sport?.name || '').trim() || null,
					size: extractAttribute(item, 'Размер') || extractAttribute(item, 'size'),
					color: extractAttribute(item, 'Цвет') || extractAttribute(item, 'color'),
					stock: toNumberOrNull(item?.balance) ?? 0,
					lastSyncAt: now,
					category: parentHierId !== null ? categoryIdBySbisId.get(parentHierId) || null : null,
					sportCategory: sportSbisId !== null ? categoryIdBySbisId.get(sportSbisId) || null : null,
					productCategory:
						productTypeSbisId !== null ? categoryIdBySbisId.get(productTypeSbisId) || null : null,
					brand: brandSbisId !== null ? categoryIdBySbisId.get(brandSbisId) || null : null,
					brandRef: globalBrandId || null,
					subcategory: null,
				}
				// В strict_attr режиме бренд не берем из дерева, если в атрибутах его нет.
				if (!brandNameFromAttributes) {
					data.brand = null
					data.brandRef = null
				}

				let existing = sbisId !== null
					? await strapi.db.query('api::product.product').findOne({
							where: { sbisId },
							select: ['id'],
					  })
					: null
				if (!existing && sbisExternalId) {
					existing = await strapi.db.query('api::product.product').findOne({
						where: { sbisExternalId },
						select: ['id'],
					})
				}

				if (existing?.id) {
					await strapi.entityService.update('api::product.product', existing.id, { data: data as any })
					updated += 1
				} else {
					await strapi.entityService.create('api::product.product', { data: data as any })
					created += 1
				}

				if (brandNameFromAttributes) productsWithBrandAttr += 1
				if (data.brand) productsWithBrandCategory += 1
				if (data.brandRef) productsWithBrandRef += 1
				if (!data.sportCategory) productsWithoutSport += 1
			} catch (error: any) {
				errors += 1
				strapi.log.warn(`[SBIS Sync] Failed to sync product: ${error?.message || error}`)
			}
		}

		strapi.log.info(
			`[SBIS Sync] Product diagnostics: total=${products.length}, withBrandAttr=${productsWithBrandAttr}, withBrandCategory=${productsWithBrandCategory}, withBrandRef=${productsWithBrandRef}, withoutSport=${productsWithoutSport}`
		)

		return { created, updated, errors }
	}

	function rootStatsFromProducts(
		products: RawNomenclature[],
		categoriesByHierId: Map<number, RawNomenclature>
	): Map<string, number> {
		const roots = new Map<string, number>()
		for (const item of products) {
			const parentHierId = toNumberOrNull(item?.hierarchicalParent)
			const chain = resolveCategoryChain(parentHierId, categoriesByHierId)
			const rootName = String(chain[0]?.name || 'UNRESOLVED').trim() || 'UNRESOLVED'
			roots.set(rootName, (roots.get(rootName) || 0) + 1)
		}
		return roots
	}

	function mergeByUniqueKey(items: RawNomenclature[], keyResolver: (item: RawNomenclature) => string | null): RawNomenclature[] {
		const seen = new Set<string>()
		const result: RawNomenclature[] = []
		for (const item of items) {
			const key = keyResolver(item)
			if (!key || seen.has(key)) continue
			seen.add(key)
			result.push(item)
		}
		return result
	}

	async function runSbisCatalogSync(): Promise<SbisSyncSummary> {
		const startedAt = Date.now()
		const oauthUrl = requiredEnv('SBIS_OAUTH_URL')
		const apiUrl = requiredEnv('SBIS_API_URL')
		const clientId = requiredEnv('SBIS_APP_CLIENT_ID')
		const appSecret = requiredEnv('SBIS_APP_SECRET')
		const secretKey = requiredEnv('SBIS_SECRET_KEY')

		const pointID = parsePositiveInt(process.env.SBIS_POINT_ID, 201)
		const companyId = parsePositiveInt(process.env.SBIS_COMPANY_ID, 169)
		const warehouseId = parsePositiveInt(process.env.SBIS_WAREHOUSE_ID, 204)
		const sourceRaw = String(process.env.SBIS_SYNC_SOURCE || 'catalog').toLowerCase()
		const priceListIdFromEnv = parsePositiveInt(process.env.SBIS_PRICE_LIST_ID, 24)
		const pageSize = parsePositiveInt(process.env.SBIS_SYNC_PAGE_SIZE, 500)
		const maxPages = parsePositiveInt(process.env.SBIS_SYNC_MAX_PAGES, 120)
		const withBalance = parseBoolean(process.env.SBIS_SYNC_WITH_BALANCE, true)
		const withBarcode = parseBoolean(process.env.SBIS_SYNC_WITH_BARCODE, true)

		const accessToken = await getToken(oauthUrl, { clientId, appSecret, secretKey })
		const sourceModes = sourceRaw === 'both' ? ['catalog', 'pricelist'] : [sourceRaw]
		let pagesFetched = 0
		const fetchedBatches: RawNomenclature[][] = []
		for (const sourceMode of sourceModes) {
			const usePriceList = sourceMode !== 'catalog'
			const batch = usePriceList
				? await fetchAllNomenclatures({
						apiUrl,
						accessToken,
						pointID,
						pointId: undefined,
						priceListId: priceListIdFromEnv,
						pageSize,
						withBalance,
						withBarcode,
						maxPages,
				  })
				: await fetchCatalogRootWise({
						apiUrl,
						accessToken,
						pageSize,
						withBalance,
						withBarcode,
						maxPages,
				  })
			fetchedBatches.push(batch.allItems)
			pagesFetched += batch.pagesFetched
			strapi.log.info(
				`[SBIS Sync] Source ${sourceMode}: fetched ${batch.allItems.length} items, pages=${batch.pagesFetched}, companyId=${companyId}, warehouseId=${warehouseId}, pointID=${usePriceList ? pointID : 'none'}, priceListId=${usePriceList ? priceListIdFromEnv : 'none'}`
			)
		}
		const allItems = mergeByUniqueKey(
			fetchedBatches.flat(),
			nomenclatureKey
		)

		const allCategoryItems = allItems.filter((item) => item?.isParent === true)
		const rawProductItems = allItems.filter((item) => item?.isParent !== true)
		const publishedProductItems = rawProductItems.filter((item) => item?.published === true)

		const categoriesByHierId = new Map<number, RawNomenclature>()
		for (const category of allCategoryItems) {
			const hierId = toNumberOrNull(category?.hierarchicalId)
			if (hierId === null) continue
			if (!categoriesByHierId.has(hierId)) {
				categoriesByHierId.set(hierId, category)
			}
		}

		const publishedProductIds = publishedProductItems
			.map((item) => toNumberOrNull(item?.id))
			.filter((id): id is number => id !== null)
		const warehouseBalances = await fetchWarehouseBalances({
			apiUrl,
			accessToken,
			companyId,
			warehouseId,
			nomenclatureIds: publishedProductIds,
		})
		const productItems: RawNomenclature[] = publishedProductItems
			.map((item) => {
				const id = toNumberOrNull(item?.id)
				const balance = id !== null ? warehouseBalances.get(id) : undefined
				return {
					...item,
					balance: balance ?? 0,
				} as RawNomenclature
			})
			.filter((item) => hasPositiveStock(item))

		const relevantCategoryIds = new Set<number>()
		for (const product of productItems) {
			let cursor = toNumberOrNull(product?.hierarchicalParent)
			let safety = 0
			while (cursor !== null && safety < 100) {
				const category = categoriesByHierId.get(cursor)
				if (!category) break
				relevantCategoryIds.add(cursor)
				cursor = toNumberOrNull(category?.hierarchicalParent)
				safety += 1
			}
		}
		const categoryItems = allCategoryItems.filter((category) => {
			const id = toNumberOrNull(category?.hierarchicalId)
			return id !== null && relevantCategoryIds.has(id)
		})

		const categoriesResult = await upsertCategories(categoryItems)
		const rootStats = rootStatsFromProducts(productItems, categoriesByHierId)
		const rootStatsArray = [...rootStats.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => `${name}: ${count}`)
		strapi.log.info(
			`[SBIS Sync] Root categories by published products: ${rootStatsArray.join(', ') || 'none'}`
		)
		if (!rootStats.has('Хоккей на траве')) {
			strapi.log.warn(
				`[SBIS Sync] Root category "Хоккей на траве" not found in current payload. Verify SBIS_POINT_ID=${pointID}, SBIS_SYNC_SOURCE=${sourceRaw}, SBIS_PRICE_LIST_ID=${priceListIdFromEnv}.`
			)
		}
		strapi.log.info(
			`[SBIS Sync] Product filtering: totalRaw=${rawProductItems.length}, published=${publishedProductItems.length}, balancesReturned=${warehouseBalances.size}, warehousePositive=${productItems.length}, companyId=${companyId}, warehouseId=${warehouseId}`
		)
		const productResult = await syncProducts(
			productItems,
			apiUrl,
			categoriesResult.categoryIdBySbisId,
			categoriesByHierId
		)

		return {
			processed: productItems.length,
			created: productResult.created,
			updated: productResult.updated,
			categories: categoriesResult.categoryIdBySbisId.size,
			categoriesCreated: categoriesResult.categoriesCreated,
			categoriesUpdated: categoriesResult.categoriesUpdated,
			errors: productResult.errors,
			durationMs: Date.now() - startedAt,
			pagesFetched,
		}
	}

	return {
		runSbisCatalogSync,
	}
}
