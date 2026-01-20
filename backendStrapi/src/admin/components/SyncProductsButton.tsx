import React, { useState } from 'react'
import { Button, Modal, Typography } from '@strapi/design-system'

const SyncProductsButton: React.FC = () => {
	const [loading, setLoading] = useState(false)
	const [isModalOpen, setIsModalOpen] = useState(false)

	const notify = (type: 'success' | 'warning' | 'danger', message: string) => {
		try {
			// @ts-ignore
			const api = window?.strapi?.notification || window?.strapi?.toaster
			if (api?.toggle) api.toggle({ type, message })
			else if (api?.success && type === 'success') api.success(message)
			else if (api?.warning && type === 'warning') api.warning(message)
			else if (api?.danger && type === 'danger') api.danger(message)
			else if (api?.error && type === 'danger') api.error(message)
			else alert(message)
		} catch {
			alert(message)
		}
	}

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

	const handleClick = () => {
		const uid = getUidFromUrl()
		if (uid !== 'api::product.product') {
			notify('warning', 'Кнопка синхронизации доступна только в товарах')
			return
		}
		setIsModalOpen(true)
	}

	const handleConfirm = async () => {
		setIsModalOpen(false)
		setLoading(true)

		try {
			// 1) основной: старый рабочий эндпоинт с рекурсией
			let res = await fetch('/api/products/sync-from-sbis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			})
			// 2) фолбэк: новый сервисный эндпоинт
			if (res.status === 404 || res.status === 405) {
				res = await fetch('/api/sbis-sync/sync-products', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
				})
				if (res.status === 405) {
					res = await fetch('/api/sbis-sync/sync-products', {
						method: 'GET',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'include',
					})
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
					duplicatesRemoved > 0
						? `, дубликатов удалено: ${duplicatesRemoved}`
						: ''
				}`
			)

			// @ts-ignore
			if (window?.strapi?.reload) window.strapi.reload()
			else window.location.reload()
		} catch (e: any) {
			notify('danger', e.message || 'Ошибка синхронизации')
		} finally {
			setLoading(false)
		}
	}

	// Показывать кнопку только на странице товаров
	const isProductsList = getUidFromUrl() === 'api::product.product'
	if (!isProductsList) return null

	return (
		<>
			<Button onClick={handleClick} loading={loading} variant="secondary">
				Синхронизировать из СБИС
			</Button>

			{isModalOpen && (
				<Modal.Root
					open={isModalOpen}
					onOpenChange={(open) => !open && setIsModalOpen(false)}
				>
					<Modal.Content>
						<Modal.Header>
							<Typography fontWeight="semiBold" id="title">
								Синхронизация товаров
							</Typography>
						</Modal.Header>
						<Modal.Body>
							<Typography>
								Запустить синхронизацию товаров из СБИС? Это может занять
								некоторое время.
							</Typography>
						</Modal.Body>
						<Modal.Footer>
							<Button
								onClick={() => setIsModalOpen(false)}
								variant="tertiary"
							>
								Отмена
							</Button>
							<Button onClick={handleConfirm} variant="secondary">
								Запустить синхронизацию
							</Button>
						</Modal.Footer>
					</Modal.Content>
				</Modal.Root>
			)}
		</>
	)
}

export default SyncProductsButton
