/** One game day lasts 20 real minutes; the shared world begins at 09:00. */
export const DAY_SECONDS=20*60;
export function worldHour(seconds:number):number {return ((9+seconds/DAY_SECONDS*24)%24+24)%24;}
export function nightAmount(hour:number):number {
 const daylight=Math.sin((hour-6)*Math.PI/12);
 return 1-Math.max(0,Math.min(1,(daylight+.15)/.42));
}
export function clockLabel(seconds:number):string {const minutes=Math.floor(worldHour(seconds)*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
