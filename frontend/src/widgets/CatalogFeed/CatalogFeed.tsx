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
		<section className="w-screen pt-5 px-15 pb-5 bg-light-blue">
			<Breadcrumbs items={breadcrumbItems} className="mb-4" />
			<div className="flex gap-4">
				<Filters />
				<CatalogContent />
			</div>
		</section>
	)
}
