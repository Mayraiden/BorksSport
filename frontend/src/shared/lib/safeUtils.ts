/**
 * Safe Utilities
 * Безопасные функции для работы с данными, предотвращающие падения приложения
 */

/**
 * Type guard для проверки, является ли объект итерируемым
 */
function isIterable<T>(obj: unknown): obj is Iterable<T> {
	return (
		obj !== null &&
		obj !== undefined &&
		typeof (obj as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
	)
}

/**
 * Безопасное создание массива из итерируемого объекта
 * Предотвращает ошибку "object is not iterable"
 */
export function safeArrayFrom<T>(
	iterable: Iterable<T> | null | undefined | ArrayLike<T>
): T[] {
	if (!iterable) {
		return []
	}

	try {
		// Если это уже массив, возвращаем его
		if (Array.isArray(iterable)) {
			return iterable
		}

		// Проверяем, является ли объект итерируемым
		if (isIterable<T>(iterable)) {
			return Array.from(iterable)
		}

		// Проверяем, является ли объект массивоподобным (ArrayLike)
		if ('length' in iterable && typeof iterable.length === 'number') {
			return Array.from(iterable as ArrayLike<T>)
		}

		return []
	} catch {
		return []
	}
}

/**
 * Безопасное создание Map из итерируемого объекта
 * Предотвращает ошибку "object is not iterable"
 */
export function safeMapFrom<K, V>(
	entries?: Iterable<[K, V]> | null | undefined
): Map<K, V> {
	if (!entries) {
		return new Map()
	}

	try {
		// Если это уже Map, возвращаем его
		if (entries instanceof Map) {
			return entries
		}

		// Проверяем, является ли объект итерируемым
		if (isIterable<[K, V]>(entries)) {
			return new Map(entries)
		}

		return new Map()
	} catch {
		return new Map()
	}
}

/**
 * Безопасный парсинг JSON
 * Предотвращает падение приложения при невалидном JSON
 */
export function safeParseJSON<T = unknown>(json: string, fallback: T | null = null): T | null {
	if (!json || typeof json !== 'string') {
		return fallback
	}

	try {
		return JSON.parse(json) as T
	} catch {
		return fallback
	}
}

/**
 * Безопасное создание Set из итерируемого объекта
 */
export function safeSetFrom<T>(iterable: Iterable<T> | null | undefined): Set<T> {
	if (!iterable) {
		return new Set()
	}

	try {
		if (iterable instanceof Set) {
			return iterable
		}

		if (isIterable<T>(iterable)) {
			return new Set(iterable)
		}

		return new Set()
	} catch {
		return new Set()
	}
}
