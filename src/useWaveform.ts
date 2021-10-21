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
import {
  getNextWaveformItem,
  getPreviousWaveformItem,
  TestWaveformItem
} from './utils/waveformNavigation'

export type WaveformInterface = ReturnType<typeof useWaveform>

export type GetWaveformItem = (id: string) => WaveformItem | null
export type GetWaveformItemDangerously = (id: string) => WaveformItem

export function useWaveform(
  getItemFn: GetWaveformItem,
  id: string = 'waveform'
) {
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
        console.warn({ newSelection })
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

  const resetWaveformState = useCallback(
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
  )

  const selectItem = useCallback(
    (regionIndex: number, itemId: WaveformItem['id']) => {
      dispatch({
        type: 'SELECT_ITEM',
        itemId,
        regionIndex
      })
    },
    []
  )
  const selectItemAndSeekTo = useCallback(
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
  )
  const selectPreviousItemAndSeek = useCallback(
    (
      player: HTMLVideoElement | HTMLAudioElement | null,
      test?: TestWaveformItem
    ) => {
      const previousItem = getPreviousWaveformItem(
        state.regions,
        state.selection,
        getItem,
        test
      )
      if (previousItem?.item)
        selectItemAndSeekTo(
          previousItem.regionIndex,
          previousItem.item.id,
          player,
          previousItem.item.start
        )
    },
    [state.regions, state.selection, getItem]
  )
  const selectNextItemAndSeek = useCallback(
    (
      player: HTMLVideoElement | HTMLAudioElement | null,
      test?: TestWaveformItem
    ) => {
      const nextItem = getNextWaveformItem(
        state.regions,
        state.selection,
        getItem,
        test
      )
      if (nextItem?.item)
        selectItemAndSeekTo(
          nextItem.regionIndex,
          nextItem.item.id,
          player,
          nextItem.item.start
        )
    },
    [state.regions, state.selection, getItem]
  )
  const zoom = useCallback((deltaY: number) => {
    if (svgRef.current)
      dispatch({
        type: 'ZOOM',
        delta: deltaY,
        svgWidth: elementWidth(svgRef.current)
      })
  }, [])
  const clear = useCallback(() => {
    dispatch({
      type: 'RESET',
      durationSeconds: state.durationSeconds,
      regions: state.regions
    })
  }, [state.durationSeconds, state.regions])
  const addItem = useCallback(
    (item: WaveformItem) => {
      const newRegions = newRegionsWithItems(state.regions, [item])
      dispatch({
        type: 'SET_REGIONS',
        regions: newRegions,
        newSelection: {
          regionIndex: newRegions.findIndex(
            (r, i) =>
              item.start >= r.start && item.end < getRegionEnd(newRegions, i)
          ),
          item: item.id
        }
      })
    },
    [state.regions]
  )
  const addItems = useCallback(
    (items: WaveformItem[]) => {
      dispatch({
        type: 'SET_REGIONS',
        regions: newRegionsWithItems(state.regions, items)
      })
    },
    [state.regions]
  )
  const deleteItem = useCallback(
    (id: string) => {
      dispatch({
        type: 'SET_REGIONS',
        regions: recalculateRegions(state.regions, getItemDangerously, [
          { id, newItem: null }
        ])
      })
    },
    [getItemDangerously, state.regions]
  )
  const moveItem = useCallback(
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
  )
  const stretchItem = useCallback(
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

  const getSelection = useCallback(() => selection, [selection])
  const onTimeUpdate = useWaveformMediaTimeUpdate(
    svgRef,
    selectionDoesntNeedSetAtNextTimeUpdate,
    dispatch,
    getItem,
    regions,
    state
  )

  const waveformInterface = useMemo(
    () => ({
      svgRef,
      state,
      dispatch,
      getItem,
      getItemDangerously,
      reduceOnVisibleRegions,
      getSelection,
      onTimeUpdate,
      actions: {
        resetWaveformState,
        selectItem,
        selectItemAndSeekTo,
        selectPreviousItemAndSeek,
        selectNextItemAndSeek,
        zoom,
        clear,
        addItem,
        addItems,
        deleteItem,
        moveItem,
        stretchItem
      }
    }),
    [
      addItem,
      addItems,
      clear,
      deleteItem,
      getItem,
      getItemDangerously,
      getSelection,
      moveItem,
      onTimeUpdate,
      reduceOnVisibleRegions,
      resetWaveformState,
      selectItem,
      selectItemAndSeekTo,
      state,
      stretchItem,
      zoom
    ]
  )

  useEffect(() => {
    const handler = (e: ClipwaveCallbackEvent) => {
      if (e.waveformId === id) e.callback(waveformInterface)
    }
    window.addEventListener(
      ClipwaveCallbackEvent.label,
      handler as EventListener
    )
    return () =>
      window.removeEventListener(
        ClipwaveCallbackEvent.label,
        handler as EventListener
      )
  }, [id, waveformInterface])

  return waveformInterface
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

export class ClipwaveCallbackEvent extends Event {
  waveformId: string
  callback: (waveform: WaveformInterface) => void

  static label = 'clipwave-callback' as const

  constructor(
    waveformId: string,
    callback: (waveform: WaveformInterface) => void
  ) {
    super(ClipwaveCallbackEvent.label)
    this.waveformId = waveformId
    this.callback = callback
  }
}
