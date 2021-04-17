export type WaveformState = {
  durationSeconds: number
  cursorMs: number
  viewBoxStartMs: number
  pixelsPerSecond: number
  selection: {
    regionIndex: number
    region: WaveformRegion
    item: WaveformItem
  } | null
  pendingAction: import('./WaveformEvent').WaveformGesture | null
  regions: WaveformRegion[]
}

export type WaveformItem = PrimaryClip | SecondaryClip

export interface PrimaryClip {
  clipwaveType: 'Primary'
  id: string
  start: number
  end: number
}
export interface SecondaryClip {
  clipwaveType: 'Secondary'
  id: string
  start: number
  end: number
}

export type WaveformRegion = {
  /** milliseconds */
  start: number
  itemIds: string[]
  /** only for last */
  end?: number
}
