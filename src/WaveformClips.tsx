import React, { Fragment, ReactNode, useMemo } from 'react'
import {
  PrimaryClip,
  SecondaryClip,
  WaveformRegion,
  WaveformState
} from './WaveformState'
import { GetWaveformItem, WaveformInterface } from './useWaveform'
import { WaveformClip } from './WaveformClipsPrimaryClip'
import { SecondaryClipDisplayProps } from './ClipDisplayProps'
import { PrimaryClipDisplayProps } from '.'

export type ClipClickDataProps = {
  'data-clip-id': string
  'data-clip-start': number
  'data-clip-end': number
  'data-region-index': number
  'data-clip-is-highlighted'?: number
}
function getClipClickDataProps(
  id: string,
  start: number,
  end: number,
  regionIndex: number,
  isHighlighted: boolean
) {
  const props: ClipClickDataProps = {
    'data-clip-id': id,
    'data-clip-start': start,
    'data-clip-end': end,
    'data-region-index': regionIndex
  }

  if (isHighlighted) props['data-clip-is-highlighted'] = 1
  return props
}

type TouchingClipsGroup = {
  clips: PrimaryClipDisplaySpecs[]
  slots: Array<string | null>
}
type PrimaryClipDisplaySpecs = {
  clip: PrimaryClip
  region: WaveformRegion
  regionIndex: number
  level: number
}
type SecondaryClipDisplaySpecs = {
  clip: SecondaryClip
  region: WaveformRegion
  regionIndex: number
}

export const Clips = React.memo(ClipsBase)
function ClipsBase({
  getItem,
  height,
  state: { pixelsPerSecond, selection },
  renderPrimaryClip,
  renderSecondaryClip,
  reduceOnVisibleRegions
}: {
  getItem: GetWaveformItem
  height: number
  state: WaveformState
  renderPrimaryClip?: (specs: PrimaryClipDisplayProps) => ReactNode
  renderSecondaryClip?: (specs: SecondaryClipDisplayProps) => ReactNode
  reduceOnVisibleRegions: WaveformInterface['reduceOnVisibleRegions']
}) {
  let highlightedClipDisplay: ReactNode

  const { primary, secondary } = useMemo(() => {
    const acc: {
      primary: {
        clips: PrimaryClipDisplaySpecs[]
        slots: Array<string | null>
      }[]
      secondary: SecondaryClipDisplaySpecs[]
    } = { primary: [{ clips: [], slots: [] }], secondary: [] }
    const renderedClips = new Set<string>()
    return reduceOnVisibleRegions((acc, region, regionIndex) => {
      const { primary, secondary } = acc
      const lastGroup: TouchingClipsGroup = primary[primary.length - 1]
      const { clips, slots } = lastGroup

      const currentlyOverlapping = region.itemIds.length
      if (!currentlyOverlapping) {
        if (!lastGroup || lastGroup.clips.length)
          primary.push({
            clips: [],
            slots: []
          })
        return acc
      }

      slots.forEach((slot, i) => {
        if (!region.itemIds.some((id) => id === slot)) {
          slots[i] = null
        }
      })

      const startingNow = region.itemIds.flatMap((id) => {
        const clip = getItem(id)
        if (!clip) return []

        const wasRendered = renderedClips.has(clip.id)
        renderedClips.add(clip.id)
        return wasRendered ? [] : [clip]
      })

      startingNow.forEach((clip) => {
        if (clip.clipwaveType === 'Secondary') {
          secondary.push({
            clip,
            region,
            regionIndex
          })
          return
        }

        const emptySlot = slots.findIndex((id) => !id)
        const slotIndex = emptySlot === -1 ? slots.length : emptySlot
        slots[slotIndex] = clip.id

        const specs = {
          clip,
          region,
          regionIndex,
          level: slotIndex
        }
        clips.push(specs)
      })

      return acc
    }, acc)
  }, [reduceOnVisibleRegions, getItem])

  const selectionId = selection.item

  return (
    <g>
      {primary.flatMap(({ clips, slots }) =>
        clips.flatMap((displaySpecs) => {
          const { clip, regionIndex } = displaySpecs
          const isHighlighted = clip.id === selectionId
          const displayProps = {
            ...displaySpecs,
            key: clip.id,
            isHighlighted,
            height: height - (slots.length - 1) * 10,
            pixelsPerSecond,
            clickDataProps: getClipClickDataProps(
              clip.id,
              clip.start,
              clip.end,
              regionIndex,
              isHighlighted
            )
          }
          const display = renderPrimaryClip ? (
            <Fragment key={`PrimaryClip__${clip.id}`}>
              {renderPrimaryClip(displayProps)}
            </Fragment>
          ) : (
            <WaveformClip {...displayProps} />
          )

          if (isHighlighted) {
            highlightedClipDisplay = display
            return null
          } else return display
        })
      )}
      {highlightedClipDisplay}
      {useMemo(
        () =>
          renderSecondaryClip &&
          secondary.map((clipSpecs) => (
            <React.Fragment key={clipSpecs.clip.id}>
              {renderSecondaryClip({ ...clipSpecs, pixelsPerSecond })}
            </React.Fragment>
          )),
        [secondary, renderSecondaryClip, pixelsPerSecond]
      )}
    </g>
  )
}
