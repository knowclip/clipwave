import { SecondaryClip, WaveformRegion } from './WaveformState'

export type SecondaryClipDisplayProps = {
  clip: SecondaryClip
  region: WaveformRegion
  regionIndex: number
  pixelsPerSecond: number
}
