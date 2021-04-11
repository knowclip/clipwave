import React from 'react'
import cn from 'classnames'
import { getClipRectProps } from './getClipRectProps'
import { msToPixels, SUBTITLES_CHUNK_HEIGHT, WAVEFORM_HEIGHT } from './utils'
import { SecondaryClip, WaveformRegion } from './WaveformState'
import css from './Waveform.module.scss'
import { ClipClickDataProps } from './WaveformClips'

export const SecondaryClipDisplay = React.memo(SecondaryClipDisplayBase)
function SecondaryClipDisplayBase({
  clip,
  pixelsPerSecond,
  regionIndex
}: {
  clip: SecondaryClip
  region: WaveformRegion
  regionIndex: number
  pixelsPerSecond: number
}) {
  const { id, start, end, trackOffsetY, text } = clip
  const clickDataProps: ClipClickDataProps = {
    'data-clip-id': id,
    'data-clip-start': start,
    'data-clip-end': end,
    'data-region-index': regionIndex,
    'data-track-offset-y': trackOffsetY
  }
  // const y = WAVEFORM_HEIGHT + trackOffsetY * 10
  const rect = getClipRectProps(
    msToPixels(start, pixelsPerSecond),
    msToPixels(end, pixelsPerSecond),
    SUBTITLES_CHUNK_HEIGHT,
    WAVEFORM_HEIGHT + trackOffsetY * SUBTITLES_CHUNK_HEIGHT
  )
  const clipPathId = `clipPath__${id}`

  return (
    <g id={id} {...clickDataProps} className={cn(css.waveformSecondaryClip)}>
      <clipPath id={clipPathId}>
        <rect {...rect} {...clickDataProps} width={rect.width - 10} />
      </clipPath>
      <rect {...rect} {...clickDataProps} />
      {text.map((textChunk, i) => (
        <text
          key={clipPathId + i}
          clipPath={`url(#${clipPathId})`}
          {...clickDataProps}
          className={css.subtitlesText}
          x={rect.x + 6}
          y={(trackOffsetY + 1) * SUBTITLES_CHUNK_HEIGHT + WAVEFORM_HEIGHT}
        >
          {textChunk}
        </text>
      ))}
    </g>
  )
}
