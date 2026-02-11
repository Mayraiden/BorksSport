'use client'

import React from 'react'

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

interface ErrorBoundaryProps {
	children: React.ReactNode
	fallback?: React.ComponentType<{ error: Error | null; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		// Обновляем состояние, чтобы следующий рендер показал fallback UI
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Логируем ошибку, но не падаем
		console.error('[ErrorBoundary] Caught error:', error, errorInfo)

		// Можно отправить в систему мониторинга (Sentry и т.д.)
		// Но не падаем - просто логируем
		// if (typeof window !== 'undefined' && window.Sentry) {
		//   window.Sentry.captureException(error, {
		//     contexts: {
		//       react: {
		//         componentStack: errorInfo.componentStack,
		//       },
		//     },
		//   })
		// }
	}

	resetError = () => {
		this.setState({ hasError: false, error: null })
	}

	render() {
		if (this.state.hasError) {
			// Если есть кастомный fallback, используем его
			if (this.props.fallback) {
				const Fallback = this.props.fallback
				return <Fallback error={this.state.error} resetError={this.resetError} />
			}

			// Дефолтный fallback
			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50">
					<div className="text-center p-8 max-w-md">
						<h1 className="text-2xl font-bold text-gray-900 mb-4">
							Что-то пошло не так
						</h1>
						<p className="text-gray-600 mb-6">
							Произошла ошибка, но приложение продолжает работать. Попробуйте обновить
							страницу или вернуться на главную.
						</p>
						<div className="flex gap-4 justify-center">
							<button
								onClick={this.resetError}
								className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
							>
								Попробовать снова
							</button>
							<button
								onClick={() => {
									if (typeof window !== 'undefined') {
										window.location.href = '/'
									}
								}}
								className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
							>
								На главную
							</button>
						</div>
						{process.env.NODE_ENV === 'development' && this.state.error && (
							<details className="mt-6 text-left">
								<summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
									Детали ошибки (только в dev режиме)
								</summary>
								<pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto max-h-64">
									{this.state.error.toString()}
									{'\n\n'}
									{this.state.error.stack}
								</pre>
							</details>
						)}
					</div>
				</div>
			)
		}

		return this.props.children
	}
}
