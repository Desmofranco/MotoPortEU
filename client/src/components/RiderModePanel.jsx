export default function RiderModePanel({route,score}){

  if(!route) return null

  return (

    <div style={{
      padding:12,
      borderRadius:14,
      background:"rgba(255,255,255,0.8)",
      border:"1px solid rgba(0,0,0,0.08)"
    }}>

      <div style={{fontWeight:900}}>Rider Mode</div>

      <div style={{marginTop:6}}>
        📏 {route.distanceKm?.toFixed(1)} km
      </div>

      <div>
        ⏱ {Math.round(route.durationMin)} min
      </div>

      {score && (
        <div style={{marginTop:6}}>
          Rider Score: {score}
        </div>
      )}

    </div>

  )

}