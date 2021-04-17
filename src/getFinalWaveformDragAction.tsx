import { CLIP_THRESHOLD_MILLSECONDS, secondsToMs } from './utils'
import { WaveformInterface } from './useWaveform'
import { WaveformGesture } from './WaveformEvent'
import { bound } from './utils/bound'
import { getRegionEnd, overlap } from './utils/calculateRegions'

export function getFinalWaveformDragAction(
  pendingAction: WaveformGesture,
  ms: number,
  waveform: WaveformInterface
): WaveformGesture {
  const { state: waveformState } = waveform
  const end = ms

  const getOverlaps = (
    gestureCoordinates: { start: number; end: number },
    targetId?: string
  ) =>
    Array.from(
      waveform.reduceOnVisibleRegions((acc, region, index) => {
        let regionCoords: { start: number; end: number }
        region.itemIds.forEach((id) => {
          if (id === targetId) return

          regionCoords = regionCoords || {
            start: region.start,
            end: getRegionEnd(waveform.state.regions, index)
          }

          if (overlap(regionCoords, gestureCoordinates)) acc.add(id)
        })
        return acc
      }, new Set<string>())
    )

  switch (pendingAction.type) {
    case 'CREATE': {
      const gestureCoordinates = {
        // TODO: verify if this should this really be sorted here?
        start: Math.min(pendingAction.start, end),
        end: Math.max(pendingAction.start, end)
      }
      return {
        ...pendingAction,
        waveformState,
        ...gestureCoordinates,
        // bound?
        overlaps: getOverlaps(gestureCoordinates)
      }
    }
    case 'MOVE': {
      const {
        start,
        clip: { id: clipId }
      } = pendingAction
      const deltaX = end - start
      const regionsEnd = getRegionEnd(
        waveformState.regions,
        waveformState.regions.length - 1
      )
      const target = waveform.getItem(clipId)
      const boundedDeltaX = bound(deltaX, [
        0 - target.start,
        regionsEnd - target.end
      ])

      const gestureCoordinates = {
        start,
        end: start + boundedDeltaX
      }

      return {
        ...pendingAction,
        waveformState,
        ...gestureCoordinates,
        overlaps: getOverlaps(gestureCoordinates)
      }
    }
    case 'STRETCH': {
      const { clipId, originKey } = pendingAction
      const clipToStretch = waveform.getItem(clipId)
      const bounds: [number, number] =
        originKey === 'start'
          ? [0, clipToStretch.end - CLIP_THRESHOLD_MILLSECONDS]
          : [
              clipToStretch.start + CLIP_THRESHOLD_MILLSECONDS,
              secondsToMs(waveformState.durationSeconds)
            ]
      const gestureCoordinates = {
        start: pendingAction.start,
        end: bound(pendingAction.end, bounds)
      }
      return {
        ...pendingAction,
        waveformState,
        ...gestureCoordinates,
        overlaps: getOverlaps(gestureCoordinates)
      }
    }
  }
}
