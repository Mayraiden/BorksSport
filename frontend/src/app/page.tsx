import { Header } from '@/widgets/Header/Header'
import { Hero } from '@/widgets/Hero/Hero'
import { Suggesting } from '@/widgets/Suggesting/Suggesting'
import { PopularSports } from '@/widgets/PopularSports/PopularSports'
import { PopularBrands } from '@/widgets/PopularBrands/PopularBrands'
import { Footer } from '@/widgets/Footer/Footer'

export default function Home() {
	return (
		<main className="w-screen overflow-x-hidden">
			<Header />
			<Hero />
			<PopularSports />
			<Suggesting title="Хиты продаж" />
			<Suggesting title="Новинки" />
			<Suggesting title="Товары по скидке" />
			<PopularBrands />
			<Footer />
		</main>
	)
}
