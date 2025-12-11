'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react/ssr'
import type { ProductImage } from '../types'

type ProductSliderProps = {
	images: ProductImage[]
	className?: string
}

export const ProductSlider = ({
	images,
	className = '',
}: ProductSliderProps) => {
	const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null)

	const goToPrev = () => swiperRef?.slidePrev()
	const goToNext = () => swiperRef?.slideNext()

	if (!images.length) {
		return (
			<div
				className={`w-full h-120 bg-gray/20 rounded-[4px] overflow-hidden flex items-center justify-center ${className}`}
			>
				<span className="text-gray-500">Нет изображений</span>
			</div>
		)
	}

	// Для infinity scroll с одним изображением дублируем его минимум 3 раза
	const displayImages =
		images.length === 1
			? [...images, ...images, ...images]
			: images.length === 2
				? [...images, ...images]
				: images

	return (
		<div className={`relative ${className}`}>
			<Swiper
				modules={[Navigation]}
				spaceBetween={0}
				slidesPerView={1}
				loop={true}
				onSwiper={setSwiperRef}
				className="w-full h-120 rounded-[4px] overflow-hidden"
			>
				{displayImages.map((image, index) => (
					<SwiperSlide key={`${image.id}-${index}`}>
						<div className="w-full h-full relative">
							<Image
								src={image.url}
								alt={image.alt}
								fill
								className="object-contain"
								sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
								priority={index < 3}
							/>
						</div>
					</SwiperSlide>
				))}
			</Swiper>

			{/* Navigation arrows - всегда показываем для infinity scroll */}
			<button
				onClick={goToPrev}
				className="absolute left-6.5 top-1/2 -translate-y-1/2 bg-burgundy text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-[#7B1931]/90 transition-colors duration-200 z-10 shadow-lg"
				aria-label="Предыдущее изображение"
			>
				<CaretLeftIcon size={20} weight="bold" />
			</button>
			<button
				onClick={goToNext}
				className="absolute right-6.5 top-1/2 -translate-y-1/2 bg-burgundy text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-[#7B1931]/90 transition-colors duration-200 z-10 shadow-lg"
				aria-label="Следующее изображение"
			>
				<CaretRightIcon size={20} weight="bold" />
			</button>
		</div>
	)
}
