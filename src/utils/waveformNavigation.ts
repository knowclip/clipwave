import {
  WaveformState,
  WaveformRegion,
  GetWaveformItem,
  WaveformItem
} from '..'

export type TestWaveformItem = (
  item: WaveformItem,
  region: WaveformRegion,
  regionIndex: number,
  regions: WaveformRegion[],
  getItem: GetWaveformItem
) => boolean

const itemStartsAtRegion: TestWaveformItem = (item, region) =>
  item?.start === region.start

export function getPreviousWaveformItem(
  regions: WaveformRegion[],
  currentSelection: WaveformState['selection'],
  getItem: GetWaveformItem,
  test = itemStartsAtRegion
) {
  let loopedAround = false
  let i = currentSelection.regionIndex
  let cycleComplete = false
  while (!cycleComplete) {
    if (i === 0) {
      loopedAround = true
      i = regions.length - 1
    } else {
      // or below?
      i--
    }

    const region = regions[i]
    if (!region) {
      console.error(
        `no prev region found at ${i} within ${regions.length} regions`
      )
      return null
    }

    const matchingItemId = region.itemIds.find((id) => {
      const item = getItem(id)
      return item && test(item, region, i, regions, getItem)
    })
    if (matchingItemId)
      return {
        regionIndex: i,
        item: getItem(matchingItemId)!
      }

    if (loopedAround && i === currentSelection.regionIndex) cycleComplete = true
  }
  return null
}

export function getNextWaveformItem(
  regions: WaveformRegion[],
  currentSelection: WaveformState['selection'],
  getItem: GetWaveformItem,
  test = itemStartsAtRegion
) {
  let loopedAround = false
  let i = currentSelection.regionIndex
  let cycleComplete = false
  while (!cycleComplete) {
    if (i === regions.length - 1) {
      loopedAround = true
      i = 0
    } else {
      // or below?
      i++
    }

    const region = regions[i]
    if (!region) {
      console.error(
        `no next region found at ${i} within ${regions.length} regions`
      )
      return null
    }

    const firstItemStartingNowId = region.itemIds.find((id) => {
      const item = getItem(id)
      return item && test(item, region, i, regions, getItem)
    })
    if (firstItemStartingNowId)
      return {
        regionIndex: i,
        item: getItem(firstItemStartingNowId)!
      }

    if (loopedAround && i === currentSelection.regionIndex) cycleComplete = true
  }

  return null
}
