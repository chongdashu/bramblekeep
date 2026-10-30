/** Local, user-adjustable offsets for the equipment inspection scene. */
import config from "./equipment-config.json";
export const SOCKET_KEY = "castle-equipment-sockets-v1";
export const SOCKETS = ["sword", "staff", "bow", "arrow"] as const;
export type SocketName = typeof SOCKETS[number];
export type SocketAdjustment = { x:number; y:number; z:number; yaw:number; pitch:number; roll:number };
export type SocketField = keyof SocketAdjustment;
export type SocketSettings = Record<SocketName,SocketAdjustment>;
export function defaultSocketSettings():SocketSettings {
  return {sword:{...config.adjustments.sword},staff:{...config.adjustments.staff},bow:{...config.adjustments.bow},arrow:{...config.adjustments.arrow}};
}
/** Saved settings are untrusted, so discard malformed and out-of-range values. */
export function readSocketSettings():SocketSettings {
  const result=defaultSocketSettings();
  try {
    const saved=JSON.parse(localStorage.getItem(SOCKET_KEY)??"null");
    for(const slot of SOCKETS) for(const field of Object.keys(result[slot]) as SocketField[]) {
      const value=saved?.[slot]?.[field], limit=["x","y","z"].includes(field)?0.5:180;
      if(typeof value==="number" && Number.isFinite(value)) result[slot][field]=Math.max(-limit,Math.min(limit,value));
    }
  } catch { /* storage unavailable or malformed: use defaults */ }
  return result;
}
export function saveSocketSettings(value:SocketSettings):boolean {
  try { localStorage.setItem(SOCKET_KEY,JSON.stringify(value)); return true; } catch { return false; }
}
