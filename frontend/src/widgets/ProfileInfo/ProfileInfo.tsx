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
import { useGetMe, useUpdateProfile, useDeleteAccount } from '@/features/Auth/lib/queries'
import {
	profileSchema,
	ProfileFormData,
} from '@/shared/lib/validations/profile'
import { DeleteAccountModal } from '@/shared/ui/DeleteAccountModal'
import { ProfileDropdown } from '@/shared/ui/ProfileDropdown'

export const ProfileInfo = () => {
	const [isEditMode, setIsEditMode] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

	// Получаем данные из store
	const { user, logout } = useAuthStore()
	const router = useRouter()

	// Загружаем актуальные данные пользователя
	const { isLoading: isLoadingUser } = useGetMe()

	// Мутация для обновления профиля
	const updateProfileMutation = useUpdateProfile()

	// Мутация для удаления аккаунта
	const deleteAccountMutation = useDeleteAccount()

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
		setIsDeleteModalOpen(true)
	}

	const handleConfirmDelete = async () => {
		try {
			await deleteAccountMutation.mutateAsync()
			// После успешного удаления происходит logout и очистка через onSuccess в useDeleteAccount
			router.push('/')
		} catch (error) {
			console.error('Ошибка при удалении аккаунта:', error)
			// Модальное окно останется открытым, можно показать ошибку
		}
	}

	const handleCloseDeleteModal = () => {
		if (!deleteAccountMutation.isPending) {
			setIsDeleteModalOpen(false)
		}
	}

	return (
		<div className="w-full">
			{/* Заголовок страницы */}
			<div className="mb-5 flex items-center justify-between">
				<h1 className="text-3xl font-bold text-black max-sm:text-2xl">
					Профиль
				</h1>
				<ProfileDropdown />
			</div>

			{/* Форма с данными пользователя */}
			<div className="w-full bg-white rounded-md p-10 max-sm:p-4">
				<div className="max-w-4xl">
					{/* Сообщение об успешном сохранении */}
					{saveSuccess && (
						<div className="mb-5 max-sm:mb-3 p-3 max-sm:p-2 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2 text-sm max-sm:text-xs">
							<svg className="w-5 h-5 max-sm:w-4 max-sm:h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
						<div className="mb-5 max-sm:mb-3 p-3 max-sm:p-2 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm max-sm:text-xs">
							{updateProfileMutation.error instanceof Error
								? updateProfileMutation.error.message
								: 'Произошла ошибка при обновлении профиля'}
						</div>
					)}

					{/* Поля ввода */}
					<div className="max-w-[460px] space-y-3 max-sm:space-y-2 mb-5 max-sm:mb-4">
						{/* Имя */}
						<div className="relative h-13 max-sm:h-12 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs max-sm:text-[10px] text-[#A0A4A8] font-normal">
								Имя
							</label>
							<input
								{...register('name')}
								type="text"
								disabled={!isEditMode}
								className="absolute top-6 max-sm:top-5 left-3 right-3 bg-transparent text-base max-sm:text-sm text-black outline-none disabled:cursor-not-allowed"
								placeholder="Введите ваше имя"
							/>
							{errors.name && (
								<p className="text-red-500 text-xs mt-1">
									{errors.name.message}
								</p>
							)}
						</div>

						{/* Телефон */}
						<div className="relative h-13 max-sm:h-12 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs max-sm:text-[10px] text-[#A0A4A8] font-normal">
								Телефон
							</label>
							<input
								{...register('phone')}
								type="tel"
								disabled={!isEditMode}
								className="absolute top-6 max-sm:top-5 left-3 right-3 bg-transparent text-base max-sm:text-sm text-black outline-none disabled:cursor-not-allowed"
								placeholder="+7 (999) 000-00-00"
							/>
							{errors.phone && (
								<p className="text-red-500 text-xs mt-1">
									{errors.phone.message}
								</p>
							)}
						</div>

						{/* Email */}
						<div className="relative h-13 max-sm:h-12 bg-[#F0F4F8] rounded-md">
							<label className="absolute top-2 left-3 text-xs max-sm:text-[10px] text-[#A0A4A8] font-normal">
								Email
							</label>
							<input
								{...register('email')}
								type="email"
								disabled={true}
								className="absolute top-6 max-sm:top-5 left-3 right-3 bg-transparent text-base max-sm:text-sm text-black outline-none disabled:cursor-not-allowed"
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
					<div className="flex flex-col max-sm:flex-col gap-4 max-sm:gap-3 md:flex-row md:justify-between md:items-end">
						{/* Кнопка Редактировать/Сохранить/Отмена */}
						<div className="flex flex-col max-sm:flex-col gap-3 md:flex-row">
							<button
								type="button"
								onClick={handleEditToggle}
								disabled={isSubmitting || isLoadingUser}
								className={`w-full max-sm:w-full md:w-40 h-12 px-6 py-4 flex items-center justify-center gap-2 rounded-md transition-colors duration-200 ${
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
									className="w-full max-sm:w-full md:w-32 h-12 px-6 py-4 flex items-center justify-center gap-2 bg-[#F0F4F8] text-black rounded-md hover:bg-[#e8edf2] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Отмена
								</button>
							)}
						</div>

						{/* Кнопки Выйти и Удалить */}
						<div className="flex flex-col max-sm:flex-col gap-3 md:flex-row md:items-center md:gap-5">
							<button
								type="button"
								onClick={handleLogout}
								className="w-full max-sm:w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#F0F4F8] text-black rounded-md hover:bg-[#e8edf2] transition-colors duration-200"
							>
								<SignOutIcon size={16} />
								Выйти из аккаунта
							</button>

							<button
								type="button"
								onClick={handleDeleteAccount}
								className="w-full max-sm:w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[#7B1931] text-white rounded-md hover:bg-[#6a1529] transition-colors duration-200"
							>
								<TrashIcon size={16} />
								Удалить аккаунт
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Модальное окно удаления аккаунта */}
			<DeleteAccountModal
				isOpen={isDeleteModalOpen}
				onClose={handleCloseDeleteModal}
				onConfirm={handleConfirmDelete}
				isLoading={deleteAccountMutation.isPending}
			/>
		</div>
	)
}
