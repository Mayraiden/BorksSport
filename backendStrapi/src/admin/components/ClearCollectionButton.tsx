import React, { useState } from 'react'
import { Button } from '@strapi/design-system'

const ClearCollectionButton: React.FC = () => {
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
		// Fallback на alert, если внутренняя нотификация недоступна
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
		if (!uid) {
			notify('warning', 'UID коллекции не найден')
			return
		}
		if (!window.confirm('Удалить все записи этой коллекции?')) return
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
			notify('success', `Удалено: ${data?.data?.deleted || 0}`)
			// Перезагрузить список
			// @ts-ignore
			if (window?.strapi?.reload) window.strapi.reload()
			else window.location.reload()
		} catch (e: any) {
			notify('danger', e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button variant="danger-light" onClick={handleClick} loading={loading}>
			Очистить коллекцию
		</Button>
	)
}

export default ClearCollectionButton





