import { PrimaryClip } from '.'
import { ClipClickDataProps } from './WaveformClips'
import { SecondaryClip, WaveformRegion } from './WaveformState'

export type SecondaryClipDisplayProps = {
  clip: SecondaryClip
  region: WaveformRegion
  regionIndex: number
  pixelsPerSecond: number
}

export type PrimaryClipDisplayProps = {
  clip: PrimaryClip
  region: WaveformRegion
  regionIndex: number
  pixelsPerSecond: number
  isHighlighted: boolean
  level: number
  height: number
  clickDataProps: ClipClickDataProps
}
