import { WaveformItem, WaveformRegion } from '../WaveformState'
import { Coords } from './calculateRegions'

export function getRegionEnd(regions: WaveformRegion[], index: number): number {
  const end = regions[regions.length - 1].end
  if (typeof end !== 'number') throw new Error('No regions end found')
  const nextRegion: WaveformRegion | null = regions[index + 1] || null
  if (!nextRegion) return end
  const nextRegionStart = nextRegion.start
  return nextRegionStart
}

export function overlap(a: Coords, b: Coords) {
  return a.start <= b.end && a.end >= b.start
}
export type WaveformItemUpdate =
  | {
      type: 'UPDATE'
      newItem: WaveformItem
    }
  | {
      type: 'DELETE'
      itemId: WaveformItem['id']
    }
  | {
      type: 'CREATE'
      newItem: WaveformItem
    }
