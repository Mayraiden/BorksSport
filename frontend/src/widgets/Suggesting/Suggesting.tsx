'use client'
import { useState, useEffect } from 'react'

import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import 'swiper/css/navigation'

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react/ssr'

import { ItemCard } from '@/shared/ui/ItemCard'
import { productApi } from '@/features/Product/api/productApi'
import type { Product } from '@/shared/types'

type ISuggestingProps = {
	title: string
}

export const Suggesting = ({ title }: ISuggestingProps) => {
	const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null)
	const [products, setProducts] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const goToPrev = () => swiperRef?.slidePrev()
	const goToNext = () => swiperRef?.slideNext()

	useEffect(() => {
		const loadProducts = async () => {
			try {
				setLoading(true)
				let fetchedProducts: Product[] = []

				if (title === 'Хиты продаж') {
					fetchedProducts = await productApi.getPopularProducts(15)
				} else if (title === 'Новинки') {
					fetchedProducts = await productApi.getNewProducts(15)
				} else {
					// Для других блоков можно добавить логику позже
					fetchedProducts = []
				}

				setProducts(fetchedProducts)
			} catch (error) {
				console.error(`Error loading products for "${title}":`, error)
				setProducts([])
			} finally {
				setLoading(false)
			}
		}

		loadProducts()
	}, [title])

	const isLoop = products.length > 5

	return (
		<section className="w-full pt-15 relative">
			<h3 className="pl-20 text-3xl font-bold mb-4">{title}</h3>
			<div className="w-full h-fit py-4">
				<Swiper
					key={products.length}
					onSwiper={setSwiperRef}
					spaceBetween={12}
					slidesPerView={5}
					loop={isLoop}
					centeredSlides={false}
					loopAdditionalSlides={2}
					watchSlidesProgress
					navigation
					style={{
						overflow: 'visible',
						paddingLeft: '80px',
						paddingRight: '80px',
					}}
					breakpoints={{
						640: { slidesPerView: 2 },
						768: { slidesPerView: 3 },
						1024: { slidesPerView: 4 },
						1280: { slidesPerView: 5 },
						1440: { slidesPerView: 5 },
					}}
				>
					{loading ? (
						// Показываем заглушки во время загрузки
						Array.from({ length: 5 }).map((_, index) => (
							<SwiperSlide key={`loading-${index}`} className="max-w-59">
								<ItemCard />
							</SwiperSlide>
						))
					) : products.length > 0 ? (
						products.map((product) => (
							<SwiperSlide key={product.id} className="max-w-59">
								<ItemCard product={product} />
							</SwiperSlide>
						))
					) : (
						// Если товаров нет, показываем заглушку
						<SwiperSlide className="max-w-59">
							<div className="w-full h-64 flex items-center justify-center text-gray-500">
								Товары не найдены
							</div>
						</SwiperSlide>
					)}
				</Swiper>
			</div>

			<button
				onClick={goToPrev}
				className="absolute right-30 top-20 -translate-y-1/2 bg-gray/20 text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-burgundy hover:text-white transition-colors duration-300"
			>
				<CaretLeftIcon size={30} />
			</button>
			<button
				onClick={goToNext}
				className="absolute right-15 top-20 -translate-y-1/2 bg-gray/20 text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-burgundy hover:text-white transition-colors duration-300"
			>
				<CaretRightIcon size={30} />
			</button>
		</section>
	)
}
