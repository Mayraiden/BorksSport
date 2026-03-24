import { Header } from '@/widgets/Header/Header'
import { Hero } from '@/widgets/Hero/Hero'
import { Suggesting } from '@/widgets/Suggesting/Suggesting'
import { PopularSports } from '@/widgets/PopularSports/PopularSports'
import { PopularBrands } from '@/widgets/PopularBrands/PopularBrands'
import { Footer } from '@/widgets/Footer/Footer'
import { homeApi } from '@/features/Home/api/homeApi'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

const getMediaUrl = (url?: string): string | null => {
	if (!url) return null
	if (url.startsWith('http://') || url.startsWith('https://')) return url
	return `${API_URL}${url}`
}

export default async function Home() {
	const settings = await homeApi.getHomepageSettings()
	const heroImageUrl = getMediaUrl(settings.heroImage?.url)

	return (
		<main className="w-screen overflow-x-hidden">
			<Header />
			<Hero title={settings.heroTitle} imageUrl={heroImageUrl} />
			<PopularSports />
			{settings.showHits && <Suggesting title="Хиты продаж" />}
			{settings.showNew && <Suggesting title="Новинки" />}
			{settings.showDiscounts && <Suggesting title="Товары по скидке" />}
			<PopularBrands />
			<Footer />
		</main>
	)
}
