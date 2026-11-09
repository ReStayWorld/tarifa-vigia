/** Link de búsqueda del hotel en cada web, con las fechas y adultos de la reserva. */
export function linkWeb(web: string, hotel: string, ciudad: string, checkIn: string, checkOut: string, adultos: number): string {
  const q = `${hotel} ${ciudad}`;
  const w = web.toLowerCase();
  const p = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const noches = String(Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000)));
  if (w.includes("booking")) return `https://www.booking.com/searchresults.html?${p({ ss: q, checkin: checkIn, checkout: checkOut, group_adults: String(adultos), no_rooms: "1" })}`;
  if (w.includes("agoda")) return `https://www.agoda.com/search?${p({ textToSearch: q, checkIn, los: noches, adults: String(adultos), rooms: "1" })}`;
  if (w.includes("expedia")) return `https://www.expedia.com/Hotel-Search?${p({ destination: q, startDate: checkIn, endDate: checkOut, adults: String(adultos) })}`;
  if (w.includes("hotels.com")) return `https://www.hotels.com/Hotel-Search?${p({ destination: q, startDate: checkIn, endDate: checkOut, adults: String(adultos) })}`;
  return `https://www.google.com/search?${p({ q: `${q} ${web}` })}`;
}
