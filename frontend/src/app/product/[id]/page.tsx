import { notFound } from 'next/navigation'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { ProductPage } from '@/widgets/ProductPage/ProductPage'
import { productApi } from '@/features/Product/api/productApi'

type ProductPageProps = {
	params: Promise<{ id: string }>
}

// Генерируем метаданные для SEO
export async function generateMetadata({ params }: ProductPageProps) {
	const { id } = await params

	try {
		const product = await productApi.getProduct(id)
		return {
			title: `${product.name} | ПРОФСПОРТ`,
			description:
				product.description ||
				`Купить ${product.name} в интернет-магазине ПРОФСПОРТ`,
		}
	} catch {
		return {
			title: 'Товар не найден | ПРОФСПОРТ',
		}
	}
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
	const { id } = await params

	try {
		const product = await productApi.getProduct(id)

		// Если товар не найден или не опубликован
		if (!product) {
			notFound()
		}

		return (
			<main className="min-h-screen bg-[#F0F4F8]">
				<Header />
				<ProductPage product={product} />
				<Footer />
			</main>
		)
	} catch (error) {
		console.error('Error loading product:', error)
		notFound()
	}
}
