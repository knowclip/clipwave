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
  action: WaveformGesture

  constructor(mouseDown: WaveformMousedownEvent, action: WaveformGesture) {
    super('waveformDrag')
    this.mouseDown = mouseDown
    this.action = action
  }
}

export type WaveformGestureOf<T extends WaveformGesture> = WaveformDragEvent & {
  action: T
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
  clip: WaveformItem
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
  regionIndex: number
  waveformState: WaveformState
  timeStamp: number
  overlaps: WaveformItem['id'][]
}
