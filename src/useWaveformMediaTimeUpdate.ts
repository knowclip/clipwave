import { MutableRefObject, Dispatch, useCallback } from 'react'
import { GetWaveformItem } from './useWaveform'
import { WaveformAction } from './WaveformAction'
import {
  secondsToMs,
  setCursorX,
  msToPixels,
  msToSeconds,
  pixelsToMs
} from './utils'
import { bound } from './utils/bound'
import { elementWidth } from './utils/elementWidth'
import { WaveformItem, WaveformRegion, WaveformState } from './WaveformState'
import { getNewWaveformSelectionAt } from './utils/getNewWaveformSelectionAt'

const HALF_SECOND = 500
export const overlapsSignificantly = (
  chunk: { start: number; end: number },
  start: number,
  end: number
): boolean =>
  start <= chunk.end - HALF_SECOND && end >= chunk.start + HALF_SECOND

export function useWaveformMediaTimeUpdate(
  svgRef: MutableRefObject<SVGElement | null>,
  selectionDoesntNeedSetAtNextTimeUpdate: MutableRefObject<boolean>,
  dispatch: Dispatch<WaveformAction>,
  getItem: GetWaveformItem,
  regions: WaveformRegion[],
  state: WaveformState
) {
  return useCallback(
    (
      media: HTMLVideoElement | HTMLAudioElement,
      seeking: MutableRefObject<boolean>,
      looping: boolean
    ) => {
      const wasSeeking = seeking.current
      seeking.current = false

      const svg = svgRef.current
      if (!svg) return console.error('Svg disappeared')

      const newMilliseconds = secondsToMs(media.currentTime)
      const currentSelection = state.selection
      const currentSelectedItem = state.selection.item
        ? getItem(state.selection.item)
        : null

      if (selectionDoesntNeedSetAtNextTimeUpdate.current) {
        selectionDoesntNeedSetAtNextTimeUpdate.current = false
        setCursorX(msToPixels(newMilliseconds, state.pixelsPerSecond))

        return
      }

      const loopImminent =
        !wasSeeking &&
        looping &&
        !media.paused &&
        currentSelectedItem &&
        newMilliseconds >= currentSelectedItem.end
      if (loopImminent && currentSelectedItem) {
        media.currentTime = msToSeconds(currentSelectedItem.start)
        return dispatch({
          type: 'NAVIGATE_TO_TIME',
          ms: currentSelectedItem.start,
          viewBoxStartMs: state.viewBoxStartMs,
          selection: currentSelection
        })
      }

      const newSelectionCandidate = getNewWaveformSelectionAt(
        getItem,
        regions,
        newMilliseconds,
        currentSelection
      )

      const newSelection = isValidNewSelection(
        currentSelectedItem,
        newSelectionCandidate.item ? getItem(newSelectionCandidate.item) : null
      )
        ? newSelectionCandidate
        : null
      const newSelectionItem = newSelection?.item
        ? getItem(newSelection.item)
        : null

      const svgWidth = elementWidth(svg)

      setCursorX(msToPixels(newMilliseconds, state.pixelsPerSecond))
      dispatch({
        type: 'NAVIGATE_TO_TIME',
        ms: newMilliseconds,
        selection:
          !wasSeeking && !newSelectionItem
            ? currentSelection
            : newSelection || currentSelection,
        viewBoxStartMs: viewBoxStartMsOnTimeUpdate(
          state,
          newMilliseconds,
          svgWidth,
          newSelectionItem,
          wasSeeking
        )
      })
    },
    [
      svgRef,
      state,
      selectionDoesntNeedSetAtNextTimeUpdate,
      getItem,
      regions,
      dispatch
    ]
  )
}

function isValidNewSelection(
  currentSelection: WaveformItem | null,
  newSelectionCandidate: WaveformItem | null
) {
  // TODO: get rid of this knowclip-specific logic
  if (
    currentSelection &&
    currentSelection.clipwaveType === 'Primary' &&
    newSelectionCandidate &&
    newSelectionCandidate.clipwaveType === 'Secondary'
  ) {
    return overlapsSignificantly(
      newSelectionCandidate,
      currentSelection.start,
      currentSelection.end
    )
      ? false
      : true
  }

  return true
}

function viewBoxStartMsOnTimeUpdate(
  state: WaveformState,
  newlySetMs: number,
  svgWidth: number,
  newSelectionItem: WaveformItem | null,
  seeking: boolean
): number {
  if (state.pendingAction) return state.viewBoxStartMs
  const visibleTimeSpan = pixelsToMs(svgWidth, state.pixelsPerSecond)
  const buffer = Math.round(visibleTimeSpan * 0.1)

  const { viewBoxStartMs, durationSeconds } = state
  const durationMs = secondsToMs(durationSeconds)
  const currentRightEdge = viewBoxStartMs + visibleTimeSpan

  if (seeking && newSelectionItem) {
    if (newSelectionItem.end + buffer >= currentRightEdge)
      return bound(newSelectionItem.end + buffer - visibleTimeSpan, [
        0,
        durationMs - visibleTimeSpan
      ])

    if (newSelectionItem.start - buffer <= viewBoxStartMs)
      return Math.max(0, newSelectionItem.start - buffer)
  }

  const leftShiftRequired = newlySetMs < viewBoxStartMs
  if (leftShiftRequired) {
    return Math.max(0, newlySetMs)
  }

  const rightShiftRequired = newlySetMs >= currentRightEdge
  if (rightShiftRequired) {
    return bound(newlySetMs, [0, durationMs - visibleTimeSpan])
  }

  return state.viewBoxStartMs
}
