import type { SimulationState } from '../types/simulation'

const STORAGE_KEY = 'bullet-simulator-state'

export function loadStoredState(): SimulationState | null {
  if (!hasStorage()) {
    return null
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as SimulationState
  } catch {
    return null
  }
}

export function saveStoredState(state: SimulationState): void {
  if (!hasStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && 'localStorage' in window
}
