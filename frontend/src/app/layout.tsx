import type { Metadata } from 'next'
import '../styles/globals.css'
import { QueryProvider } from './providers/QueryProvider'
import { AuthModalProvider } from '@/shared/lib/contexts/AuthModalContext'
import { SearchProvider } from '@/shared/lib/contexts/SearchContext'
import { AuthModalWrapper } from '@/shared/ui/AuthModalWrapper'
import { CookieBanner } from '@/shared/ui/CookieBanner'
import { MobileBottomNav } from '@/shared/ui/MobileBottomNav'

export const metadata: Metadata = {
	title: 'BorksSport',
	description: 'твой спорт',
	icons: {
		icon: '/miniLogo.png',
		apple: '/miniLogo.png',
	},
	viewport: {
		width: 'device-width',
		initialScale: 1,
		maximumScale: 5,
		viewportFit: 'cover',
	},
	other: {
		'viewport-fit': 'cover',
	},
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<body>
				<QueryProvider>
					<AuthModalProvider>
						<SearchProvider>
							{children}
							<AuthModalWrapper />
							<CookieBanner />
							<MobileBottomNav />
						</SearchProvider>
					</AuthModalProvider>
				</QueryProvider>
			</body>
		</html>
	)
}
