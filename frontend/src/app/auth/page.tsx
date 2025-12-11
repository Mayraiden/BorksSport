import { Suspense } from 'react'
import { Auth } from '@/widgets/Auth/Auth'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'

export default function AuthPage() {
	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<Header />
			<div className="flex-1 py-5 px-20">
				<Suspense fallback={<div>Загрузка...</div>}>
					<Auth />
				</Suspense>
			</div>
			<Footer />
		</section>
	)
}
