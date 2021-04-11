import { pixelsToMs, secondsToMs } from './utils'
import { WaveformState } from './WaveformState'
import { bound } from './utils/bound'
import { WaveformAction } from './WaveformAction'
import { blankState } from './useWaveform'
import {
  newRegionsWithItem,
  recalculateRegions
} from './utils/calculateRegions'

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
        selection:
          typeof selection !== 'undefined' ? selection : state.selection
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
          region: action.region,
          regionIndex: action.regionIndex,
          item: action.item
        }
      }

    case 'ADD_ITEM':
      return {
        ...state,
        regions: newRegionsWithItem(state.regions, action.item)
      }

    case 'MOVE_ITEM': {
      const { move, getItem } = action
      const { start, end, clip } = move
      const delta = end - start
      const target = getItem(clip.id)
      const movedItem = {
        ...target,
        start: target.start + delta,
        end: target.end + delta
      }
      const regions = recalculateRegions(
        state.regions,
        action.getItem,
        target.id,
        movedItem
      )
      return {
        ...state,
        regions
      }
    }

    case 'STRETCH_ITEM': {
      const { originKey, end, clipId } = action.stretch
      const target = action.getItem(clipId)
      return {
        ...state,
        regions: recalculateRegions(
          state.regions,
          action.getItem,
          action.stretch.clipId,
          { ...target, [originKey]: end }
        )
      }
    }
    case 'DELETE_ITEM':
      return {
        ...state,
        regions: recalculateRegions(
          state.regions,
          action.getItem,
          action.item.id,
          null
        )
      }
    default:
      return state
  }
}
