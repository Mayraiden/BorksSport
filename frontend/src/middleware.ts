import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Блокируем известные паттерны атак
const BLOCKED_PATTERNS = [
	/VULN_/i,
	/REACT2SHELL/i,
	/RCE/i,
	/xmrig/i,
	/scanner_linux/i,
	/base64.*decode/i,
	/chmod.*\+x/i,
	/wget.*github/i,
	/curl.*http/i,
	/eval\(/i,
	/exec\(/i,
	/child_process/i,
	/\.\.\/\.\.\//, // Path traversal
	/<script/i,
	/javascript:/i,
	/998y\.png/i,
	/vc\.png/i,
	/777y\.png/i,
	// Блокируем digest параметры с уязвимостями (двойная защита)
	/digest.*VULN/i,
	/digest.*RCE/i,
	/digest.*REACT/i,
	/digest.*REACT2SHELL/i,
]

// Блокируем подозрительные query параметры
const BLOCKED_QUERY_PATTERNS = [
	/digest.*VULN/i,
	/digest.*RCE/i,
	/digest.*REACT/i,
	/digest.*REACT2SHELL/i,
]

// Блокируем системные пути
const BLOCKED_PATHS = [
	'/.next/',
	'/dev/',
	'/etc/',
	'/var/',
	'/proc/',
	'/tmp/',
	'/lrt',
	'/sys/',
	'/root/',
]

export function middleware(request: NextRequest) {
	const url = request.nextUrl
	const pathname = url.pathname
	const searchParams = url.searchParams.toString()
	const userAgent = request.headers.get('user-agent') || ''
	// Получаем IP из заголовков (x-forwarded-for или x-real-ip)
	const forwardedFor = request.headers.get('x-forwarded-for')
	const realIp = request.headers.get('x-real-ip')
	const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'

	// Проверяем pathname на блокированные пути
	for (const blockedPath of BLOCKED_PATHS) {
		if (pathname.includes(blockedPath)) {
			console.warn(`[SECURITY] Blocked system file access: ${pathname}`, {
				ip,
				userAgent,
				timestamp: new Date().toISOString(),
			})
			return new NextResponse('Forbidden', { status: 403 })
		}
	}

	// Проверяем pathname на паттерны атак
	for (const pattern of BLOCKED_PATTERNS) {
		if (pattern.test(pathname) || pattern.test(searchParams) || pattern.test(userAgent)) {
			console.warn(`[SECURITY] Blocked suspicious request: ${pathname}`, {
				searchParams,
				userAgent,
				ip,
				pattern: pattern.toString(),
				timestamp: new Date().toISOString(),
			})
			return new NextResponse('Forbidden', { status: 403 })
		}
	}

	// Проверяем query параметры
	for (const pattern of BLOCKED_QUERY_PATTERNS) {
		if (pattern.test(searchParams)) {
			console.warn(`[SECURITY] Blocked suspicious query: ${searchParams}`, {
				pathname,
				ip,
				userAgent,
				pattern: pattern.toString(),
				timestamp: new Date().toISOString(),
			})
			return new NextResponse('Forbidden', { status: 403 })
		}
	}

	// Создаем response с security headers
	const response = NextResponse.next()

	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff')
	response.headers.set('X-Frame-Options', 'DENY')
	response.headers.set('X-XSS-Protection', '1; mode=block')
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api-maps.yandex.ru https://yandex.ru https://yastatic.net https://*.maps.yandex.net; style-src 'self' 'unsafe-inline' https://yastatic.net; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:1337 http://127.0.0.1:1337 http://localhost:3000 ws://localhost:3000 ws://127.0.0.1:3000;"
	)
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

	return response
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder files (images, fonts, etc.)
		 */
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$).*)',
	],
}
