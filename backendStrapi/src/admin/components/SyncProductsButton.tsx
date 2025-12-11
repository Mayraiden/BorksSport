import React, { useState } from 'react'
import { Button } from '@strapi/design-system'

const SyncProductsButton: React.FC = () => {
	const [loading, setLoading] = useState(false)

	const getUidFromUrl = (): string | null => {
		try {
			const m = window.location.pathname.match(
				/\/content-manager\/collection-types\/([^/?#]+)/
			)
			return m ? decodeURIComponent(m[1]) : null
		} catch {
			return null
		}
	}

	const notify = (type: 'success' | 'warning' | 'danger', message: string) => {
		try {
			// @ts-ignore
			const api = window?.strapi?.notification || window?.strapi?.toaster
			if (api?.toggle) api.toggle({ type, message })
			else if (api?.success && type === 'success') api.success(message)
			else if (api?.warning && type === 'warning') api.warning(message)
			else if (api?.danger && type === 'danger') api.danger(message)
			else alert(message)
		} catch {
			alert(message)
		}
	}

	const handleClick = async () => {
		const uid = getUidFromUrl()
		if (uid !== 'api::product.product') {
			notify('warning', 'Кнопка синхронизации доступна только в товарах')
			return
		}
		if (!window.confirm('Запустить синхронизацию товаров из СБИС?')) return
		setLoading(true)
		try {
			// 1) основной: старый рабочий эндпоинт с рекурсией
			let res = await fetch('/api/products/sync-from-sbis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			// 2) фолбэк: новый сервисный эндпоинт
			if (res.status === 404 || res.status === 405) {
				res = await fetch('/api/sbis-sync/sync-products', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				})
				if (res.status === 405) {
					res = await fetch('/api/sbis-sync/sync-products', { method: 'GET' })
				}
			}
			const ct = res.headers.get('content-type') || ''
			const payload: any = ct.includes('application/json')
				? await res.json()
				: { message: await res.text() }
			if (!res.ok || payload?.success === false) {
				throw new Error(payload?.message || 'Ошибка синхронизации')
			}
			const saved = payload?.stats?.saved ?? payload?.data?.stats?.saved ?? 0
			const updated =
				payload?.stats?.updated ?? payload?.data?.stats?.updated ?? 0
			const total = payload?.stats?.total ?? payload?.data?.stats?.total ?? 0
			const duplicatesRemoved =
				payload?.stats?.duplicatesRemoved ??
				payload?.data?.stats?.duplicatesRemoved ??
				0
			notify(
				'success',
				`Синхронизация завершена: сохранено ${saved}, обновлено ${updated}, всего уникальных: ${total}${
					duplicatesRemoved > 0 ? `, дубликатов удалено: ${duplicatesRemoved}` : ''
				}`
			)
			// @ts-ignore
			if (window?.strapi?.reload) window.strapi.reload()
			else window.location.reload()
		} catch (e: any) {
			notify('danger', e.message)
		} finally {
			setLoading(false)
		}
	}

	// Показывать кнопку только на странице товаров
	const isProductsList = getUidFromUrl() === 'api::product.product'
	if (!isProductsList) return null

	return (
		<Button onClick={handleClick} loading={loading} variant="secondary">
			Синхронизировать из СБИС
		</Button>
	)
}

export default SyncProductsButton

