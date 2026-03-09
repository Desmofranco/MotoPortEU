import { useState } from "react"

export default function useRouteEngine(){

  const [route,setRoute] = useState(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState(null)

  async function snapPoints(points){

    const coords = points.map(p => `${p.lng},${p.lat}`).join(";")

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`

    const res = await fetch(url)

    const data = await res.json()

    if(!data.routes?.length) throw new Error("Route error")

    const r = data.routes[0]

    const geometry = r.geometry.coordinates.map(c => ({
      lat: c[1],
      lng: c[0]
    }))

    return geometry
  }

  async function buildRoute(points){

    setLoading(true)

    try{

      const snapped = await snapPoints(points)

      const distanceKm = snapped.length / 20
      const durationMin = distanceKm * 0.9

      const route = {
        geometry: snapped,
        distanceKm,
        durationMin
      }

      setRoute(route)

      return {route}

    }catch(e){

      setError(e)

    }finally{
      setLoading(false)
    }

  }

  function reset(){
    setRoute(null)
    setError(null)
  }

  return {
    route,
    loading,
    error,
    snapPoints,
    buildRoute,
    reset
  }

}