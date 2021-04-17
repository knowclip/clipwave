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
        overlaps: getOverlaps(gestureCoordinates, null)
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

      return {
        ...pendingAction,
        waveformState,
        start,
        end: start + boundedDeltaX,
        overlaps: getOverlaps(
          {
            start: Math.min(pendingAction.start, pendingAction.clip.start),
            end: Math.max(pendingAction.end, pendingAction.clip.end)
          },
          clipId
        )
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
        start: Math.min(pendingAction.start, clipToStretch.start),
        end: Math.max(pendingAction.end, clipToStretch.end)
      }
      return {
        ...pendingAction,
        waveformState,
        ...gestureCoordinates,
        end: bound(pendingAction.end, bounds),
        overlaps: getOverlaps(gestureCoordinates, clipId)
      }
    }
  }
}
