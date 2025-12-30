'use client'

import { useState, useEffect, useCallback } from 'react'
import { SectionHeader } from '@/shared/ui/SectionHeader'
import { FormField } from '@/shared/ui/FormField'
import { IInput } from '@/shared/ui/IInput'
import { Checkbox } from '@/shared/ui/Checkbox'
import { YandexMap } from '@/shared/ui/YandexMap'
import { checkoutApi } from '../api/checkoutApi'
import type { DeliveryData, DeliveryAddress, OrderItem } from '../model/types'
import type { CartItemDisplay } from '@/features/Cart/api/cartApi'

type DeliveryMethodFormProps = {
	data: DeliveryData
	items: OrderItem[]
	cartItems: CartItemDisplay[]
	errors?: {
		city?: string
		street?: string
		house?: string
		apartment?: string
	}
	onChange: (data: Partial<DeliveryData>) => void
}

// Адрес самовывоза (можно вынести в конфиг)
const PICKUP_ADDRESS = {
	address: 'Москва, Волгоградский проспект, дом 111',
	workingHours: 'Ежедневно с 9:00 до 21:00',
}

// Типы для виджета СДЭК
interface ISDEKWidjet {
	open: (options: unknown) => void
	close: () => void
	on: (event: string, callback: (data: unknown) => void) => void
}

declare global {
	interface Window {
		ISDEKWidjet?: ISDEKWidjet
	}
}

export const DeliveryMethodForm = ({
	data,
	items,
	cartItems,
	errors,
	onChange,
}: DeliveryMethodFormProps) => {
	const [isCalculating, setIsCalculating] = useState(false)
	const [calculationError, setCalculationError] = useState<string | null>(null)

	// Состояние для альтернативного выбора ПВЗ
	const [selectedCityCode, setSelectedCityCode] = useState<number | null>(null)
	const [pvzList, setPvzList] = useState<
		Array<{
			code: string
			name: string
			address: string
			addressFull: string
			city: string
			region: string
			postalCode: string
			latitude: number
			longitude: number
			workTime: string
			phones?: Array<{ number: string }>
			email?: string
		}>
	>([])
	const [isLoadingPvz, setIsLoadingPvz] = useState(false)
	const [citySearchQuery, setCitySearchQuery] = useState('')
	const [citySearchResults, setCitySearchResults] = useState<
		Array<{
			code: number
			city: string
			region: string
			regionCode: number
			country: string
		}>
	>([])
	const [showCitySearch, setShowCitySearch] = useState(false)

	// Загрузка списка ПВЗ
	const loadPvzList = useCallback(async (cityCode: number) => {
		setIsLoadingPvz(true)
		setCalculationError(null)
		try {
			const pvzListData = await checkoutApi.getPvzList(cityCode)
			setPvzList(pvzListData)
			if (pvzListData.length === 0) {
				setCalculationError('ПВЗ в выбранном городе не найдены')
			}
		} catch (error) {
			console.error('Error loading PVZ list:', error)
			setCalculationError('Не удалось загрузить список ПВЗ')
		} finally {
			setIsLoadingPvz(false)
		}
	}, [])

	// Загрузка списка ПВЗ при выборе города
	const isDeliveryPvz =
		data.address.type === 'delivery' &&
		data.address.deliveryOption === 'pickup_point'
	
	const deliveryOption = data.address.type === 'delivery' ? data.address.deliveryOption : null

	useEffect(() => {
		if (selectedCityCode && isDeliveryPvz) {
			loadPvzList(selectedCityCode)
		}
	}, [selectedCityCode, isDeliveryPvz, loadPvzList, deliveryOption, data.address.type])

	// Поиск городов
	const handleCitySearch = async (query: string) => {
		setCitySearchQuery(query)
		if (query.length < 2) {
			setCitySearchResults([])
			setShowCitySearch(false)
			return
		}

		try {
			const cities = await checkoutApi.searchCities(query)
			setCitySearchResults(cities)
			setShowCitySearch(cities.length > 0)
		} catch (error) {
			console.error('Error searching cities:', error)
			setCitySearchResults([])
			setShowCitySearch(false)
		}
	}

	// Выбор города
	const handleCitySelect = (city: {
		code: number
		city: string
		region: string
	}) => {
		setSelectedCityCode(city.code)
		setCitySearchQuery(city.city)
		setShowCitySearch(false)
		if (data.address.type === 'delivery') {
			onChange({
				address: {
					...data.address,
					deliveryAddress: {
						...data.address.deliveryAddress,
						city: city.city,
					},
				},
			})
		}
	}

	// Выбор ПВЗ
	const handlePvzSelect = (pvz: (typeof pvzList)[0]) => {
		if (data.address.type !== 'delivery') return

		const selectedPvz = {
			code: pvz.code,
			address: pvz.addressFull || pvz.address,
			name: pvz.name,
		}

		onChange({
			address: {
				...data.address,
				deliveryAddress: {
					...data.address.deliveryAddress,
					city: pvz.city,
				},
				selectedPvz,
			},
		})

		// Рассчитываем стоимость доставки после выбора ПВЗ
		if (items.length > 0) {
			calculateDeliveryCost('pvz', {
				...data.address.deliveryAddress,
				city: pvz.city,
			})
		}
	}

	// Закрытие выпадающего списка городов при клике вне его
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement
			if (!target.closest('.city-search-container')) {
				setShowCitySearch(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	// Извлекаем deliveryAddress с проверкой типа для безопасного доступа (для зависимостей useCallback)
	const currentDeliveryAddress = data.address.type === 'delivery' ? data.address.deliveryAddress : null

	// Расчет стоимости доставки
	const calculateDeliveryCost = useCallback(
		async (deliveryType: 'door' | 'pvz', address?: DeliveryAddress): Promise<void> => {
			if (items.length === 0) return

			setIsCalculating(true)
			setCalculationError(null)

			try {
				const deliveryAddress =
					address ||
					(data.address.type === 'delivery'
						? data.address.deliveryAddress
						: undefined)

				if (!deliveryAddress || !deliveryAddress.city) {
					return
				}

				// Преобразуем товары в формат для расчета
				const orderItems: OrderItem[] = cartItems.map((item) => ({
					productId: item.product.id,
					quantity: item.quantity,
					price: item.product.price,
				}))

				const result = await checkoutApi.calculateDeliveryCost(
					deliveryAddress,
					orderItems,
					deliveryType
				)

				onChange({
					deliveryCost: result.cost,
					deliveryDate: result.deliveryDate,
					deliveryTime: result.deliveryTime,
				})
			} catch (error: unknown) {
				console.error('Error calculating delivery cost:', error)
				setCalculationError('Не удалось рассчитать стоимость доставки')
			} finally {
				setIsCalculating(false)
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			items.length,
			data.address.type,
			currentDeliveryAddress, // Используем currentDeliveryAddress вместо data.address.deliveryAddress для корректной работы с union типами
			cartItems,
			onChange,
		]
	)

	// Debounce для расчета стоимости при изменении адреса (до двери)
	const isDeliveryDoor =
		data.type === 'delivery' &&
		data.address.type === 'delivery' &&
		data.address.deliveryOption === 'door'
	
	// Используем уже извлеченный currentDeliveryAddress
	const deliveryAddress = currentDeliveryAddress
	
	const deliveryCity = isDeliveryDoor && deliveryAddress ? deliveryAddress.city : null
	const deliveryStreet = isDeliveryDoor && deliveryAddress ? deliveryAddress.street : null
	const deliveryHouse = isDeliveryDoor && deliveryAddress ? deliveryAddress.house : null

	useEffect(() => {
		if (isDeliveryDoor && deliveryAddress) {
			const { city, street, house } = deliveryAddress

			// Рассчитываем только если есть город, улица и дом
			if (city && street && house && items.length > 0) {
				// Сбрасываем предыдущую стоимость доставки
				setCalculationError(null)

				const timer = setTimeout(() => {
					calculateDeliveryCost('door')
				}, 1000) // Задержка 1 секунда после ввода

				return () => clearTimeout(timer)
			} else {
				// Если не все поля заполнены, сбрасываем стоимость
				if (city || street || house) {
					onChange({
						deliveryCost: undefined,
						deliveryDate: undefined,
						deliveryTime: undefined,
					})
				}
			}
		}
	}, [
		deliveryCity,
		deliveryStreet,
		deliveryHouse,
		items.length,
		isDeliveryDoor,
		deliveryAddress,
		calculateDeliveryCost,
		onChange,
	])

	const handleDeliveryTypeChange = (type: 'pickup' | 'delivery') => {
		if (type === 'pickup') {
			onChange({
				type: 'pickup',
				address: {
					type: 'pickup',
					pickupAddress: PICKUP_ADDRESS,
				},
			})
		} else {
			onChange({
				type: 'delivery',
				address: {
					type: 'delivery',
					deliveryAddress: {
						city: '',
						street: '',
						house: '',
						apartment: '',
					},
					deliveryOption: 'door',
				},
			})
		}
	}

	const handleDeliveryOptionChange = (option: 'door' | 'pickup_point') => {
		if (data.address.type === 'delivery') {
			onChange({
				address: {
					...data.address,
					deliveryOption: option,
				},
				// Сбрасываем стоимость доставки при смене опции
				deliveryCost: undefined,
				deliveryDate: undefined,
				deliveryTime: undefined,
			})
		}
	}

	const handleAddressChange = (field: keyof DeliveryAddress, value: string) => {
		if (data.address.type === 'delivery') {
			onChange({
				address: {
					...data.address,
					deliveryAddress: {
						...data.address.deliveryAddress,
						[field]: value,
					},
				},
			})
		}
	}

	return (
		<div className="bg-white rounded-md p-5 flex flex-col gap-10">
			{/* Заголовок секции */}
			<SectionHeader number={2} title="Способ получения" />

			{/* Кнопки выбора способа получения */}
			<div className="flex gap-3">
				<button
					type="button"
					onClick={() => handleDeliveryTypeChange('pickup')}
					className={`px-[18px] py-3 rounded-md text-xs font-normal leading-[1.75] transition-colors ${
						data.type === 'pickup'
							? 'bg-[#7B1931] text-[#F5F5F5]'
							: 'bg-[#F2E8EA] text-black'
					}`}
				>
					Самовывоз
				</button>
				<button
					type="button"
					onClick={() => handleDeliveryTypeChange('delivery')}
					className={`px-[18px] py-3 rounded-md text-xs font-normal leading-[1.75] transition-colors ${
						data.type === 'delivery'
							? 'bg-[#7B1931] text-[#F5F5F5]'
							: 'bg-[#F2E8EA] text-black'
					}`}
				>
					Доставка{' '}
					{data.deliveryCost ? `от ${data.deliveryCost} руб.` : 'от 990 руб.'}
				</button>
			</div>

			{/* Контент в зависимости от выбранного способа */}
			{data.type === 'pickup' && (
				<div className="flex flex-col gap-3">
					<p className="text-base font-bold leading-[1.3125] text-black">
						{data.address.type === 'pickup'
							? data.address.pickupAddress.address
							: ''}
					</p>
					<p className="text-base font-normal leading-[1.3125] text-black">
						{data.address.type === 'pickup'
							? data.address.pickupAddress.workingHours
							: ''}
					</p>
					{/* TODO: Добавить карту самовывоза после интеграции с картами */}
				</div>
			)}

			{data.type === 'delivery' && (
				<div className="flex flex-col gap-3">
					{/* Радио-кнопки для вариантов доставки */}
					<div className="flex flex-col gap-3">
						<Checkbox
							checked={
								data.address.type === 'delivery' &&
								data.address.deliveryOption === 'door'
							}
							onChange={(checked) =>
								checked && handleDeliveryOptionChange('door')
							}
						>
							<span className="text-xs font-bold leading-[1.333]">
								До двери
							</span>
						</Checkbox>
						<Checkbox
							checked={
								data.address.type === 'delivery' &&
								data.address.deliveryOption === 'pickup_point'
							}
							onChange={(checked) =>
								checked && handleDeliveryOptionChange('pickup_point')
							}
						>
							<span className="text-xs font-normal leading-[1.333]">
								До пункта выдачи
							</span>
						</Checkbox>
					</div>

					{/* Альтернативный выбор ПВЗ через API */}
					{data.address.type === 'delivery' &&
					data.address.deliveryOption === 'pickup_point' ? (
						<div className="flex flex-col gap-3">
							{/* Поиск города */}
							<FormField label="Город">
								<div className="relative city-search-container">
									<IInput
										type="text"
										value={
											citySearchQuery || data.address.deliveryAddress.city || ''
										}
										placeholder="Введите город (например, Москва)"
										onChange={(e) => {
											const value = e.target.value
											if (data.address.type === 'delivery') {
												onChange({
													address: {
														...data.address,
														deliveryAddress: {
															...data.address.deliveryAddress,
															city: value,
														},
													},
												})
											}
											handleCitySearch(value)
										}}
										onFocus={() => {
											if (citySearchResults.length > 0) {
												setShowCitySearch(true)
											}
										}}
									/>
									{/* Результаты поиска городов */}
									{showCitySearch && citySearchResults.length > 0 && (
										<div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
											{citySearchResults.map((city) => (
												<button
													key={city.code}
													type="button"
													className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
													onClick={() => handleCitySelect(city)}
												>
													{city.city}, {city.region}
												</button>
											))}
										</div>
									)}
								</div>
							</FormField>

							{/* Карта и список ПВЗ */}
							{selectedCityCode && (
								<div className="flex flex-col gap-3">
									{isLoadingPvz ? (
										<p className="text-sm text-gray-500">
											Загрузка списка ПВЗ...
										</p>
									) : pvzList.length > 0 ? (
										<>
											{/* Карта с ПВЗ */}
											<div className="border border-gray-200 rounded-md overflow-hidden">
												<YandexMap
													center={{
														lat: pvzList[0]?.latitude || 55.7558,
														lon: pvzList[0]?.longitude || 37.6173,
													}}
													zoom={12}
													height="400px"
													markers={pvzList.map((pvz) => ({
														id: pvz.code,
														latitude: pvz.latitude,
														longitude: pvz.longitude,
														title: pvz.name,
														address: pvz.addressFull || pvz.address,
														isSelected:
															data.address.type === 'delivery' &&
															data.address.selectedPvz?.code === pvz.code,
														onClick: () => handlePvzSelect(pvz),
													}))}
												/>
											</div>

											{/* Список ПВЗ */}
											<div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-md">
												{pvzList.map((pvz) => (
													<button
														key={pvz.code}
														type="button"
														onClick={() => handlePvzSelect(pvz)}
														className={`w-full p-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
															data.address.type === 'delivery' &&
															data.address.selectedPvz?.code === pvz.code
																? 'bg-[#F2E8EA] border-[#7B1931]'
																: ''
														}`}
													>
														<p className="text-sm font-bold">{pvz.name}</p>
														<p className="text-xs text-gray-600 mt-1">
															{pvz.addressFull || pvz.address}
														</p>
														{pvz.workTime && (
															<p className="text-xs text-gray-500 mt-1">
																Время работы: {pvz.workTime}
															</p>
														)}
														{pvz.phones && pvz.phones.length > 0 && (
															<p className="text-xs text-gray-500">
																Телефон:{' '}
																{pvz.phones.map((p) => p.number).join(', ')}
															</p>
														)}
													</button>
												))}
											</div>
										</>
									) : calculationError ? (
										<p className="text-sm text-red-500">{calculationError}</p>
									) : null}
								</div>
							)}
							{data.address.selectedPvz && (
								<div className="p-3 bg-gray-50 rounded-md">
									<p className="text-sm font-bold">
										Выбран ПВЗ: {data.address.selectedPvz.name}
									</p>
									<p className="text-sm text-gray-600">
										{data.address.selectedPvz.address}
									</p>
									{data.deliveryCost && (
										<p className="text-sm font-bold mt-2">
											Стоимость доставки: {data.deliveryCost} руб.
										</p>
									)}
									{data.deliveryDate && (
										<p className="text-sm text-gray-600">
											Дата доставки: {data.deliveryDate}
										</p>
									)}
								</div>
							)}
							{isCalculating && (
								<p className="text-sm text-gray-500">
									Расчет стоимости доставки...
								</p>
							)}
							{calculationError && (
								<p className="text-sm text-red-500">{calculationError}</p>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<FormField label="Город" error={errors?.city}>
								<IInput
									type="text"
									value={
										data.address.type === 'delivery'
											? data.address.deliveryAddress.city
											: ''
									}
									placeholder="Москва"
									onChange={(e) => handleAddressChange('city', e.target.value)}
								/>
							</FormField>

							<FormField label="Улица" error={errors?.street}>
								<IInput
									type="text"
									value={
										data.address.type === 'delivery'
											? data.address.deliveryAddress.street
											: ''
									}
									placeholder="Улица"
									onChange={(e) =>
										handleAddressChange('street', e.target.value)
									}
								/>
							</FormField>

							<div className="flex gap-3">
								<FormField label="Дом" error={errors?.house} className="flex-1">
									<IInput
										type="text"
										value={
											data.address.type === 'delivery'
												? data.address.deliveryAddress.house
												: ''
										}
										placeholder="Дом"
										onChange={(e) =>
											handleAddressChange('house', e.target.value)
										}
									/>
								</FormField>

								<FormField
									label="Квартира"
									error={errors?.apartment}
									className="flex-1"
								>
									<IInput
										type="text"
										value={
											data.address.type === 'delivery'
												? data.address.deliveryAddress.apartment || ''
												: ''
										}
										placeholder="Квартира"
										onChange={(e) =>
											handleAddressChange('apartment', e.target.value)
										}
									/>
								</FormField>
							</div>

							{/* Информация о стоимости доставки */}
							{data.deliveryCost && (
								<div className="p-3 bg-gray-50 rounded-md">
									<p className="text-sm font-bold">
										Стоимость доставки: {data.deliveryCost} руб.
									</p>
									{data.deliveryDate && (
										<p className="text-sm text-gray-600 mt-1">
											Дата доставки: {data.deliveryDate}
										</p>
									)}
									{data.deliveryTime && (
										<p className="text-sm text-gray-600">
											Срок доставки: {data.deliveryTime}
										</p>
									)}
								</div>
							)}
							{isCalculating && (
								<p className="text-sm text-gray-500">
									Расчет стоимости доставки...
								</p>
							)}
							{calculationError && (
								<p className="text-sm text-red-500">{calculationError}</p>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
