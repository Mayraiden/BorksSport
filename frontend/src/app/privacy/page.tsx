import { Footer } from '@/widgets/Footer/Footer'
import { Header } from '@/widgets/Header/Header'
import { PrivacyWidget } from '@/widgets/Privacy/PrivacyWidget'

export default function PrivacyPage() {
	return (
		<div className="flex flex-col">
			<Header />
			<PrivacyWidget />
			<Footer />
		</div>
	)
}

