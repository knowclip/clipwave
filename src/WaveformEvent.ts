import { MouseEvent } from 'react'
import { msToSeconds } from './utils'
import { WaveformItem, WaveformState } from './WaveformState'

export class WaveformMousedownEvent extends Event {
  milliseconds: number
  browserMousedown: MouseEvent<SVGElement>
  svg: SVGElement

  constructor(browserMousedown: MouseEvent<SVGElement>, milliseconds: number) {
    super('waveformMousedown')
    this.browserMousedown = browserMousedown
    this.svg = browserMousedown.currentTarget
    this.milliseconds = milliseconds
  }

  get seconds() {
    return msToSeconds(this.milliseconds)
  }
}

export class WaveformDragEvent extends Event {
  mouseDown: WaveformMousedownEvent
  gesture: WaveformGesture

  constructor(mouseDown: WaveformMousedownEvent, gesture: WaveformGesture) {
    super('waveformDrag')
    this.mouseDown = mouseDown
    this.gesture = gesture
  }
}

export type WaveformGestureOf<T extends WaveformGesture> = WaveformDragEvent & {
  gesture: T
}

export type WaveformGesture = WaveformDrag | ClipDrag | ClipStretch

export type WaveformDrag = {
  type: 'CREATE'
  start: number
  end: number
  overlaps: WaveformItem['id'][]
  waveformState: WaveformState
  timeStamp: number
}
export type ClipDrag = {
  type: 'MOVE'
  start: number
  end: number
  clipId: WaveformItem['id']
  regionIndex: number
  waveformState: WaveformState
  timeStamp: number
  overlaps: WaveformItem['id'][]
}
export type ClipStretch = {
  type: 'STRETCH'
  originKey: 'start' | 'end'
  start: number
  end: number
  clipId: string
  originRegionIndex: number
  /** -1 if not yet finished */
  finishRegionIndex: number
  waveformState: WaveformState
  timeStamp: number
  overlaps: WaveformItem['id'][]
}
