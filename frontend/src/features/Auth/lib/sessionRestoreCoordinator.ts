/**
 * Координатор для восстановления сессии
 * 
 * Теперь использует sessionManager для управления состоянием восстановления.
 * Этот файл оставлен для обратной совместимости, но рекомендуется
 * использовать sessionManager напрямую.
 */

import { sessionManager } from './sessionManager'

/**
 * Проверяет, идет ли восстановление сессии
 * @deprecated Используйте sessionManager.isRestoring() напрямую
 */
export const getGlobalRestoreInProgress = (): boolean => {
	return sessionManager.isRestoring()
}

/**
 * Устанавливает состояние восстановления
 * @deprecated Используйте sessionManager напрямую
 */
export const setGlobalRestoreInProgress = (): void => {
	// Состояние теперь управляется через sessionManager и store
	// Эта функция оставлена для обратной совместимости, но не делает ничего
	// так как sessionManager управляет состоянием автоматически
}
