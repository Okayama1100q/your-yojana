// ──────────────────────────────────────────────
// CivicMap — OpenStreetMap wrapper (Leaflet)
// ──────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import type { LocationData } from "../../types/civicTypes"

// Dynamically import Leaflet to avoid SSR issues and keep the CSS loaded
let L: any = null
let leafletCSSLoaded = false

function ensureLeafletCSS() {
  if (leafletCSSLoaded) return
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
  link.crossOrigin = ""
  document.head.appendChild(link)
  leafletCSSLoaded = true
}

interface CivicMapProps {
  /** Issue location to place a marker */
  issueLocation?: LocationData | null
  /** User's current location (for route line) */
  userLocation?: { lat: number; lng: number } | null
  /** Show route line from user to issue */
  showRoute?: boolean
  /** Height of the map container */
  height?: string
  /** Callback when user clicks on the map to pick a location */
  onLocationPick?: (location: LocationData) => void
  /** Whether the map is in "pick mode" for selecting a location */
  pickMode?: boolean
}

export function CivicMap({
  issueLocation,
  userLocation,
  showRoute = false,
  height = "400px",
  onLocationPick,
  pickMode = false,
}: CivicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const issueMarkerRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: string
    duration: string
  } | null>(null)

  // Initialize map
  useEffect(() => {
    ensureLeafletCSS()

    let cancelled = false

    const initMap = async () => {
      try {
        if (!L) {
          L = await import("leaflet")
        }
        if (cancelled || !mapContainerRef.current) return

        // Fix default icon paths (common Leaflet + bundler issue)
        delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        const defaultCenter: [number, number] = issueLocation
          ? [issueLocation.lat, issueLocation.lng]
          : userLocation
            ? [userLocation.lat, userLocation.lng]
            : [13.0827, 80.2707] // Default: Chennai

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 14,
          zoomControl: true,
          attributionControl: true,
        })

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)

        mapRef.current = map

        setTimeout(() => {
          map.invalidateSize()
        }, 200)

        // Pick mode
        if (pickMode && onLocationPick) {
          map.on("click", async (e: any) => {
            const { lat, lng } = e.latlng

            // Reverse geocode with Nominatim
            let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
                { headers: { "Accept-Language": "en" } }
              )
              if (res.ok) {
                const data = await res.json()
                if (data.display_name) {
                  address = data.display_name
                }
              }
            } catch {
              // Keep coordinate address
            }

            // Move/create marker
            if (issueMarkerRef.current) {
              issueMarkerRef.current.setLatLng([lat, lng])
            } else {
              issueMarkerRef.current = L!.marker([lat, lng])
                .addTo(map)
                .bindPopup("Issue Location")
            }

            onLocationPick({ lat, lng, address })
          })
        }
      } catch {
        if (!cancelled) {
          setError("Map couldn't be loaded. You can still continue with your report.")
        }
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update issue marker when location changes
  useEffect(() => {
    if (!mapRef.current || !L || !issueLocation) return

    const pos: [number, number] = [issueLocation.lat, issueLocation.lng]
    mapRef.current.setView(pos, 14)
    mapRef.current.invalidateSize()

    if (issueMarkerRef.current) {
      issueMarkerRef.current.setLatLng(pos)
    } else {
      issueMarkerRef.current = L.marker(pos)
        .addTo(mapRef.current)
        .bindPopup(issueLocation.address || "Issue Location")
    }
  }, [issueLocation])

  // Show user location
  useEffect(() => {
    if (!mapRef.current || !L || !userLocation) return

    const pos: [number, number] = [userLocation.lat, userLocation.lng]

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(pos)
    } else {
      userMarkerRef.current = L.circleMarker(pos, {
        radius: 8,
        fillColor: "#4285F4",
        fillOpacity: 1,
        color: "#ffffff",
        weight: 3,
      })
        .addTo(mapRef.current)
        .bindPopup("Your Location")
    }
  }, [userLocation])

  // Show route line (straight line + OSRM directions)
  useEffect(() => {
    if (!mapRef.current || !L || !showRoute || !userLocation || !issueLocation) {
      if (routeLineRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeLineRef.current)
        routeLineRef.current = null
        setRouteInfo(null)
      }
      return
    }

    const fetchRoute = async () => {
      try {
        // Use OSRM for real routing
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${issueLocation.lng},${issueLocation.lat}?overview=full&geometries=geojson`
        )

        if (res.ok) {
          const data = await res.json()
          const route = data.routes?.[0]

          if (route) {
            // Draw the route polyline
            const coords = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            )

            if (routeLineRef.current) {
              routeLineRef.current.setLatLngs(coords)
            } else {
              routeLineRef.current = L!.polyline(coords, {
                color: "#000000",
                weight: 3,
                opacity: 0.8,
                dashArray: "8, 4",
              }).addTo(mapRef.current!)
            }

            // Fit bounds to show entire route
            mapRef.current!.fitBounds(routeLineRef.current!.getBounds(), {
              padding: [40, 40],
            })

            // Extract route info
            const distKm = (route.distance / 1000).toFixed(1)
            const durMin = Math.round(route.duration / 60)
            setRouteInfo({
              distance: `${distKm} km`,
              duration: durMin >= 60
                ? `${Math.floor(durMin / 60)}h ${durMin % 60}m`
                : `${durMin} min`,
            })

            return
          }
        }
      } catch {
        // Fall back to straight line below
      }

      // Fallback: straight line
      const points: [number, number][] = [
        [userLocation.lat, userLocation.lng],
        [issueLocation.lat, issueLocation.lng],
      ]

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(points)
      } else {
        routeLineRef.current = L!.polyline(points, {
          color: "#000000",
          weight: 2,
          opacity: 0.6,
          dashArray: "4, 8",
        }).addTo(mapRef.current!)
      }

      setRouteInfo(null)
    }

    fetchRoute()
  }, [showRoute, userLocation, issueLocation])

  if (error) {
    return (
      <div
        className="flex items-center justify-center border border-border bg-card text-muted-foreground text-sm uppercase tracking-widest"
        style={{ height }}
      >
        <p className="px-6 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div
      className="w-full flex-1 flex flex-col min-h-[300px]"
      style={height !== "100%" ? { height } : undefined}
    >
      <div
        ref={mapContainerRef}
        className="w-full flex-1 border-2 border-foreground bg-[#e2e8f0]"
      />

      {routeInfo && (
        <div className="flex gap-6 text-xs uppercase tracking-widest text-muted-foreground px-3 py-2 bg-background border-2 border-t-0 border-foreground">
          <span>
            DISTANCE: <strong className="text-foreground">{routeInfo.distance}</strong>
          </span>
          <span>
            ETA: <strong className="text-foreground">{routeInfo.duration}</strong>
          </span>
        </div>
      )}
    </div>
  )
}
