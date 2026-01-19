import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'
import { Checkout } from '@/widgets/Checkout/Checkout'

export default function CheckoutPage() {
	return (
		<>
			<Header />
			<main className="min-h-screen bg-[#F0F4F8]">
				<div className="max-w-7xl mx-auto px-10 max-sm:px-2 py-5 max-sm:py-4">
					{/* Хлебные крошки */}
					<Breadcrumbs
						items={[
							{ label: 'Главная', href: '/' },
							{ label: 'Оформление заказа' },
						]}
						className="mb-5 max-sm:mb-3"
					/>

					{/* Основной контент */}
					<Checkout />
				</div>
			</main>
			<Footer />
		</>
	)
}

