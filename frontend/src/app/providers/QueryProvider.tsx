'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthSessionRestorer } from '@/features/Auth/ui/AuthSessionRestorer'

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute
						retry: 1,
					},
				},
			})
	)

	return (
		<QueryClientProvider client={queryClient}>
			<AuthSessionRestorer />
			{children}
		</QueryClientProvider>
	)
}
