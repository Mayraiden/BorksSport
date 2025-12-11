'use client'

import { useAuthModal } from '@/shared/lib/contexts/AuthModalContext'
import { AuthModal } from './AuthModal'

export const AuthModalWrapper = () => {
	const { isOpen, closeModal } = useAuthModal()

	return <AuthModal isOpen={isOpen} onClose={closeModal} />
}
