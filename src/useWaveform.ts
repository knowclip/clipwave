import { useCallback, useReducer, useRef, useEffect, useMemo } from 'react'
import {
  secondsToMs,
  pixelsToMs,
  setCursorX,
  msToSeconds,
  msToPixels
} from './utils'
import {
  useWaveformMediaTimeUpdate,
  getNewWaveformSelectionAt
} from './useWaveformMediaTimeUpdate'
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

export type GetWaveformItem = (id: string) => WaveformItem | null
export type GetWaveformItemDangerously = (id: string) => WaveformItem

export function useWaveform(getItemFn: GetWaveformItem) {
  const missingItems = useRef(new Set<WaveformItem['id']>())
  const getItem = useCallback(
    (id: string) => {
      const item = getItemFn(id)
      if (!item) missingItems.current.add(id)
      return item
    },
    [getItemFn]
  )
  const getItemDangerously = useCallback((id: string) => getItemFn(id)!, [
    getItemFn
  ])
  const svgRef = useRef<SVGSVGElement>(null)
  const [state, dispatch] = useReducer(waveformStateReducer, blankState)
  const selection = useMemo(() => {
    return {
      selection: state.selection,
      item: state.selection.item ? getItem(state.selection.item) : null,
      region: (state.regions[state.selection.regionIndex] ||
        null) as WaveformRegion | null
    }
  }, [getItem, state.regions, state.selection])

  useEffect(() => {
    if (missingItems.current.size) {
      const currentMissingIds = missingItems.current
      missingItems.current = new Set()
      console.log(
        'clipwave deleting missing items: ',
        [...currentMissingIds].join(',  ')
      )
      const regions = recalculateRegions(
        state.regions,
        getItemDangerously,
        Array.from(currentMissingIds).map((id) => ({ id, newItem: null }))
      )
      if (regions !== state.regions) {
        const currentRegion = state.regions[state.selection.regionIndex]
        const newSelection = getNewWaveformSelectionAt(
          getItemDangerously,
          regions,
          currentRegion.start,
          state.selection
        )
        console.log({ newSelection })
        dispatch({
          type: 'SET_REGIONS',
          regions,
          // TODO: calculate this in recalculateRegions to avoid extra loop
          newSelection
        })
      }
    }
  }, [
    getItemDangerously,
    missingItems.current.size,
    state.regions,
    state.selection,
    state.selection.item
  ])

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
      (regionIndex: number, itemId: WaveformItem['id']) => {
        dispatch({
          type: 'SELECT_ITEM',
          itemId,
          regionIndex
        })
      },
      []
    ),
    selectItemAndSeekTo: useCallback(
      (
        regionIndex: number,
        itemId: WaveformItem['id'],
        player: HTMLVideoElement | HTMLAudioElement | null,
        newTimeMilliseconds: number
      ) => {
        dispatch({
          type: 'SELECT_ITEM',
          itemId,
          regionIndex
        })
        const newTimeSeconds = msToSeconds(newTimeMilliseconds)
        if (player && player.currentTime !== newTimeSeconds) {
          if (!player.paused)
            selectionDoesntNeedSetAtNextTimeUpdate.current = true
          setCursorX(msToPixels(newTimeMilliseconds, state.pixelsPerSecond))
          player.currentTime = newTimeSeconds
        }
      },
      [state.pixelsPerSecond]
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
          regions: recalculateRegions(state.regions, getItemDangerously, [
            { id, newItem: null }
          ])
        })
      },
      [getItemDangerously, state.regions]
    ),
    moveItem: useCallback(
      (move: ClipDrag) => {
        const { start, end, clipId } = move
        const delta = end - start
        const target = getItemDangerously(clipId)
        const movedItem = {
          ...target,
          start: target.start + delta,
          end: target.end + delta
        }
        dispatch({
          type: 'SET_REGIONS',
          regions: recalculateRegions(state.regions, getItemDangerously, [
            { id: target.id, newItem: movedItem }
          ])
        })
      },
      [getItemDangerously, state.regions]
    ),
    stretchItem: useCallback(
      (stretch: ClipStretch) => {
        const { originKey, end, clipId } = stretch
        const target = getItemDangerously(clipId)
        dispatch({
          type: 'SET_REGIONS',
          regions: recalculateRegions(state.regions, getItemDangerously, [
            { id: clipId, newItem: { ...target, [originKey]: end } }
          ])
        })
      },
      [getItemDangerously, state.regions]
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
    getItemDangerously,
    actions,
    reduceOnVisibleRegions,
    getSelection: useCallback(() => selection, [selection])
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
