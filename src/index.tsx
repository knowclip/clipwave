import Waveform from './Waveform'

export { Waveform }

export * from './WaveformState'
export * from './WaveformEvent'
export * from './utils'
export * from './utils/calculateRegions'
export * from './utils/waveformNavigation'

export { usePlayButtonSync } from './usePlayButtonSync'
export { useWaveformMediaTimeUpdate } from './useWaveformMediaTimeUpdate'
export * from './useWaveform'
export { getNewWaveformSelectionAt } from './useWaveformMediaTimeUpdate'

export type {
  PrimaryClipDisplayProps,
  SecondaryClipDisplayProps
} from './ClipDisplayProps'

export { default as css } from './Waveform.module.scss'
