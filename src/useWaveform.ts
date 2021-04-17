import { useCallback, useReducer, useRef } from 'react'
import { secondsToMs, pixelsToMs } from './utils'
import { useWaveformMediaTimeUpdate } from './useWaveformMediaTimeUpdate'
import { WaveformItem, WaveformRegion, WaveformState } from './WaveformState'
import { elementWidth } from './utils/elementWidth'
import { calculateRegions, getRegionEnd } from './utils/calculateRegions'
import { ClipDrag, ClipStretch } from './WaveformEvent'
import { waveformStateReducer } from './waveformStateReducer'

export const blankState: WaveformState = {
  cursorMs: 0,
  durationSeconds: 0,
  viewBoxStartMs: 0,
  pixelsPerSecond: 50,
  selection: null,
  pendingAction: null,
  regions: []
}

// const getInitialState = (
//   getInitialSortedItems: () => WaveformItem[],
//   durationSeconds: number
// ): WaveformState => {
//   const sortedItems = getInitialSortedItems()
//   const { waveformItemsMap: _, regions } = calculateRegions(
//     sortedItems,
//     secondsToMs(durationSeconds)
//   )
//   return { ...blankState, regions }
// }

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
          type: 'ADD_ITEM',
          getItem,
          item
        })
      },
      [getItem]
    ),
    /** TODO: add multiple at once */
    addItems: useCallback(() => {}, []),
    deleteItem: useCallback(
      (id: string) => {
        dispatch({
          type: 'DELETE_ITEM',
          item: getItem(id),
          getItem
        })
      },
      [getItem]
    ),
    moveItem: useCallback(
      (move: ClipDrag) => {
        dispatch({
          type: 'MOVE_ITEM',
          move,
          getItem
        })
      },
      [getItem]
    ),
    stretchItem: useCallback(
      (stretch: ClipStretch) => {
        dispatch({
          type: 'STRETCH_ITEM',
          stretch,
          getItem
        })
      },
      [getItem]
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
    regions,
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
