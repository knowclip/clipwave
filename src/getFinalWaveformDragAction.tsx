import { CLIP_THRESHOLD_MILLSECONDS, secondsToMs } from './utils'
import { WaveformInterface } from './useWaveform'
import { WaveformDragAction } from './WaveformEvent'
import { bound } from './utils/bound'
import { getRegionEnd } from './utils/calculateRegions'

export function getFinalWaveformDragAction(
  pendingAction: WaveformDragAction,
  ms: number,
  waveform: WaveformInterface
): WaveformDragAction {
  const { state: waveformState } = waveform
  const end = ms
  switch (pendingAction.type) {
    case 'CREATE': {
      const { start } = pendingAction
      return {
        ...pendingAction,
        waveformState,
        start: Math.min(start, end),
        // bound?
        end: Math.max(start, end)
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
        end: start + boundedDeltaX
      }
    }
    case 'STRETCH': {
      const { clipId, end, originKey } = pendingAction
      const clipToStretch = waveform.getItem(clipId)
      const bounds: [number, number] =
        originKey === 'start'
          ? [0, clipToStretch.end - CLIP_THRESHOLD_MILLSECONDS]
          : [
              clipToStretch.start + CLIP_THRESHOLD_MILLSECONDS,
              secondsToMs(waveformState.durationSeconds)
            ]
      const stretchEnd = bound(end, bounds)
      return {
        ...pendingAction,
        waveformState,
        end: stretchEnd
      }
    }
  }
}
