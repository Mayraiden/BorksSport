// Утилиты для обработки ошибок аутентификации

export interface StrapiError {
	status: number
	name: string
	message: string
	details: Record<string, unknown>
}

export interface StrapiResponse {
	data: unknown
	error?: StrapiError
}

// Функция для получения понятного сообщения об ошибке
export const getAuthErrorMessage = (error: unknown): string => {
	// Если это ошибка от Strapi
	if (
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		typeof (error as { error: unknown }).error === 'object' &&
		(error as { error: unknown }).error !== null
	) {
		const strapiError = (error as { error: StrapiError }).error

		// Ошибки валидации
		if (strapiError.name === 'ValidationError') {
			return 'Проверьте правильность заполнения полей'
		}

		// Ошибки аутентификации
		if (strapiError.status === 400) {
			if (strapiError.message.includes('Invalid identifier or password')) {
				return 'Неправильный логин или пароль'
			}
			if (strapiError.message.includes('Email already taken')) {
				return 'Пользователь с таким email уже существует'
			}
			if (strapiError.message.includes('Username already taken')) {
				return 'Пользователь с таким именем уже существует'
			}
			return 'Проверьте правильность заполнения полей'
		}

		// Ошибки сервера
		if (strapiError.status >= 500) {
			return 'Ошибка сервера. Попробуйте позже'
		}

		// Общая ошибка
		return strapiError.message || 'Произошла ошибка'
	}

	// Если это сетевая ошибка или обычная Error
	if (error instanceof Error) {
		if (error.message.includes('fetch')) {
			return 'Ошибка соединения. Проверьте подключение к интернету'
		}
		// Обрабатываем английские сообщения об ошибках
		if (error.message.includes('Invalid identifier or password')) {
			return 'Неправильный логин или пароль'
		}
		if (error.message.includes('Email already taken')) {
			return 'Пользователь с таким email уже существует'
		}
		if (error.message.includes('Username already taken')) {
			return 'Пользователь с таким именем уже существует'
		}
		return error.message
	}

	// Общая ошибка
	return 'Произошла неизвестная ошибка'
}

// Функция для проверки, является ли ответ ошибкой
export const isStrapiError = (response: unknown): response is StrapiResponse => {
	return (
		typeof response === 'object' &&
		response !== null &&
		'error' in response &&
		!(response as { user?: unknown }).user
	)
}
