/**
 * Security Logger
 * Точки расширения для мониторинга (Sentry и т.п.) без вывода в консоль.
 */

export interface SecurityLogContext {
	ip?: string
	userAgent?: string
	url?: string
	pathname?: string
	searchParams?: string
	method?: string
	[key: string]: unknown
}

export const securityLogger = {
	logSuspiciousActivity(type: string, details: SecurityLogContext) {
		void type
		void details
	},

	logAttackAttempt(attackType: string, request: Request | SecurityLogContext) {
		void attackType
		void request
	},

	logError(error: Error | unknown, context?: SecurityLogContext) {
		void error
		void context
	},
}
