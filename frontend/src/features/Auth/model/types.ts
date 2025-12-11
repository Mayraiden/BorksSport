export type IUserType = {
	id: number
	username: string
	email: string
	firstName: string | null
	lastName: string | null
	phone: string | null
	provider: string
	confirmed: boolean
	blocked: boolean
	createdAt: string
	updatedAt: string
	publishedAt: string
}

export type IUserStoreType = {
	user: IUserType | null
	jwt: string | null

	isAuthenticated: boolean
	isLoading: boolean
	error: string | null

	setUser: (user: IUserType | null) => void
	setJwt: (jwt: string | null) => void
	setLoading: (loading: boolean) => void
	setError: (error: string | null) => void
	logout: () => void
}
