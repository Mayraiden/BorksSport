'use client'

import { useState } from 'react'
import { testMeilisearchQueries } from '@/shared/lib/utils/searchDebug'

type MeilisearchStatusProps = {
	className?: string
}

export const MeilisearchStatus = ({
	className = '',
}: MeilisearchStatusProps) => {
	const [status] = useState<{
		available: boolean
		loading: boolean
		error?: string
	}>({ available: false, loading: true })
	const [isTesting, setIsTesting] = useState(false)

	// Removed automatic status check to prevent unwanted API calls

	const handleTestMeilisearch = async () => {
		setIsTesting(true)
		try {
			await testMeilisearchQueries()
		} finally {
			setIsTesting(false)
		}
	}

	if (status.loading) {
		return (
			<div
				className={`bg-gray-50 border border-gray-200 rounded-lg p-3 ${className}`}
			>
				<div className="flex items-center gap-2">
					<div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
					<span className="text-sm text-gray-600">Проверка Meilisearch...</span>
				</div>
			</div>
		)
	}

	return (
		<div
			className={`border rounded-lg p-3 ${
				status.available
					? 'bg-green-50 border-green-200'
					: 'bg-red-50 border-red-200'
			} ${className}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div
						className={`w-2 h-2 rounded-full ${
							status.available ? 'bg-green-500' : 'bg-red-500'
						}`}
					></div>
					<span
						className={`text-sm font-medium ${
							status.available ? 'text-green-900' : 'text-red-900'
						}`}
					>
						Meilisearch: {status.available ? 'Доступен' : 'Недоступен'}
					</span>
				</div>
				<button
					onClick={handleTestMeilisearch}
					disabled={isTesting}
					className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{isTesting ? 'Тест...' : 'Тест'}
				</button>
			</div>
			{status.error && (
				<div className="mt-1 text-xs text-red-700">Ошибка: {status.error}</div>
			)}
		</div>
	)
}
