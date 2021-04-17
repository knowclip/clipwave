import React, { ReactNode } from 'react'
import {
  msToPixels,
  pixelsToMs,
  secondsToMs,
  secondsToPixels,
  WAVEFORM_HEIGHT
} from './utils'
import { GetWaveformItem, WaveformInterface } from './useWaveform'
import {
  EventHandler,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef
} from 'react'
import {
  WaveformMousedownEvent,
  WaveformGesture,
  WaveformDrag,
  WaveformDragEvent,
  ClipDrag,
  WaveformGestureOf,
  ClipStretch
} from './WaveformEvent'
import { WaveformItem } from './WaveformState'
import css from './Waveform.module.scss'
import { getClipRectProps } from './getClipRectProps'
import { Clips } from './WaveformClips'
import { getFinalWaveformDragAction } from './getFinalWaveformDragAction'
import { SecondaryClipDisplayProps } from './SecondaryClipDisplayProps'
import { getWaveformMousedownAction } from './getWaveformMousedownAction'

type WaveformEventHandlers = {
  onWaveformDrag?: (event: WaveformGestureOf<WaveformDrag>) => void
  onClipDrag?: (event: WaveformGestureOf<ClipDrag>) => void
  onClipEdgeDrag?: (event: WaveformGestureOf<ClipStretch>) => void
  onClipDoubleClick?: (clip: WaveformItem) => void
  onMouseWheel?: React.WheelEventHandler
}

export type RenderSecondaryClip = (
  options: SecondaryClipDisplayProps
) => ReactNode

export default function Waveform({
  waveform,
  images,
  playerRef,
  height = WAVEFORM_HEIGHT,
  renderSecondaryClip,
  ...waveformEventHandlers
}: {
  waveform: WaveformInterface
  images: { url: string; startSeconds: number; endSeconds: number }[]
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>
  height?: number
  renderSecondaryClip?: RenderSecondaryClip
} & WaveformEventHandlers) {
  const {
    viewBoxStartMs,
    durationSeconds,
    pixelsPerSecond,
    pendingAction
  } = waveform.state
  const { handleMouseDown, pendingActionRef } = useWaveformMouseActions({
    waveform,
    playerRef,
    ...waveformEventHandlers
  })

  const handleMouseWheel: React.WheelEventHandler<SVGSVGElement> = useCallback(
    (e) => {
      if (waveformEventHandlers.onMouseWheel)
        waveformEventHandlers.onMouseWheel(e)
      else {
        waveform.actions.zoom(e.deltaY)
      }
    },
    [waveform.actions, waveformEventHandlers]
  )

  return (
    <svg
      ref={waveform.svgRef}
      viewBox={getViewBoxString(
        msToPixels(viewBoxStartMs, pixelsPerSecond),
        height
      )}
      height={height}
      style={{ background: 'gray', alignSelf: 'flex-start', width: '100%' }}
      preserveAspectRatio='xMinYMin slice'
      onMouseDown={handleMouseDown}
      onWheel={handleMouseWheel}
    >
      <g>
        <rect
          fill='#222222'
          x={0}
          y={0}
          width={secondsToPixels(durationSeconds, pixelsPerSecond)}
          height={height}
        />
        <Clips
          getItem={waveform.getItem}
          reduceOnVisibleRegions={waveform.reduceOnVisibleRegions}
          height={height}
          state={waveform.state}
          renderSecondaryClip={renderSecondaryClip}
        />
        {pendingAction && (
          <PendingWaveformItem
            action={pendingAction}
            height={height}
            rectRef={pendingActionRef}
            pixelsPerSecond={pixelsPerSecond}
            getItem={waveform.getItem}
          />
        )}
      </g>
      {images.map(({ url, startSeconds, endSeconds }) => {
        return (
          <image
            key={url}
            xlinkHref={url}
            style={{ pointerEvents: 'none' }}
            x={secondsToPixels(startSeconds, pixelsPerSecond)}
            preserveAspectRatio='none'
            width={secondsToPixels(endSeconds - startSeconds, pixelsPerSecond)}
            height={WAVEFORM_HEIGHT}
          />
        )
      })}
      <Cursor x={2000} height={height} strokeWidth={1} />
    </svg>
  )
}

function getViewBoxString(xMin: number, height: number) {
  return `${xMin} 0 ${3000} ${height}`
}

function Cursor({
  x,
  height,
  strokeWidth
}: {
  x: number
  height: number
  strokeWidth: number
}) {
  return (
    <line
      className='cursor'
      stroke='white'
      x1={x}
      y1='-1'
      x2={x}
      y2={height}
      shapeRendering='crispEdges'
      strokeWidth={strokeWidth}
      style={{ pointerEvents: 'none' }}
    />
  )
}

const WAVEFORM_ACTION_TYPE_TO_CLASSNAMES: Record<
  WaveformGesture['type'],
  string
> = {
  CREATE: css.waveformPendingClip,
  MOVE: css.waveformPendingClipMove,
  STRETCH: css.waveformPendingStretch
}
function PendingWaveformItem({
  action,
  height,
  rectRef,
  pixelsPerSecond,
  getItem
}: {
  action: WaveformGesture
  height: number
  rectRef: MutableRefObject<SVGRectElement | null>
  pixelsPerSecond: number
  getItem: GetWaveformItem
}) {
  if (action.type === 'MOVE') {
    const {
      start,
      end,
      clip: { id: clipId }
    } = action
    const deltaX = start - end

    const clipToMove = getItem(clipId)
    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(clipToMove.start - deltaX, pixelsPerSecond),
          msToPixels(clipToMove.end - deltaX, pixelsPerSecond),
          height
        )}
      />
    )
  }

  if (action.type === 'STRETCH') {
    const { start, end, clipId } = action
    const clipToStretch = getItem(clipId)
    const originKey =
      Math.abs(start - clipToStretch.start) <
      Math.abs(start - clipToStretch.end)
        ? 'start'
        : 'end'
    const edge = clipToStretch[originKey]

    const deltaX = start - end

    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(edge, pixelsPerSecond),
          msToPixels(edge - deltaX, pixelsPerSecond),
          height
        )}
      />
    )
  }
  return (
    <rect
      ref={rectRef}
      className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
      {...getClipRectProps(
        msToPixels(Math.min(action.start, action.end), pixelsPerSecond),
        msToPixels(Math.max(action.start, action.end), pixelsPerSecond),
        height
      )}
    />
  )
}
function useWaveformMouseActions({
  waveform,
  playerRef,
  ...eventHandlers
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>
  waveform: WaveformInterface
} & WaveformEventHandlers) {
  const { svgRef, state, dispatch } = waveform
  const { pendingAction, pixelsPerSecond, durationSeconds } = state
  const pendingActionRef = useRef<SVGRectElement | null>(null)

  const mouseDown = useRef<WaveformMousedownEvent | null>(null)

  const durationMilliseconds = secondsToMs(durationSeconds)

  useEffect(() => {
    const handleMouseMoves = (e: MouseEvent) => {
      if (!mouseDown.current) return

      e.preventDefault()
      const svg = svgRef.current
      if (svg) {
        const msAtMouse = waveformTimeAtMousePosition(
          e,
          svg,
          state.viewBoxStartMs,
          state.pixelsPerSecond
        )
        const ms = Math.min(durationMilliseconds, msAtMouse)
        dispatch({ type: 'CONTINUE_WAVEFORM_MOUSE_ACTION', ms })
      }
    }
    document.addEventListener('mousemove', handleMouseMoves)
    return () => document.removeEventListener('mousemove', handleMouseMoves)
  }, [
    dispatch,
    svgRef,
    state.viewBoxStartMs,
    durationSeconds,
    durationMilliseconds,
    pixelsPerSecond,
    state.pixelsPerSecond
  ])

  const handleMouseDown: EventHandler<
    React.MouseEvent<SVGElement>
  > = useCallback(
    (e) => {
      const msAtMouse = waveformTimeAtMousePosition(
        e,
        e.currentTarget,
        state.viewBoxStartMs,
        pixelsPerSecond
      )
      const ms = Math.min(durationMilliseconds, msAtMouse)
      const waveformMousedown = new WaveformMousedownEvent(e, ms)
      document.dispatchEvent(waveformMousedown)
      const { dataset } = e.target as SVGGElement | SVGRectElement

      const mousedownAction = getWaveformMousedownAction(
        dataset,
        waveformMousedown,
        waveform
      )
      if (mousedownAction)
        dispatch({
          type: 'START_WAVEFORM_MOUSE_ACTION',
          action: mousedownAction
        })

      mouseDown.current = waveformMousedown
    },
    [
      state.viewBoxStartMs,
      pixelsPerSecond,
      durationMilliseconds,
      waveform,
      dispatch
    ]
  )

  useEffect(() => {
    const handleMouseUps = (e: MouseEvent) => {
      if (!mouseDown.current) return
      const currentMouseDown = mouseDown.current

      mouseDown.current = null
      dispatch({
        type: 'START_WAVEFORM_MOUSE_ACTION' as const,
        action: null
      })

      const svg = svgRef.current
      if (!svg) return

      const msAtMouse = waveformTimeAtMousePosition(
        e,
        svg,
        state.viewBoxStartMs,
        pixelsPerSecond
      )
      const ms = Math.min(durationMilliseconds, msAtMouse)

      if (pendingAction) {
        const event = new WaveformDragEvent(
          currentMouseDown,
          getFinalWaveformDragAction(pendingAction, ms, waveform)
        )
        document.dispatchEvent(event)

        if (event.action.type === ('CREATE' as const))
          eventHandlers.onWaveformDrag?.(
            event as WaveformGestureOf<WaveformDrag>
          )
        if (event.action.type === 'MOVE')
          eventHandlers.onClipDrag?.(event as WaveformGestureOf<ClipDrag>)
        if (event.action.type === 'STRETCH')
          eventHandlers.onClipEdgeDrag?.(
            event as WaveformGestureOf<ClipStretch>
          )
      }
    }
    document.addEventListener('mouseup', handleMouseUps)
    return () => document.removeEventListener('mouseup', handleMouseUps)
  }, [
    dispatch,
    durationMilliseconds,
    pendingAction,
    pixelsPerSecond,
    playerRef,
    svgRef,
    state,
    durationSeconds,
    eventHandlers,
    waveform
  ])

  return {
    handleMouseDown,
    pendingActionRef
  }
}

function waveformTimeAtMousePosition(
  mouseEvent: React.MouseEvent<SVGElement> | MouseEvent,
  svgElement: SVGElement,

  viewBoxStartMs: number,
  pixelsPerSecond: number
) {
  const { clientX } = mouseEvent
  const { left } = svgElement.getBoundingClientRect()

  const offsetX = clientX - left
  return pixelsToMs(offsetX, pixelsPerSecond) + viewBoxStartMs
}
