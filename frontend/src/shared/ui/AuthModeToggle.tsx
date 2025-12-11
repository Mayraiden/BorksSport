'use client'

import { AuthMode } from '@/shared/types'

interface AuthModeToggleProps {
	currentMode: AuthMode
	onModeChange: (mode: AuthMode) => void
}

export const AuthModeToggle = ({
	currentMode,
	onModeChange,
}: AuthModeToggleProps) => {
	return (
		<div className="flex bg-gray/20 rounded-md p-1">
			<button
				type="button"
				onClick={() => onModeChange('login')}
				className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
					currentMode === 'login'
						? 'bg-white text-black shadow-sm'
						: 'text-gray-600 hover:text-black'
				}`}
			>
				Вход
			</button>
			<button
				type="button"
				onClick={() => onModeChange('register')}
				className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
					currentMode === 'register'
						? 'bg-white text-black shadow-sm'
						: 'text-gray-600 hover:text-black'
				}`}
			>
				Регистрация
			</button>
		</div>
	)
}
