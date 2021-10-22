import { GetWaveformItem } from '../useWaveform'
import { getRegionEnd } from './getRegionEnd'
import { WaveformRegion, WaveformState } from '../WaveformState'

export const getNewWaveformSelectionAt = (
  getNewWaveformItem: GetWaveformItem,
  regions: WaveformRegion[],
  newMs: number,
  currentSelection: WaveformState['selection']
): WaveformState['selection'] => {
  // TODO: optimize for non-seeking (normal playback) case
  const newCurrentItem = currentSelection.item
    ? getNewWaveformItem(currentSelection.item)
    : null

  const stillWithinSameItem =
    newCurrentItem &&
    newMs >= newCurrentItem.start &&
    newMs < newCurrentItem.end

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]

    if (region.start > newMs) break

    if (newMs >= region.start && newMs < getRegionEnd(regions, i)) {
      const overlappedItemId =
        stillWithinSameItem && newCurrentItem
          ? newCurrentItem.id
          : region.itemIds.find((id) => {
              const item = getNewWaveformItem(id)
              return item && newMs >= item.start && newMs < item.end
            })

      return {
        item: overlappedItemId || null,
        regionIndex: i
      }
    }
  }

  if (regions.length === 1) return { regionIndex: 0, item: null }

  console.error(
    `Region not found at ${newMs} ms within ${regions.length} regions`
  )
  return {
    regionIndex: 0,
    item: null
  }
}
