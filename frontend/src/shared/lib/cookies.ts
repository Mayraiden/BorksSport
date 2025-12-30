/**
 * Утилиты для работы с cookies
 * 
 * ВАЖНО: Refresh token хранится в HTTP-only cookie, который устанавливается сервером.
 * HTTP-only cookie недоступен через JavaScript (защита от XSS).
 * Cookie автоматически отправляется браузером с каждым запросом на тот же домен.
 */

/**
 * Удаляет refresh token cookie
 * 
 * Примечание: HTTP-only cookie нельзя удалить через JavaScript напрямую.
 * Для полного удаления нужно, чтобы сервер установил cookie с max-age=0.
 * Эта функция удаляет cookie только если он НЕ HTTP-only (для совместимости).
 */
export function removeRefreshToken(): void {
	if (typeof document !== 'undefined') {
		// Пытаемся удалить cookie (работает только если cookie НЕ HTTP-only)
		document.cookie = 'refreshToken=; path=/; max-age=0; SameSite=Lax'
	}
}

