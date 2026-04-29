import React, { useState } from 'react'
import { Button, Modal, Typography } from '@strapi/design-system'

const PRODUCT_UID = 'api::product.product'

type NotifyType = 'success' | 'warning' | 'danger'

const SbisSyncButton: React.FC = () => {
	const [loading, setLoading] = useState(false)
	const [isModalOpen, setIsModalOpen] = useState(false)

	const currentUid = (() => {
		try {
			const fromPath = window.location.pathname.match(
				/\/content-manager\/collection-types\/([^/?#]+)/
			)
			if (fromPath?.[1]) return decodeURIComponent(fromPath[1])

			// Strapi admin может работать с hash-based маршрутами (#/content-manager/...)
			const fromHash = window.location.hash.match(
				/#\/content-manager\/collection-types\/([^/?#]+)/
			)
			if (fromHash?.[1]) return decodeURIComponent(fromHash[1])

			return null
		} catch {
			return null
		}
	})()

	const isProductCollection = currentUid === PRODUCT_UID
	if (!isProductCollection) return null

	const notify = (type: NotifyType, message: string) => {
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

	const runSync = async () => {
		setLoading(true)
		setIsModalOpen(false)
		try {
			const res = await fetch('/api/sync-control/sbis/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			})
			const data = await res.json()
			if (!res.ok || data?.success === false) {
				const errMsg =
					data?.message ||
					(res.status === 409
						? 'Дождитесь завершения текущей синхронизации'
						: 'Не удалось запустить синхронизацию SBIS')
				throw new Error(errMsg)
			}

			const summary = data?.summary || {}
			notify(
				'success',
				`SBIS sync завершен. Обработано: ${summary.processed || 0}, создано: ${summary.created || 0}, обновлено: ${summary.updated || 0}, ошибок: ${summary.errors || 0}`
			)

			// @ts-ignore
			if (window?.strapi?.reload) window.strapi.reload()
			else window.location.reload()
		} catch (error: any) {
			notify('danger', error?.message || 'Ошибка синхронизации SBIS')
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Button variant="secondary" onClick={() => setIsModalOpen(true)} loading={loading}>
				Синхронизировать с СБИС
			</Button>

			{isModalOpen && (
				<Modal.Root
					open={isModalOpen}
					onOpenChange={(open) => !open && setIsModalOpen(false)}
				>
					<Modal.Content>
						<Modal.Header>
							<Typography fontWeight="semiBold" id="title">
								Запуск SBIS sync
							</Typography>
						</Modal.Header>
						<Modal.Body>
							<Typography>
								Запустить ручную синхронизацию товаров через SBIS API? Во время выполнения
								нельзя запускать другой sync.
							</Typography>
						</Modal.Body>
						<Modal.Footer>
							<Button onClick={() => setIsModalOpen(false)} variant="tertiary">
								Отмена
							</Button>
							<Button onClick={runSync} variant="secondary">
								Запустить
							</Button>
						</Modal.Footer>
					</Modal.Content>
				</Modal.Root>
			)}
		</>
	)
}

export default SbisSyncButton
