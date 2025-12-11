'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthModalContextType {
	isOpen: boolean
	openModal: () => void
	closeModal: () => void
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
	undefined
)

export const useAuthModal = () => {
	const context = useContext(AuthModalContext)
	if (!context) {
		throw new Error('useAuthModal must be used within AuthModalProvider')
	}
	return context
}

interface AuthModalProviderProps {
	children: ReactNode
}

export const AuthModalProvider = ({ children }: AuthModalProviderProps) => {
	const [isOpen, setIsOpen] = useState(false)

	const openModal = () => setIsOpen(true)
	const closeModal = () => setIsOpen(false)

	return (
		<AuthModalContext.Provider value={{ isOpen, openModal, closeModal }}>
			{children}
		</AuthModalContext.Provider>
	)
}
