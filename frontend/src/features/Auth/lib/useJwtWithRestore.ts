'use client'

import { useAuthStore } from '../model/store'

/**
 * Хук для получения JWT токена
 * 
 * @returns { jwt: string | null }
 */
export const useJwtWithRestore = () => {
	const { jwt } = useAuthStore()

	return { jwt }
}
