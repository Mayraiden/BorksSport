/**
 * Security Logger
 * Логирование подозрительной активности и попыток атак
 */

interface SecurityLogContext {
	ip?: string
	userAgent?: string
	url?: string
	pathname?: string
	searchParams?: string
	method?: string
	[key: string]: unknown
}

export const securityLogger = {
	/**
	 * Логирует подозрительную активность
	 */
	logSuspiciousActivity(type: string, details: SecurityLogContext) {
		const logEntry = {
			timestamp: new Date().toISOString(),
			type: 'SUSPICIOUS_ACTIVITY',
			activityType: type,
			...details,
		}

		console.warn(`[SECURITY] ${type}:`, logEntry)

		// Здесь можно добавить отправку в систему мониторинга
		// Например, Sentry, DataDog, или ваш собственный сервис
		// if (typeof window !== 'undefined' && window.Sentry) {
		//   window.Sentry.captureMessage(`Security: ${type}`, {
		//     level: 'warning',
		//     extra: logEntry,
		//   })
		// }
	},

	/**
	 * Логирует попытки атак
	 */
	logAttackAttempt(attackType: string, request: Request | SecurityLogContext) {
		const context: SecurityLogContext =
			request instanceof Request
				? {
						url: request.url,
						method: request.method,
						headers: Object.fromEntries(request.headers.entries()),
					}
				: request

		const logEntry = {
			timestamp: new Date().toISOString(),
			type: 'ATTACK_ATTEMPT',
			attackType,
			...context,
		}

		console.error(`[SECURITY] Attack attempt: ${attackType}`, logEntry)

		// Здесь можно добавить отправку в систему мониторинга
		// if (typeof window !== 'undefined' && window.Sentry) {
		//   window.Sentry.captureMessage(`Security: Attack attempt - ${attackType}`, {
		//     level: 'error',
		//     extra: logEntry,
		//   })
		// }
	},

	/**
	 * Логирует ошибки безопасности
	 */
	logError(error: Error | unknown, context?: SecurityLogContext) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const errorStack = error instanceof Error ? error.stack : undefined

		const logEntry = {
			timestamp: new Date().toISOString(),
			type: 'SECURITY_ERROR',
			error: errorMessage,
			stack: errorStack,
			...context,
		}

		console.error('[SECURITY] Error:', logEntry)

		// Здесь можно добавить отправку в систему мониторинга
		// if (typeof window !== 'undefined' && window.Sentry) {
		//   window.Sentry.captureException(error, {
		//     level: 'error',
		//     extra: context,
		//   })
		// }
	},
}
