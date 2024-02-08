import { CLIP_THRESHOLD_MILLSECONDS, secondsToMs } from './utils'
import { WaveformInterface } from './useWaveform'
import { WaveformGesture } from './WaveformEvent'
import { bound } from './utils/bound'
import { getRegionEnd, overlap } from './utils/getRegionEnd'
import { WaveformRegion } from './WaveformState'

export function getFinalWaveformDragAction(
  pendingAction: WaveformGesture,
  ms: number,
  waveform: WaveformInterface
): WaveformGesture {
  const { state: waveformState } = waveform
  const end = ms

  const getOverlaps = (
    gestureCoordinates: { start: number; end: number },
    targetId: string | null
  ) =>
    Array.from(
      waveform.reduceOnVisibleRegions((acc, region, index) => {
        const regionCoords = {
          start: region.start,
          end: getRegionEnd(waveform.state.regions, index)
        }
        if (overlap(regionCoords, gestureCoordinates))
          region.itemIds.forEach((id) => {
            if (id !== targetId) acc.add(id)
          })
        return acc
      }, new Set<string>())
    )

  switch (pendingAction.type) {
    case 'CREATE': {
      return {
        ...pendingAction,
        waveformState,
        start: pendingAction.start,
        end: pendingAction.end,
        // bound?
        overlaps: getOverlaps(
          {
            start: Math.min(pendingAction.start, end),
            end: Math.max(pendingAction.start, end)
          },
          null
        )
      }
    }
    case 'MOVE': {
      const { start, clipId } = pendingAction
      const deltaX = end - start
      const regionsEnd = getRegionEnd(
        waveformState.regions,
        waveformState.regions.length - 1
      )
      const target = waveform.getItemDangerously(clipId)
      const boundedDeltaX = bound(deltaX, [
        0 - target.start,
        regionsEnd - target.end
      ])

      return {
        ...pendingAction,
        waveformState,
        start,
        end: start + boundedDeltaX,
        overlaps: getOverlaps(
          {
            start: Math.min(target.start, target.start + boundedDeltaX),
            end: Math.max(target.end, target.end + boundedDeltaX)
          },
          clipId
        )
      }
    }
    case 'STRETCH': {
      const { clipId, originKey } = pendingAction
      const clipToStretch = waveform.getItemDangerously(clipId)
      const bounds: [number, number] =
        originKey === 'start'
          ? [0, clipToStretch.end - CLIP_THRESHOLD_MILLSECONDS]
          : [
              clipToStretch.start + CLIP_THRESHOLD_MILLSECONDS,
              secondsToMs(waveformState.durationSeconds)
            ]

      const stretchEnd = bound(pendingAction.end, bounds)

      return {
        ...pendingAction,
        waveformState,
        end: stretchEnd,
        finishRegionIndex: waveform.state.regions.findIndex(
          (r) => r.start >= pendingAction.end
        ), // TODO: optimize
        overlaps: getOverlaps(
          {
            start: Math.min(clipToStretch.start, stretchEnd),
            end: Math.max(clipToStretch.end, stretchEnd)
          },
          clipId
        )
      }
    }
  }
}
