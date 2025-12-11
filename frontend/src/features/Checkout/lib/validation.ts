import type { CheckoutFormData, CheckoutFormErrors } from '../model/types'

/**
 * Валидация формы оформления заказа
 */
export const validateCheckoutForm = (
	formData: CheckoutFormData
): CheckoutFormErrors => {
	const errors: CheckoutFormErrors = {}

	// Валидация данных покупателя
	if (!formData.customer.name || formData.customer.name.trim().length === 0) {
		errors.customer = {
			...errors.customer,
			name: 'Укажите имя',
		}
	}

	if (
		!formData.customer.phone ||
		formData.customer.phone.trim().length === 0
	) {
		errors.customer = {
			...errors.customer,
			phone: 'Укажите телефон',
		}
	} else {
		// Простая валидация телефона
		const phoneRegex = /^\+?[1-9]\d{1,14}$/
		const cleanPhone = formData.customer.phone.replace(/\D/g, '')
		if (cleanPhone.length < 10 || !phoneRegex.test(`+${cleanPhone}`)) {
			errors.customer = {
				...errors.customer,
				phone: 'Неверный формат телефона',
			}
		}
	}

	if (!formData.customer.email || formData.customer.email.trim().length === 0) {
		errors.customer = {
			...errors.customer,
			email: 'Укажите email',
		}
	} else {
		// Простая валидация email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(formData.customer.email)) {
			errors.customer = {
				...errors.customer,
				email: 'Неверный формат email',
			}
		}
	}

	// Валидация адреса доставки (если выбрана доставка)
	if (formData.delivery.type === 'delivery') {
		const deliveryAddress = formData.delivery.address
		if (deliveryAddress.type === 'delivery') {
			if (!deliveryAddress.deliveryAddress.city?.trim()) {
				errors.delivery = {
					...errors.delivery,
					city: 'Укажите город',
				}
			}

			if (!deliveryAddress.deliveryAddress.street?.trim()) {
				errors.delivery = {
					...errors.delivery,
					street: 'Укажите улицу',
				}
			}

			if (!deliveryAddress.deliveryAddress.house?.trim()) {
				errors.delivery = {
					...errors.delivery,
					house: 'Укажите дом',
				}
			}
		}
	}

	// Валидация согласий
	if (!formData.agreements.publicOffer) {
		errors.agreements = {
			...errors.agreements,
			publicOffer: 'Необходимо согласие с условиями оферты',
		}
	}

	if (!formData.agreements.personalData) {
		errors.agreements = {
			...errors.agreements,
			personalData: 'Необходимо согласие на обработку персональных данных',
		}
	}

	return errors
}

/**
 * Проверка наличия ошибок в форме
 */
export const hasErrors = (errors: CheckoutFormErrors): boolean => {
	if (errors.general) return true
	if (errors.customer && Object.keys(errors.customer).length > 0) return true
	if (errors.delivery && Object.keys(errors.delivery).length > 0) return true
	if (errors.agreements && Object.keys(errors.agreements).length > 0)
		return true
	return false
}

