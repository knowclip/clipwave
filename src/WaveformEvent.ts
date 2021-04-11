import { MouseEvent } from 'react'
import { msToSeconds } from './utils'
import { WaveformItem, WaveformState } from './WaveformState'

const isNode = new Function(
  'try {return this===global;}catch(e){return false;}'
)

if (isNode()) (global as any).Event = Object

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
  action: WaveformDragAction

  constructor(mouseDown: WaveformMousedownEvent, action: WaveformDragAction) {
    super('waveformDrag')
    this.mouseDown = mouseDown
    this.action = action
  }
}

export type WaveformDragOf<T extends WaveformDragAction> = WaveformDragEvent & {
  action: T
}

export type WaveformDragAction =
  | WaveformDragCreate
  | WaveformDragMove
  | WaveformDragStretch

export type WaveformDragCreate = {
  type: 'CREATE'
  start: number
  end: number
  waveformState: WaveformState
  timeStamp: number
}
export type WaveformDragMove = {
  type: 'MOVE'
  start: number
  end: number
  clip: WaveformItem
  regionIndex: number
  waveformState: WaveformState
  timeStamp: number
}
export type WaveformDragStretch = {
  type: 'STRETCH'
  originKey: 'start' | 'end'
  start: number
  end: number
  clipId: string
  regionIndex: number
  waveformState: WaveformState
  timeStamp: number
}
