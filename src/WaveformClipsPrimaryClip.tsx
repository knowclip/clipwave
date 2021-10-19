import React from 'react'
import cn from 'classnames'
import { getClipRectProps } from './getClipRectProps'
import { msToPixels, SELECTION_BORDER_MILLISECONDS } from './utils'
import { PrimaryClip, WaveformRegion } from './WaveformState'
import css from './Waveform.module.scss'
import { ClipClickDataProps } from './WaveformClips'

export const WaveformClip = React.memo(WaveformClipBase)
function WaveformClipBase({
  clip,
  isHighlighted,
  height,
  pixelsPerSecond,
  level,
  clickDataProps
}: {
  clip: PrimaryClip
  region: WaveformRegion
  isHighlighted: boolean
  height: number
  regionIndex: number
  pixelsPerSecond: number
  level: number
  clickDataProps: ClipClickDataProps
}) {
  const { id, start, end } = clip
  const y = level * 10
  return (
    <g id={id} {...clickDataProps}>
      <rect
        className={cn(
          css.waveformClip,
          { [css.highlightedClip]: isHighlighted }
        )}
        {...getClipRectProps(
          msToPixels(start, pixelsPerSecond),
          msToPixels(end, pixelsPerSecond),
          height
        )}
        y={y}
        style={
          isHighlighted
            ? undefined
            : { fill: `hsl(205, 10%, ${40 + 10 * level}%)` }
        }
        {...clickDataProps}
      />

      <rect
        className={css.waveformClipBorder}
        x={msToPixels(start, pixelsPerSecond)}
        y={0}
        width={msToPixels(SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
        height={height}
        {...clickDataProps}
      />
      <rect
        className={cn(css.waveformClipBorder, {
          [css.highlightedClipBorder]: isHighlighted
        })}
        x={msToPixels(end - SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
        y={y}
        width={msToPixels(SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
        height={height}
        {...clickDataProps}
      />
    </g>
  )
}
