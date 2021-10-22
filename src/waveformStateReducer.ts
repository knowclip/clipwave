import { pixelsToMs, secondsToMs } from './utils'
import { WaveformState } from './WaveformState'
import { bound } from './utils/bound'
import { WaveformAction } from './WaveformAction'
import { WaveformRegion } from '.'

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
      const { newPixelsPerSecond } = action
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
          Math.max(0, secondsToMs(state.durationSeconds) - newVisibleTimeSpan)
        ])
      }
    }

    case 'SELECT_ITEM':
      return {
        ...state,
        selection: {
          regionIndex: action.regionIndex,
          item: action.itemId
        }
      }

    case 'SET_REGIONS': {
      const newRegionIndex = getValidNewRegionIndex(
        action.regions,
        action.newSelectionRegion,
        state.selection.regionIndex
      )
      const newSelectionItemCandidate =
        action.newSelectionItemId || state.selection.item
      return {
        ...state,
        regions: action.regions,
        selection: {
          regionIndex: newRegionIndex,
          item:
            newSelectionItemCandidate &&
            getValidNewItemId(
              action.regions,
              newRegionIndex,
              newSelectionItemCandidate
            )
        }
      }
    }

    default:
      return state
  }
}

function getValidNewRegionIndex(
  regions: WaveformRegion[],
  newRegionIndex: number | undefined,
  currentRegionIndex: number
) {
  if (typeof newRegionIndex == 'number' && regions[newRegionIndex])
    return newRegionIndex
  if (typeof currentRegionIndex == 'number' && regions[currentRegionIndex])
    return currentRegionIndex
  return 0 // TODO: make sure 0 regions won't happen
}
function getValidNewItemId(
  regions: WaveformRegion[],
  validNewRegionIndex: number,
  itemIdCandidate: string
) {
  const region = regions[validNewRegionIndex]
  return region.itemIds.includes(itemIdCandidate) ? itemIdCandidate : null
}
