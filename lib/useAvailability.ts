'use client'

import { useEffect, useState } from 'react'

/**
 * Catalog ids that Uniqlo is no longer selling, from `/api/availability`.
 *
 * Starts empty and stays empty if the request fails, so every failure mode (offline,
 * upstream down, slow) shows the full grid rather than an empty one. Nothing here can
 * remove a garment from the page; it can only annotate one.
 */
export function useUnavailable(): Set<string> {
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    fetch('/api/availability')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { unavailable?: string[] } | null) => {
        if (alive && d?.unavailable) setUnavailable(new Set(d.unavailable))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return unavailable
}
