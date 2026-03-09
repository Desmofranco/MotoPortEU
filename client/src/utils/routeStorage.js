const KEY = "mp_last_route"

export function saveLastRoute(route){

  try{
    localStorage.setItem(KEY,JSON.stringify(route))
  }catch{}

}

export function loadLastRoute(){

  try{
    return JSON.parse(localStorage.getItem(KEY))
  }catch{
    return null
  }

}