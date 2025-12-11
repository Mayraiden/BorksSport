'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	TrashIcon,
	SignOutIcon,
	NotePencilIcon,
} from '@phosphor-icons/react/ssr'
import { useAuthStore } from '@/features/Auth/model/store'
import { useGetMe, useUpdateProfile } from '@/features/Auth/lib/queries'
import {
	profileSchema,
	ProfileFormData,
} from '@/shared/lib/validations/profile'

export const ProfileInfo = () => {
	const [isEditMode, setIsEditMode] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)

	// Получаем данные из store
	const { user, logout } = useAuthStore()
	const router = useRouter()

	// Загружаем актуальные данные пользователя
	const { isLoading: isLoadingUser } = useGetMe()

	// Мутация для обновления профиля
	const updateProfileMutation = useUpdateProfile()

	// Настройка react-hook-form с Zod валидацией
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<ProfileFormData>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			name: '',
			phone: '',
			email: '',
		},
	})

	// Загружаем данные пользователя при монтировании компонента и после обновления
	useEffect(() => {
		if (user) {
			reset({
				name: user.firstName || '',
				phone: user.phone || '',
				email: user.email || '',
			})
		}
	}, [user, reset])

	// Обработка сохранения формы
	const onSubmit = async (data: ProfileFormData) => {
		try {
			const updatedUser = await updateProfileMutation.mutateAsync(data)
			// Обновляем форму с новыми данными сразу после сохранения
			reset({
				name: updatedUser.firstName || '',
				phone: updatedUser.phone || '',
				email: updatedUser.email || '',
			})
			setIsEditMode(false)
			setSaveSuccess(true)
			// Скрываем сообщение об успехе через 5 секунд
			setTimeout(() => setSaveSuccess(false), 5000)
		} catch (error) {
			console.error('Ошибка при обновлении профиля:', error)
			setSaveSuccess(false)
		}
	}

	// Переключение режима редактирования
	const handleEditToggle = () => {
		if (isEditMode) {
			// Сохранение данных через react-hook-form
			handleSubmit(onSubmit)()
		} else {
			// При входе в режим редактирования обновляем форму актуальными данными
			if (user) {
				reset({
					name: user.firstName || '',
					phone: user.phone || '',
					email: user.email || '',
				})
			}
			setIsEditMode(true)
		}
	}

	// Отмена редактирования (возврат к исходным значениям)
	const handleCancel = () => {
		if (user) {
			reset({
				name: user.firstName || '',
				phone: user.phone || '',
				email: user.email || '',
			})
		}
		setIsEditMode(false)
		setSaveSuccess(false)
	}

	// Выход из аккаунта
	const handleLogout = () => {
		logout()
		router.push('/')
	}

	// Удаление аккаунта
	const handleDeleteAccount = () => {
		// TODO: Показать модальное окно подтверждения
		console.log('Delete account')
	}

	return (
		<div className="w-full">
			{/* Заголовок страницы */}
			<div className="mb-5">
				<h1 className="text-3xl font-bold text-black">Профиль</h1>
			</div>

			{/* Форма с данными пользователя */}
			<div className="w-full bg-white rounded-md p-10">
				<div className="max-w-4xl">
					{/* Сообщение об успешном сохранении */}
					{saveSuccess && (
						<div className="mb-5 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									fillRule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clipRule="evenodd"
								/>
							</svg>
							<span>Профиль успешно обновлен!</span>
						</div>
					)}

					{/* Сообщение об ошибке */}
					{updateProfileMutation.isError && (
						<div className="mb-5 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
							{updateProfileMutation.error instanceof Error
								? updateProfileMutation.error.message
								: 'Произошла ошибка при обновлении профиля'}
						</div>
					)}

					{/* Поля ввода */}
					<div className="max-w-[460px] space-y-3 mb-5">
						{/* Имя */}
						<div className="relative h-13 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs text-[#A0A4A8] font-normal">
								Имя
							</label>
							<input
								{...register('name')}
								type="text"
								disabled={!isEditMode}
								className="absolute top-6 left-3 right-3 bg-transparent text-base text-black outline-none disabled:cursor-not-allowed"
								placeholder="Введите ваше имя"
							/>
							{errors.name && (
								<p className="text-red-500 text-xs mt-1">
									{errors.name.message}
								</p>
							)}
						</div>

						{/* Телефон */}
						<div className="relative h-13 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs text-[#A0A4A8] font-normal">
								Телефон
							</label>
							<input
								{...register('phone')}
								type="tel"
								disabled={!isEditMode}
								className="absolute top-6 left-3 right-3 bg-transparent text-base text-black outline-none disabled:cursor-not-allowed"
								placeholder="+7 (999) 000-00-00"
							/>
							{errors.phone && (
								<p className="text-red-500 text-xs mt-1">
									{errors.phone.message}
								</p>
							)}
						</div>

						{/* Email */}
						<div className="relative h-13 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs text-[#A0A4A8] font-normal">
								Email
							</label>
							<input
								{...register('email')}
								type="email"
								disabled={true}
								className="absolute top-6 left-3 right-3 bg-transparent text-base text-black outline-none disabled:cursor-not-allowed"
								placeholder="ваш.email@example.com"
							/>
							{errors.email && (
								<p className="text-red-500 text-xs mt-1">
									{errors.email.message}
								</p>
							)}
						</div>
					</div>

					{/* Кнопки действий */}
					<div className="flex justify-between items-end">
						{/* Кнопка Редактировать/Сохранить/Отмена */}
						<div className="flex gap-3">
							<button
								type="button"
								onClick={handleEditToggle}
								disabled={isSubmitting || isLoadingUser}
								className={`w-40 h-12 px-6 py-4 flex items-center justify-center gap-2  rounded-md transition-colors duration-200 ${
									isEditMode
										? 'bg-[#2A7D5A] text-white hover:bg-[#1f5f47] disabled:opacity-50 disabled:cursor-not-allowed'
										: 'bg-[#193B7B] text-white hover:bg-[#1a4a8f] disabled:opacity-50 disabled:cursor-not-allowed'
								}`}
							>
								<NotePencilIcon size={20} className="shrink-0" />
								{isSubmitting
									? 'Сохранение...'
									: isEditMode
										? 'Сохранить'
										: 'Редактировать'}
							</button>
							{isEditMode && (
								<button
									type="button"
									onClick={handleCancel}
									disabled={isSubmitting}
									className="w-32 h-12 px-6 py-4 flex items-center justify-center gap-2 bg-[#F0F4F8] text-black rounded-md hover:bg-[#e8edf2] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Отмена
								</button>
							)}
						</div>

						{/* Кнопки Выйти и Удалить */}
						<div className="flex items-center gap-5">
							<button
								type="button"
								onClick={handleLogout}
								className="flex items-center gap-2 px-4 py-2 bg-[#F0F4F8] text-black rounded-md hover:bg-[#e8edf2] transition-colors duration-200"
							>
								<SignOutIcon size={16} />
								Выйти из аккаунта
							</button>

							<button
								type="button"
								onClick={handleDeleteAccount}
								className="flex items-center gap-2 px-4 py-2 bg-[#7B1931] text-white rounded-md hover:bg-[#6a1529] transition-colors duration-200"
							>
								<TrashIcon size={16} />
								Удалить аккаунт
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
