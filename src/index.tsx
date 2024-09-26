import Waveform from './Waveform'

export { Waveform }

export * from './WaveformState'
export * from './WaveformEvent'
export * from './utils'
export * from './utils/calculateRegions'
export * from './utils/waveformNavigation'
export { getNewWaveformSelectionAt } from './utils/getNewWaveformSelectionAt'
export { getRegionEnd } from './utils/getRegionEnd'

export { usePlayButtonSync } from './usePlayButtonSync'
export { useWaveformMediaTimeUpdate } from './useWaveformMediaTimeUpdate'
export * from './useWaveform'

export type {
  PrimaryClipDisplayProps,
  SecondaryClipDisplayProps
} from './ClipDisplayProps'

export { default as css } from './Waveform.module.css'
