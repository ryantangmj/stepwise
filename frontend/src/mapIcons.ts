import L from "leaflet"

export function pinIcon(label: string, bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"><span style="transform:rotate(45deg);font-size:15px;line-height:1">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  })
}

export const START_ICON = pinIcon("A", "#0f766e")
export const END_ICON = pinIcon("B", "#1d4ed8")
export const REPORT_PIN_ICON = pinIcon("📷", "#c2410c")
