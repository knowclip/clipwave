import { SELECTION_BORDER_MILLISECONDS } from './utils'
import { WaveformInterface } from './useWaveform'
import { WaveformMousedownEvent, WaveformDragAction } from './WaveformEvent'

export function getWaveformMousedownAction(
  dataset: DOMStringMap,
  event: WaveformMousedownEvent,
  waveform: WaveformInterface
): WaveformDragAction {
  const { state, getItem } = waveform
  const ms = event.milliseconds
  const timeStamp = event.timeStamp

  // could be NaN
  const start = Number(dataset.clipStart)
  const end = Number(dataset.clipEnd)
  if (
    dataset &&
    dataset.clipId &&
    (Math.abs(start - ms) <= SELECTION_BORDER_MILLISECONDS ||
      Math.abs(end - ms) <= SELECTION_BORDER_MILLISECONDS)
  ) {
    return {
      type: 'STRETCH',
      start: ms,
      end: ms,
      originKey: Math.abs(ms - start) < Math.abs(ms - end) ? 'start' : 'end',
      regionIndex: Number(dataset.regionIndex),
      clipId: dataset.clipId,
      waveformState: state,
      timeStamp
    }
  } else if (dataset && dataset.clipId)
    return {
      type: 'MOVE',
      start: ms,
      end: ms,
      clip: getItem(dataset.clipId),
      regionIndex: Number(dataset.regionIndex),
      waveformState: state,
      timeStamp
    }
  else
    return {
      type: 'CREATE',
      start: ms,
      end: ms,
      waveformState: state,
      timeStamp
    }
}
