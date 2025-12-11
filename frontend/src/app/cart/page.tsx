import { ProfileLayout } from '@/app/layouts/ProfileLayout'
import { Cart } from '@/widgets/Cart/Cart'

export default function CartPage() {
	return (
		<ProfileLayout>
			<div className="flex flex-col gap-5 pt-2.5">
				{/* Корзина */}
				<Cart />
			</div>
		</ProfileLayout>
	)
}
