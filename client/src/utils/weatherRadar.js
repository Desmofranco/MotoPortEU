export function analyzeWeather(wx){

  if(!wx) return {score:"?"}

  let score = 100

  if(wx.wind > 30) score -= 20
  if(wx.rain > 0) score -= 30
  if(wx.temp < 4) score -= 10

  if(score > 80) return {score:"A"}
  if(score > 60) return {score:"B"}
  if(score > 40) return {score:"C"}

  return {score:"D"}

}