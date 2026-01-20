'use client'

/**
 * Компонент для восстановления сессии (пустой, так как JWT сохраняется в localStorage)
 * При перезагрузке страницы JWT восстанавливается из localStorage автоматически через Zustand persist
 */
export const AuthSessionRestorer = () => {
	// Этот компонент ничего не рендерит
	// JWT восстанавливается автоматически через Zustand persist
	return null
}
