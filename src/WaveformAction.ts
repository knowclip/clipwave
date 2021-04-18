import { WaveformGesture } from './WaveformEvent'
import { WaveformItem, WaveformRegion, WaveformState } from './WaveformState'

export type WaveformAction =
  | {
      type: 'NAVIGATE_TO_TIME'
      ms: number
      viewBoxStartMs?: number
      selection: WaveformState['selection']
    }
  | { type: 'START_WAVEFORM_MOUSE_ACTION'; action: WaveformGesture | null }
  | { type: 'CONTINUE_WAVEFORM_MOUSE_ACTION'; ms: number }
  | { type: 'CLEAR_WAVEFORM_MOUSE_ACTION' }
  | { type: 'RESET'; durationSeconds: number; regions: WaveformRegion[] }
  | { type: 'ZOOM'; delta: number; svgWidth: number }
  | {
      type: 'SELECT_ITEM'
      region: WaveformRegion
      regionIndex: number
      item: WaveformItem
    }
  | {
      type: 'SET_REGIONS'
      regions: WaveformRegion[]
    }

// create
// create many
// update
// update many
// delete
