import { Footer } from '@/widgets/Footer/Footer'
import { Header } from '@/widgets/Header/Header'
import { CookiesWidget } from '@/widgets/Cookies/CookiesWidget'

export default function CookiesPage() {
	return (
		<div className="flex flex-col">
			<Header />
			<CookiesWidget />
			<Footer />
		</div>
	)
}

