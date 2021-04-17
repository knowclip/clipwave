import { useCallback, useReducer, useRef } from 'react'
import { secondsToMs, pixelsToMs } from './utils'
import { useWaveformMediaTimeUpdate } from './useWaveformMediaTimeUpdate'
import { WaveformItem, WaveformRegion } from './WaveformState'
import { elementWidth } from './utils/elementWidth'
import {
  calculateRegions,
  getRegionEnd,
  newRegionsWithItems,
  recalculateRegions
} from './utils/calculateRegions'
import { ClipDrag, ClipStretch } from './WaveformEvent'
import { waveformStateReducer, blankState } from './waveformStateReducer'

export type WaveformInterface = ReturnType<typeof useWaveform>

export type GetWaveformItem = (id: string) => WaveformItem

export function useWaveform(getItem: GetWaveformItem) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [state, dispatch] = useReducer(waveformStateReducer, blankState)

  const { regions } = state

  const selectionDoesntNeedSetAtNextTimeUpdate = useRef(false)

  const actions = {
    resetWaveformState: useCallback(
      (
        media: HTMLVideoElement | HTMLAudioElement | null,
        sortedWaveformItems: WaveformItem[]
      ) => {
        const durationSeconds = media?.duration || 0
        const { regions } = calculateRegions(
          sortedWaveformItems,
          secondsToMs(durationSeconds)
        )
        dispatch({ type: 'RESET', durationSeconds, regions })
      },
      []
    ),
    selectItem: useCallback(
      (region: WaveformRegion, item: WaveformItem) => {
        dispatch({
          type: 'SELECT_ITEM',
          region,
          item,
          regionIndex: regions.indexOf(region)
        })
      },
      [regions]
    ),
    zoom: useCallback((deltaY: number) => {
      if (svgRef.current)
        dispatch({
          type: 'ZOOM',
          delta: deltaY,
          svgWidth: elementWidth(svgRef.current)
        })
    }, []),
    clear: useCallback(() => {
      dispatch({
        type: 'RESET',
        durationSeconds: state.durationSeconds,
        regions: state.regions
      })
    }, [state.durationSeconds, state.regions]),
    addItem: useCallback(
      (item: WaveformItem) => {
        dispatch({
          type: 'SET_REGIONS',
          regions: newRegionsWithItems(state.regions, [item])
        })
      },
      [state.regions]
    ),
    addItems: useCallback(
      (items: WaveformItem[]) => {
        dispatch({
          type: 'SET_REGIONS',
          regions: newRegionsWithItems(state.regions, items)
        })
      },
      [state.regions]
    ),
    deleteItem: useCallback(
      (id: string) => {
        dispatch({
          type: 'SET_REGIONS',
          regions: recalculateRegions(state.regions, getItem, [
            { id, newItem: null }
          ])
        })
      },
      [getItem, state.regions]
    ),
    moveItem: useCallback(
      (move: ClipDrag) => {
        const { start, end, clip } = move
        const delta = end - start
        const target = getItem(clip.id)
        const movedItem = {
          ...target,
          start: target.start + delta,
          end: target.end + delta
        }
        dispatch({
          type: 'SET_REGIONS',
          regions: recalculateRegions(state.regions, getItem, [
            { id: target.id, newItem: movedItem }
          ])
        })
      },
      [getItem, state.regions]
    ),
    stretchItem: useCallback(
      (stretch: ClipStretch) => {
        const { originKey, end, clipId } = stretch
        const target = getItem(clipId)
        dispatch({
          type: 'SET_REGIONS',
          regions: recalculateRegions(state.regions, getItem, [
            { id: clipId, newItem: { ...target, [originKey]: end } }
          ])
        })
      },
      [getItem, state.regions]
    )
  }

  const reduceOnVisibleRegions: ReduceOnVisibleRegions = useCallback(
    (callback, initialAccumulator) => {
      const { viewBoxStartMs, pixelsPerSecond } = state

      return reduceWhile(
        regions,
        initialAccumulator,
        (region) =>
          region.start <=
          viewBoxStartMs +
            pixelsToMs(MAX_WAVEFORM_VIEWPORT_WIDTH, pixelsPerSecond),
        (acc, region, regionIndex) => {
          if (getRegionEnd(regions, regionIndex) < viewBoxStartMs) {
            return acc
          }

          return callback(acc, region, regionIndex)
        }
      )
    },
    [regions, state]
  )

  const waveformInterface = {
    svgRef,
    state,
    dispatch,
    getItem,
    selectionDoesntNeedSetAtNextTimeUpdate,
    actions,
    reduceOnVisibleRegions
  }

  return {
    onTimeUpdate: useWaveformMediaTimeUpdate(
      svgRef,
      selectionDoesntNeedSetAtNextTimeUpdate,
      dispatch,
      getItem,
      regions,
      state
    ),
    ...waveformInterface
  }
}

export const MAX_WAVEFORM_VIEWPORT_WIDTH = 3000

type ReduceOnVisibleRegions = <T>(
  callback: (accumulator: T, region: WaveformRegion, regionIndex: number) => T,
  initialAccumulator: T
) => T

function reduceWhile<T, U>(
  arr: T[],
  acc: U,
  test: (element: T, index: number) => boolean,
  reducer: (acc: U, element: T, index: number) => U
) {
  let currentAcc = acc
  for (let i = 0; i < arr.length && test(arr[i], i); i++) {
    currentAcc = reducer(currentAcc, arr[i], i)
  }

  return currentAcc
}
