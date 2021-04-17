import { GetWaveformItem } from './useWaveform'
import { WaveformGesture, ClipDrag, ClipStretch } from './WaveformEvent'
import { WaveformItem, WaveformRegion, WaveformState } from './WaveformState'

export type WaveformAction =
  | {
      type: 'NAVIGATE_TO_TIME'
      ms: number
      viewBoxStartMs?: number
      selection?: WaveformState['selection'] | null
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
  | { type: 'ADD_ITEM'; item: WaveformItem; getItem: GetWaveformItem }
  | {
      type: 'MOVE_ITEM'
      move: ClipDrag
      getItem: GetWaveformItem
    }
  | {
      type: 'STRETCH_ITEM'
      stretch: ClipStretch
      getItem: GetWaveformItem
    }
  | { type: 'DELETE_ITEM'; item: WaveformItem; getItem: GetWaveformItem }
  | {
      type: 'SET_ITEMS'
      sortedItems: WaveformItem[]
      // rename
      end: number
    }

// create
// create many
// update
// update many
// delete
