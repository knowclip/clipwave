import React, { ReactNode, useMemo } from 'react'
import { pixelsToMs } from './utils'
import {
  PrimaryClip,
  SecondaryClip,
  WaveformRegion,
  WaveformState
} from './WaveformState'
import { getRegionEnd } from './utils/calculateRegions'
import { GetWaveformItem, MAX_WAVEFORM_VIEWPORT_WIDTH } from './useWaveform'
import { WaveformClip } from './WaveformClipsPrimaryClip'

export type ClipClickDataProps =
  | {
      'data-clip-id': string
      'data-clip-start': number
      'data-clip-end': number
      'data-region-index': number
      'data-clip-is-highlighted'?: number
    }
  | {
      'data-clip-id': string
      'data-clip-start': number
      'data-clip-end': number
      'data-region-index': number
      'data-track-offset-y': number
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
  regions,
  highlightedClipId,
  height,
  state: { pixelsPerSecond, viewBoxStartMs }
}: {
  getItem: GetWaveformItem
  regions: WaveformRegion[]
  highlightedClipId: string | null
  height: number
  state: WaveformState
}) {
  let highlightedClipDisplay: ReactNode

  const acc: {
    primary: {
      clips: PrimaryClipDisplaySpecs[]
      slots: Array<string | null>
    }[]
    secondary: SecondaryClipDisplaySpecs[]
  } = { primary: [{ clips: [], slots: [] }], secondary: [] }
  const { primary } = useMemo(
    () =>
      reduceWhile(
        regions,
        acc,
        (region) =>
          region.start <=
          viewBoxStartMs +
            pixelsToMs(MAX_WAVEFORM_VIEWPORT_WIDTH, pixelsPerSecond),
        (acc, region, regionIndex) => {
          const { primary, secondary } = acc
          if (getRegionEnd(regions, regionIndex) < viewBoxStartMs) {
            return acc
          }

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
            return region.start === clip.start ? clip : []
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
        }
      ),
    [pixelsPerSecond, regions, viewBoxStartMs, getItem]
  )

  return (
    <g>
      {primary.flatMap(({ clips, slots }) =>
        clips.flatMap(({ clip, regionIndex, region, level }) => {
          const isHighlighted = clip.id === highlightedClipId
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
      {highlightedClipDisplay}
    </g>
  )
}

function reduceWhile<T, U>(
  arr: T[],
  acc: U,
  test: (element: T, index: number) => boolean,
  reducer: (acc: U, element: T, index: number) => U
) {
  let currentAcc = acc
  for (let i = 0; i < arr.length && test(arr[i], i); i++) {
    currentAcc = reducer(currentAcc, arr[i], i)
  }

  return currentAcc
}
