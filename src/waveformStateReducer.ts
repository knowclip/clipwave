import { pixelsToMs, secondsToMs } from './utils'
import { WaveformState } from './WaveformState'
import { bound } from './utils/bound'
import { WaveformAction } from './WaveformAction'

export const blankState: WaveformState = {
  cursorMs: 0,
  durationSeconds: 0,
  viewBoxStartMs: 0,
  pixelsPerSecond: 50,
  selection: { regionIndex: 0, item: null },
  pendingAction: null,
  regions: []
}

export function waveformStateReducer(
  state: WaveformState,
  action: WaveformAction
): WaveformState {
  switch (action.type) {
    case 'RESET':
      return {
        ...blankState,
        durationSeconds: action.durationSeconds,
        regions: action.regions
        // TODO: select item at current time
      }
    case 'START_WAVEFORM_MOUSE_ACTION':
      return {
        ...state,
        pendingAction: action.action
      }
    case 'CONTINUE_WAVEFORM_MOUSE_ACTION':
      return {
        ...state,
        pendingAction: state.pendingAction
          ? {
              ...state.pendingAction,
              end: action.ms
            }
          : null
      }
    case 'NAVIGATE_TO_TIME': {
      const { ms, viewBoxStartMs, selection } = action
      return {
        ...state,
        cursorMs: ms,
        viewBoxStartMs:
          typeof viewBoxStartMs === 'number'
            ? viewBoxStartMs
            : state.viewBoxStartMs,
        selection: selection || state.selection
      }
    }
    case 'ZOOM': {
      const newPixelsPerSecond = bound(state.pixelsPerSecond + action.delta, [
        10,
        200
      ])
      const oldVisibleTimeSpan = pixelsToMs(
        action.svgWidth,
        state.pixelsPerSecond
      )
      const cursorScreenOffset = state.cursorMs - state.viewBoxStartMs
      const cursorScreenOffsetRatio = cursorScreenOffset / oldVisibleTimeSpan
      const newVisibleTimeSpan = pixelsToMs(action.svgWidth, newPixelsPerSecond)
      const newCursorScreenOffset = Math.round(
        cursorScreenOffsetRatio * newVisibleTimeSpan
      )
      const potentialNewViewBoxStartMs = state.cursorMs - newCursorScreenOffset
      return {
        ...state,
        pixelsPerSecond: newPixelsPerSecond,
        viewBoxStartMs: bound(potentialNewViewBoxStartMs, [
          0,
          secondsToMs(state.durationSeconds) - newVisibleTimeSpan
        ])
      }
    }

    case 'SELECT_ITEM':
      return {
        ...state,
        selection: {
          regionIndex: action.regionIndex,
          item: action.item.id
        }
      }

    case 'SET_REGIONS': {
      return {
        ...state,
        regions: action.regions
      }
    }

    default:
      return state
  }
}
