import { useCallback, useReducer, useRef, useEffect, useMemo } from 'react'
import {
  secondsToMs,
  pixelsToMs,
  setCursorX,
  msToSeconds,
  msToPixels,
  setCursorXAfterZoom
} from './utils'
import { useWaveformMediaTimeUpdate } from './useWaveformMediaTimeUpdate'
import { WaveformItem, WaveformRegion } from './WaveformState'
import { elementWidth } from './utils/elementWidth'
import { calculateRegions, recalculateRegions } from './utils/calculateRegions'
import { getRegionEnd } from './utils/getRegionEnd'
import { ClipDrag, ClipStretch } from './WaveformEvent'
import { waveformStateReducer, blankState } from './waveformStateReducer'
import {
  getNextWaveformItem,
  getPreviousWaveformItem,
  TestWaveformItem
} from './utils/waveformNavigation'
import { bound } from './utils/bound'

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
        Array.from(currentMissingIds).join(',  ')
      )
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        getItemDangerously,
        Array.from(currentMissingIds).map((id) => ({
          type: 'DELETE',
          itemId: id
        }))
      )
      const newSelection = {
        regionIndex: newSelectionRegion ?? state.selection.regionIndex,
        item: currentMissingIds.has(state.selection.item || '')
          ? null
          : state.selection.item
      }
      const selectionHasChanged =
        newSelection?.item !== state.selection?.item ||
        newSelection?.regionIndex !== state.selection.regionIndex

      if (regions !== state.regions || selectionHasChanged) {
        dispatch({
          type: 'SET_REGIONS',
          regions,
          newSelectionRegion
          // newSelection: selectionHasChanged ? newSelection : undefined
        })
      }
    }
  }, [
    getItemDangerously,
    missingItems.current.size,
    state.regions,
    state.selection
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
    [state.regions, state.selection, getItem, selectItemAndSeekTo]
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
    [state.regions, state.selection, getItem, selectItemAndSeekTo]
  )
  const zoom = useCallback(
    (deltaY: number) => {
      const newPixelsPerSecond = getPixelsPerSecondAfterZoom(
        state.pixelsPerSecond,
        deltaY
      )
      setCursorXAfterZoom(state.pixelsPerSecond, newPixelsPerSecond)
      if (svgRef.current)
        dispatch({
          type: 'ZOOM',
          newPixelsPerSecond,
          svgWidth: elementWidth(svgRef.current)
        })
    },
    [svgRef, state.pixelsPerSecond]
  )
  const clear = useCallback(() => {
    dispatch({
      type: 'RESET',
      durationSeconds: state.durationSeconds,
      regions: state.regions
    })
  }, [state.durationSeconds, state.regions])
  const addItem = useCallback(
    (item: WaveformItem) => {
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        (id) => (id === item.id ? item : getItemDangerously(id)),
        [{ type: 'CREATE', newItem: item }],
        item.start
      )

      dispatch({
        type: 'SET_REGIONS',
        regions,
        newSelectionRegion,
        newSelectionItemId: item.id
      })
    },
    [getItemDangerously, state.regions]
  )
  const addItems = useCallback(
    (items: WaveformItem[], newSelectionMs?: number) => {
      const itemsToAdd: Record<string, WaveformItem> = {}
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        (id) => getItemDangerously(id) || itemsToAdd[id],
        items.map((item) => {
          itemsToAdd[item.id] = item
          return { type: 'CREATE', newItem: item }
        }),
        newSelectionMs
      )
      dispatch({ type: 'SET_REGIONS', regions, newSelectionRegion })
    },
    [getItemDangerously, state.regions]
  )
  const deleteItem = useCallback(
    (id: string, newMs?: number) => {
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        getItemDangerously,
        [{ itemId: id, type: 'DELETE' }],
        newMs
      )
      dispatch({
        type: 'SET_REGIONS',
        regions,
        newSelectionRegion
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
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        getItemDangerously,
        [{ type: 'UPDATE', newItem: movedItem }]
      )
      dispatch({
        type: 'SET_REGIONS',
        regions,
        newSelectionRegion
      })
    },
    [getItemDangerously, state.regions]
  )
  const stretchItem = useCallback(
    (stretch: ClipStretch) => {
      const { originKey, end, clipId } = stretch
      const target = getItemDangerously(clipId)
      const { regions, newSelectionRegion } = recalculateRegions(
        state.regions,
        getItemDangerously,
        [{ type: 'UPDATE', newItem: { ...target, [originKey]: end } }]
      )
      dispatch({
        type: 'SET_REGIONS',
        regions,
        newSelectionRegion
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
      selectNextItemAndSeek,
      selectPreviousItemAndSeek,
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

function getPixelsPerSecondAfterZoom(
  pixelsPerSecond: number,
  mousewheelDeltaY: number
) {
  return bound(pixelsPerSecond + mousewheelDeltaY, [10, 200])
}
