import React, { useState } from 'react'
import { Button, Modal, Typography } from '@strapi/design-system'

const ClearCollectionButton: React.FC = () => {
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
		if (!uid) {
			notify('warning', 'UID коллекции не найден')
			return
		}
		setIsModalOpen(true)
	}

	const handleConfirm = async () => {
		const uid = getUidFromUrl()
		if (!uid) return

		setIsModalOpen(false)
		setLoading(true)

		try {
			const encoded = encodeURIComponent(uid)
			const res = await fetch(`/api/maintenance/clear/${encoded}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			const data = await res.json()
			if (!res.ok || data?.success === false) {
				throw new Error(data?.message || 'Ошибка очистки коллекции')
			}

			notify('success', `Успешно удалено: ${data?.data?.deleted || 0} записей`)

			// Перезагрузить список
			// @ts-ignore
			if (window?.strapi?.reload) window.strapi.reload()
			else window.location.reload()
		} catch (e: any) {
			notify('danger', e.message || 'Ошибка очистки коллекции')
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Button variant="danger-light" onClick={handleClick} loading={loading}>
				Очистить коллекцию
			</Button>

			{isModalOpen && (
				<Modal.Root
					open={isModalOpen}
					onOpenChange={(open) => !open && setIsModalOpen(false)}
				>
					<Modal.Content>
						<Modal.Header>
							<Typography fontWeight="semiBold" id="title">
								Подтверждение удаления
							</Typography>
						</Modal.Header>
						<Modal.Body>
							<Typography>
								Вы уверены, что хотите удалить все записи этой коллекции? Это
								действие нельзя отменить.
							</Typography>
						</Modal.Body>
						<Modal.Footer>
							<Button
								onClick={() => setIsModalOpen(false)}
								variant="tertiary"
							>
								Отмена
							</Button>
							<Button onClick={handleConfirm} variant="danger-light">
								Удалить
							</Button>
						</Modal.Footer>
					</Modal.Content>
				</Modal.Root>
			)}
		</>
	)
}

export default ClearCollectionButton
