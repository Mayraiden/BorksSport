interface ErrorMessageProps {
	message?: string
	className?: string
}

export const ErrorMessage = ({
	message,
	className = '',
}: ErrorMessageProps) => {
	if (!message) return null

	return <p className={`text-red-500 text-sm mt-1 ${className}`}>{message}</p>
}
