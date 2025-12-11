import { Footer } from '@/widgets/Footer/Footer'
import { Header } from '@/widgets/Header/Header'
import { IOfertaWidget } from '@/widgets/Oferta/IOfertaWidget'

export default function FavoritesPage() {
	return (
		<div className="flex flex-col">
			<Header />
			<IOfertaWidget />
			<Footer />
		</div>
	)
}
