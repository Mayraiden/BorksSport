'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type YandexControlId = 'zoomControl' | 'typeSelector' | 'fullscreenControl'

interface YandexMapBoundsOptions {
	checkZoomRange?: boolean
	duration?: number
}

interface YandexMapGeoObjects {
	add: (object: YandexMapObjectManager) => void
	removeAll: () => void
}

interface YandexMapInstance {
	geoObjects: YandexMapGeoObjects
	setCenter: (coordinates: [number, number], zoom?: number) => void
	setBounds: (bounds: number[][], options?: YandexMapBoundsOptions) => void
	destroy: () => void
}

interface YandexMapEvent {
	get: (key: string) => unknown
}

interface YandexGeoJsonFeature {
	type: 'Feature'
	id: string
	geometry: {
		type: 'Point'
		coordinates: [number, number]
	}
	properties: {
		balloonContentHeader: string
		balloonContentBody: string
		balloonContentFooter: string
		clusterCaption: string
		hintContent: string
	}
	options: {
		preset: string
	}
}

interface YandexMapObjectManager {
	add: (features: YandexGeoJsonFeature[]) => void
	getBounds: () => number[][] | null
	objects: {
		events: {
			add: (type: string, handler: (event: YandexMapEvent) => void) => void
		}
	}
}

interface YandexMapOptions {
	center: [number, number]
	zoom: number
	controls: YandexControlId[]
}

interface YandexMapsNamespace {
	ready: (callback: () => void) => void
	Map: new (
		element: HTMLElement,
		options: YandexMapOptions
	) => YandexMapInstance
	ObjectManager: new (options: {
		clusterize: boolean
		gridSize: number
	}) => YandexMapObjectManager
}

const DEFAULT_CONTROLS: YandexControlId[] = [
	'zoomControl',
	'typeSelector',
	'fullscreenControl',
]

export interface MapMarker {
	id: string
	latitude: number
	longitude: number
	title: string
	address?: string
	onClick?: () => void
	isSelected?: boolean
}

interface YandexMapProps {
	center: { lat: number; lon: number }
	zoom?: number
	markers: MapMarker[]
	height?: string
	width?: string
	onMapReady?: (map: YandexMapInstance) => void
	apiKey?: string
}

let yandexMapsPromise: Promise<void> | null = null

const loadYandexMaps = (apiKey?: string) => {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('Yandex Maps доступны только в браузере'))
	}

	const existingYMaps = window.ymaps

	if (existingYMaps && typeof existingYMaps.Map === 'function') {
		return Promise.resolve()
	}

	if (existingYMaps && typeof existingYMaps.ready === 'function') {
		return new Promise<void>((resolve) => {
			existingYMaps.ready(() => resolve())
		})
	}

	if (yandexMapsPromise) {
		return yandexMapsPromise
	}

	yandexMapsPromise = new Promise<void>((resolve, reject) => {
		const existingScript = document.querySelector<HTMLScriptElement>(
			'script[src^="https://api-maps.yandex.ru/2.1/"]'
		)

		const apiKeyParam = apiKey ? `apikey=${apiKey}&` : ''

		const handleLoad = () => {
			const ymapsInstance = window.ymaps
			if (!ymapsInstance || typeof ymapsInstance.ready !== 'function') {
				reject(new Error('Yandex Maps API недоступно после загрузки'))
				return
			}

			ymapsInstance.ready(() => {
				resolve()
			})
		}

		const handleError = () => {
			yandexMapsPromise = null
			reject(new Error('Не удалось загрузить Yandex Maps API'))
		}

		if (existingScript) {
			if (existingScript.dataset.ymapsLoaded === 'true') {
				handleLoad()
				return
			}
			existingScript.addEventListener('load', handleLoad, { once: true })
			existingScript.addEventListener('error', handleError, { once: true })
			return
		}

		const script = document.createElement('script')
		script.src = `https://api-maps.yandex.ru/2.1/?${apiKeyParam}lang=ru_RU`
		script.async = true
		script.onload = () => {
			script.dataset.ymapsLoaded = 'true'
			handleLoad()
		}
		script.onerror = handleError
		document.head.appendChild(script)
	})

	return yandexMapsPromise
}

declare global {
	interface Window {
		ymaps?: YandexMapsNamespace
	}
}

export const YandexMap = ({
	center,
	zoom = 12,
	markers,
	height = '400px',
	width = '100%',
	onMapReady,
	apiKey,
}: YandexMapProps) => {
	const mapRef = useRef<HTMLDivElement>(null)
	const mapInstanceRef = useRef<YandexMapInstance | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const renderMarkers = useCallback(() => {
		const map = mapInstanceRef.current
		const ymaps = window.ymaps

		if (!map || !ymaps) {
			return
		}

		try {
			map.geoObjects.removeAll()

			if (markers.length === 0) {
				return
			}

			const objectManager = new ymaps.ObjectManager({
				clusterize: markers.length > 10,
				gridSize: 64,
			})

			const features: YandexGeoJsonFeature[] = markers.map((marker) => ({
				type: 'Feature' as const,
				id: marker.id,
				geometry: {
					type: 'Point' as const,
					coordinates: [marker.latitude, marker.longitude] as [number, number],
				},
				properties: {
					balloonContentHeader: marker.title,
					balloonContentBody: marker.address ?? '',
					balloonContentFooter: marker.id,
					clusterCaption: marker.title,
					hintContent: marker.title,
				},
				options: {
					preset: marker.isSelected ? 'islands#redIcon' : 'islands#blueIcon',
				},
			}))

			objectManager.add(features)
			map.geoObjects.add(objectManager)

			const ymapsEventHandler = (event: YandexMapEvent) => {
				const objectId = event.get('objectId') as string | undefined
				if (!objectId) {
					return
				}

				const marker = markers.find((m) => m.id === objectId)
				marker?.onClick?.()
			}

			objectManager.objects.events.add('click', ymapsEventHandler)

			if (markers.length > 1) {
				const bounds = objectManager.getBounds()
				if (bounds) {
					map.setBounds(bounds, {
						checkZoomRange: true,
						duration: 300,
					})
				}
			} else if (markers.length === 1) {
				map.setCenter([markers[0].latitude, markers[0].longitude], 15)
			}
		} catch (err) {
			console.error('Error updating markers:', err)
		}
	}, [markers])

	const latestCenterRef = useRef(center)
	const latestZoomRef = useRef(zoom)
	const latestRenderMarkersRef = useRef(renderMarkers)

	useEffect(() => {
		latestCenterRef.current = center
	}, [center])

	useEffect(() => {
		latestZoomRef.current = zoom
	}, [zoom])

	useEffect(() => {
		latestRenderMarkersRef.current = renderMarkers
	}, [renderMarkers])

	useEffect(() => {
		let isUnmounted = false

		const initializeMap = () => {
			const container = mapRef.current
			const ymaps = window.ymaps
			const currentCenter = latestCenterRef.current
			const currentZoom = latestZoomRef.current
			const renderMarkersFn = latestRenderMarkersRef.current

			if (!container || !ymaps || mapInstanceRef.current) {
				return
			}

			try {
				const map = new ymaps.Map(container, {
					center: [currentCenter.lat, currentCenter.lon],
					zoom: currentZoom,
					controls: DEFAULT_CONTROLS,
				})

				mapInstanceRef.current = map
				setIsLoading(false)
				setError(null)

				renderMarkersFn?.()

				onMapReady?.(map)
			} catch (err) {
				console.error('Error initializing map:', err)
				setError('Ошибка инициализации карты')
				setIsLoading(false)
			}
		}

		loadYandexMaps(apiKey)
			.then(() => {
				if (!isUnmounted) {
					initializeMap()
				}
			})
			.catch((err) => {
				console.error(err)
				if (!isUnmounted) {
					setError('Не удалось загрузить Яндекс-Карты')
					setIsLoading(false)
				}
			})

		return () => {
			isUnmounted = true
			if (mapInstanceRef.current) {
				try {
					mapInstanceRef.current.destroy()
				} catch (e) {
					console.error('Error destroying map:', e)
				}
				mapInstanceRef.current = null
			}
		}
	}, [apiKey, onMapReady])

	useEffect(() => {
		if (!mapInstanceRef.current || !window.ymaps) {
			return
		}

		mapInstanceRef.current.setCenter([center.lat, center.lon], zoom)
	}, [center.lat, center.lon, zoom])

	useEffect(() => {
		renderMarkers()
	}, [renderMarkers])

	// Обновление меток при изменении

	if (error) {
		return (
			<div
				className="flex items-center justify-center border border-gray-300 rounded-md bg-gray-50"
				style={{ height, width }}
			>
				<p className="text-sm text-red-500">{error}</p>
			</div>
		)
	}

	return (
		<div className="relative" style={{ width, height }}>
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md z-10">
					<p className="text-sm text-gray-500">Загрузка карты...</p>
				</div>
			)}
			<div
				ref={mapRef}
				style={{ width: '100%', height: '100%', minHeight: height }}
				className="rounded-md"
			/>
		</div>
	)
}
