import React, { ReactNode, useMemo } from 'react'
import {
  PrimaryClip,
  SecondaryClip,
  WaveformRegion,
  WaveformState
} from './WaveformState'
import { GetWaveformItem, WaveformInterface } from './useWaveform'
import { WaveformClip } from './WaveformClipsPrimaryClip'
import { SecondaryClipDisplayProps } from './SecondaryClipDisplayProps'

export type ClipClickDataProps = {
  'data-clip-id': string
  'data-clip-start': number
  'data-clip-end': number
  'data-region-index': number
  'data-clip-is-highlighted'?: number
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
  renderSecondaryClip,
  reduceOnVisibleRegions
}: {
  getItem: GetWaveformItem
  height: number
  state: WaveformState
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
        return clip && region.start === clip.start ? clip : []
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
        clips.flatMap(({ clip, regionIndex, region, level }) => {
          const isHighlighted = clip.id === selectionId
          const display = (
            <WaveformClip
              clip={clip}
              region={region}
              regionIndex={regionIndex}
              key={clip.id}
              isHighlighted={isHighlighted}
              height={height - (slots.length - 1) * 10}
              pixelsPerSecond={pixelsPerSecond}
              level={level}
            />
          )

          if (isHighlighted) {
            highlightedClipDisplay = display
            return null
          } else return display
        })
      )}
      {useMemo(
        () =>
          renderSecondaryClip &&
          secondary.map((clipSpecs) =>
            renderSecondaryClip({
              ...clipSpecs,
              pixelsPerSecond
            })
          ),
        [secondary, renderSecondaryClip, pixelsPerSecond]
      )}
      {highlightedClipDisplay}
    </g>
  )
}
