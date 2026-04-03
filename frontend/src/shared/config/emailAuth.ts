export const isEmailAuthDisabled = () => {
	const raw =
		process.env.NEXT_PUBLIC_EMAIL_AUTH_DISABLED ||
		process.env.NEXT_PUBLIC_DISABLE_EMAIL_AUTH

	if (!raw) return false
	return raw === '1' || raw === 'true' || raw === 'yes'
}

