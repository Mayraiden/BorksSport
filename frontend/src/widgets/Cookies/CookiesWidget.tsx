import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/ssr'

export const CookiesWidget = () => {
	return (
		<section className="min-h-screen bg-light-blue flex flex-col items-center gap-5 py-5">
			{/* Breadcrumbs */}
			<div className="w-full max-w-[1040px] px-5 flex items-center gap-2">
				<Link href="/" className="text-[#A0A4A8] text-xs font-normal leading-[1.75em] hover:underline">
					Главная
				</Link>
				<CaretRight size={12} className="text-[#A0A4A8]" />
				<span className="text-[#121212] text-xs font-normal leading-[1.75em]">
					Политика использования cookies
				</span>
			</div>

			{/* Content Container */}
			<div className="w-full max-w-[1040px] px-5 flex flex-col gap-5">
				{/* Page Title */}
				<div className="w-full">
					<h1 className="text-[#121212] text-2xl font-bold leading-[0.875em]">
						Политика использования cookies
					</h1>
				</div>

				{/* Cookies Content */}
				<div className="w-full bg-white rounded-md p-5 flex flex-col gap-10">
					<div className="text-[#121212] text-base font-normal leading-[1.2em] whitespace-pre-line">
						<h2 className="font-bold mb-2">1. Что такое cookies?</h2>

						<p className="mb-4">
							Cookies (файлы cookie) — это небольшие текстовые файлы, которые веб-сайт сохраняет на устройстве пользователя (компьютере, планшете, смартфоне) при посещении сайта. Cookies позволяют сайту запоминать действия и предпочтения пользователя на определенный период времени.
						</p>

						<h2 className="font-bold mb-2 mt-6">2. Какие cookies мы используем?</h2>

						<p className="mb-4">
							<strong>2.1. Необходимые cookies</strong>
						</p>

						<p className="mb-4 ml-4">
							Эти cookies необходимы для работы сайта и не могут быть отключены. Они обычно устанавливаются в ответ на ваши действия, такие как вход в систему, заполнение форм или настройка параметров конфиденциальности.
						</p>

						<p className="mb-4">
							<strong>2.2. Функциональные cookies</strong>
						</p>

						<p className="mb-4 ml-4">
							Эти cookies позволяют сайту запоминать сделанный вами выбор (например, имя пользователя, язык или регион) и предоставлять улучшенные, более персонализированные функции.
						</p>

						<p className="mb-4">
							<strong>2.3. Аналитические cookies</strong>
						</p>

						<p className="mb-4 ml-4">
							Эти cookies помогают нам понять, как посетители взаимодействуют с нашим сайтом, собирая и сообщая информацию анонимно. Это позволяет нам улучшать работу сайта.
						</p>

						<p className="mb-4">
							<strong>2.4. Маркетинговые cookies</strong>
						</p>

						<p className="mb-4 ml-4">
							Эти cookies используются для отслеживания посетителей на разных сайтах. Цель — показывать релевантную рекламу для отдельных пользователей.
						</p>

						<h2 className="font-bold mb-2 mt-6">3. Цели использования cookies</h2>

						<p className="mb-4">
							Мы используем cookies для следующих целей:
						</p>

						<ul className="mb-4 ml-6 list-disc">
							<li className="mb-2">Обеспечение корректной работы сайта</li>
							<li className="mb-2">Запоминание ваших предпочтений и настроек</li>
							<li className="mb-2">Улучшение пользовательского опыта</li>
							<li className="mb-2">Анализ использования сайта для его улучшения</li>
							<li className="mb-2">Персонализация контента и рекламы</li>
							<li className="mb-2">Обеспечение безопасности</li>
						</ul>

						<h2 className="font-bold mb-2 mt-6">4. Управление cookies</h2>

						<p className="mb-4">
							<strong>4.1.</strong> Вы можете управлять cookies через настройки вашего браузера. Большинство браузеров позволяют:
						</p>

						<ul className="mb-4 ml-6 list-disc">
							<li className="mb-2">Просматривать cookies, хранящиеся на вашем устройстве</li>
							<li className="mb-2">Удалять все или отдельные cookies</li>
							<li className="mb-2">Блокировать cookies от определенных сайтов</li>
							<li className="mb-2">Блокировать все cookies</li>
							<li className="mb-2">Удалять все cookies при закрытии браузера</li>
						</ul>

						<p className="mb-4">
							<strong>4.2.</strong> Обратите внимание, что отключение cookies может повлиять на функциональность сайта и ограничить доступ к некоторым его функциям.
						</p>

						<p className="mb-4">
							<strong>4.3.</strong> Инструкции по управлению cookies в популярных браузерах:
						</p>

						<ul className="mb-4 ml-6 list-disc">
							<li className="mb-2">
								<strong>Google Chrome:</strong> Настройки → Конфиденциальность и безопасность → Файлы cookie и другие данные сайтов
							</li>
							<li className="mb-2">
								<strong>Mozilla Firefox:</strong> Настройки → Приватность и защита → Файлы cookie и данные сайтов
							</li>
							<li className="mb-2">
								<strong>Safari:</strong> Настройки → Конфиденциальность → Управлять данными веб-сайтов
							</li>
							<li className="mb-2">
								<strong>Microsoft Edge:</strong> Настройки → Файлы cookie и разрешения сайтов → Файлы cookie и данные сайтов
							</li>
						</ul>

						<h2 className="font-bold mb-2 mt-6">5. Cookies третьих сторон</h2>

						<p className="mb-4">
							<strong>5.1.</strong> На нашем сайте могут использоваться cookies третьих сторон, например:
						</p>

						<ul className="mb-4 ml-6 list-disc">
							<li className="mb-2">Аналитические сервисы (Google Analytics и др.)</li>
							<li className="mb-2">Сервисы рекламы</li>
							<li className="mb-2">Социальные сети</li>
							<li className="mb-2">Платежные системы</li>
						</ul>

						<p className="mb-4">
							<strong>5.2.</strong> Эти cookies регулируются политиками конфиденциальности соответствующих третьих сторон. Мы не контролируем и не несем ответственности за использование cookies третьими сторонами.
						</p>

						<h2 className="font-bold mb-2 mt-6">6. Согласие на использование cookies</h2>

						<p className="mb-4">
							<strong>6.1.</strong> При первом посещении нашего сайта мы запрашиваем ваше согласие на использование cookies через баннер уведомления.
						</p>

						<p className="mb-4">
							<strong>6.2.</strong> Продолжая использовать сайт после появления баннера, вы соглашаетесь с использованием cookies в соответствии с настоящей Политикой.
						</p>

						<p className="mb-4">
							<strong>6.3.</strong> Вы можете отозвать свое согласие в любое время, изменив настройки cookies в вашем браузере или связавшись с нами.
						</p>

						<h2 className="font-bold mb-2 mt-6">7. Изменения в Политике использования cookies</h2>

						<p className="mb-4">
							<strong>7.1.</strong> Мы можем периодически обновлять настоящую Политику использования cookies. О любых существенных изменениях мы уведомим вас через баннер на сайте или другим способом.
						</p>

						<p className="mb-4">
							<strong>7.2.</strong> Рекомендуем периодически просматривать эту страницу, чтобы быть в курсе того, как мы используем cookies.
						</p>

						<h2 className="font-bold mb-2 mt-6">8. Контактная информация</h2>

						<p className="mb-4">
							Если у вас есть вопросы относительно использования cookies, вы можете связаться с нами:
						</p>

						<p className="mb-4">
							ООО &quot;РУСПРОЕКТ&quot;<br />
							ОГРН: 1167746088586<br />
							ИНН: 9715238760<br />
							Адрес: 123007, г. Москва, вн.тер.г. муниципальный округ Хорошевский, проезд 2-й Хорошёвский, д. 7, стр. 16, ком 2<br />
							Телефон: +7 (977) 697-21-77<br />
							Электронная почта: mblmos@yandex.ru
						</p>

						<p className="mb-4 text-sm text-gray-600">
							Дата последнего обновления: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}

