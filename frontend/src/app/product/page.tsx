// Эта страница больше не используется, так как теперь используется динамический роут /product/[id]
// Можно удалить этот файл или оставить как fallback
import { redirect } from 'next/navigation'

export default function Product() {
	redirect('/catalog')
}
