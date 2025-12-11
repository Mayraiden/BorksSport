import Link from 'next/link'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'

export default function ProductNotFound() {
	return (
		<main className="min-h-screen bg-white">
			<Header />
			<div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
				<div className="text-center">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">
						Товар не найден
					</h1>
					<p className="text-gray-600 mb-8">
						К сожалению, товар с указанным ID не существует или был удален.
					</p>
					<Link
						href="/catalog"
						className="inline-block bg-burgundy text-white px-6 py-3 rounded-lg hover:bg-burgundy/90 transition-colors duration-200 font-medium"
					>
						Вернуться в каталог
					</Link>
				</div>
			</div>
			<Footer />
		</main>
	)
}
