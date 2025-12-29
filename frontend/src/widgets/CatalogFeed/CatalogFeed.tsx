'use client'

import { Filters } from '../Filters/Filters'
import { CatalogContent } from '../CatalogContent/CatalogContent'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'

export const CatalogFeed = () => {
	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: 'Каталог' },
	]

	return (
		<section className="w-screen pt-5 px-15 pb-5 bg-light-blue max-sm:px-2 max-sm:pt-4 max-sm:pb-4">
			<Breadcrumbs items={breadcrumbItems} className="mb-4 max-sm:mb-2" />
			<div className="flex gap-4 max-sm:gap-0">
				<Filters />
				<CatalogContent />
			</div>
		</section>
	)
}
