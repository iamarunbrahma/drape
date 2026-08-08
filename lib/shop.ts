// Turns a palette color into a real, buyable product search — no catalog, no API,
// no brand assets. Completes the funnel: analyze -> try on -> shop the exact shade.

export function shopSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`
}

/** A real shopping search for a garment in a specific palette color, matched to the user's gender. */
export function shopForColor(colorName: string, gender: 'female' | 'male' = 'female'): string {
  const item = gender === 'male' ? "men's shirt" : "women's top"
  return shopSearchUrl(`${colorName} ${item}`)
}
