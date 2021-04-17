import { GetWaveformItem } from '../useWaveform'
import { WaveformItem, WaveformRegion } from '../WaveformState'

export const calculateRegions = (
  /** sorted by start. then end? */
  sortedItems: WaveformItem[],
  end: number, // TODO: fix this awkward API
  /** to be mutated, must end with end region? */
  startRegions = [{ start: 0, itemIds: [], end }]
): {
  regions: WaveformRegion[]
} => {
  let regions: WaveformRegion[] = startRegions
  for (const item of sortedItems) {
    regions = newRegionsWithItems(regions, [item])
  }

  return { regions }
}

export function newRegionsWithItems(
  regions: WaveformRegion[],
  sortedNewItems: WaveformItem[]
): WaveformRegion[] {
  const updatesRange = {
    start: Math.min(...sortedNewItems.map((newItem) => newItem.start)),
    end: Math.max(...sortedNewItems.map((newItem) => newItem.end))
  }

  const newRegions: WaveformRegion[] = []

  // TODO: maybe don't always start at 0
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]
    const regionEnd = getRegionEnd(regions, i)
    /// OFF BY ONE?
    const regionIsAffected =
      region.start <= updatesRange.end && regionEnd > updatesRange.start

    if (regionIsAffected) {
      const splitRegions: WaveformRegion[] = []

      if (updatesRange.start > region.start)
        splitRegions.push({
          start: region.start,
          itemIds: region.itemIds
        })

      const overlappingIds = sortedNewItems
        .filter((item) =>
          overlap(item, { start: region.start, end: regionEnd })
        )
        .map((item) => item.id)

      splitRegions.push({
        start: Math.max(updatesRange.start, region.start),
        itemIds: [...region.itemIds, ...overlappingIds]
      })
      if (updatesRange.end < regionEnd)
        splitRegions.push({
          start: updatesRange.end,
          itemIds: region.itemIds
        })

      const lastSplitRegion = splitRegions[splitRegions.length - 1]
      if ('end' in region) lastSplitRegion.end = region.end
      newRegions.push(...splitRegions)
    } else {
      newRegions.push(region)
    }
  }

  return newRegions
}

export function getRegionEnd(regions: WaveformRegion[], index: number): number {
  const end = regions[regions.length - 1].end
  if (typeof end !== 'number') throw new Error('No regions end found')
  const nextRegion: WaveformRegion | null = regions[index + 1] || null
  if (!nextRegion) return end
  const nextRegionStart = nextRegion.start
  return nextRegionStart
}

export function overlap(a: Coords, b: Coords) {
  return a.start <= b.end && a.end >= b.start
}

type WaveformItemUpdate = {
  id: WaveformItem['id']
  newItem: WaveformItem | null
}

export function recalculateRegions(
  regions: WaveformRegion[],
  getItem: GetWaveformItem,
  adjacentUpdates: WaveformItemUpdate[]
) {
  const idsToIndexes = adjacentUpdates.reduce((map, update, i) => {
    map[update.id] = i
    return map
  }, {} as Record<WaveformItem['id'], number>)
  const getUpdate = (id: WaveformItem['id']): WaveformItemUpdate | undefined =>
    adjacentUpdates[idsToIndexes[id]]
  const updatesRange = {
    start: Math.min(
      ...adjacentUpdates.flatMap(({ id, newItem: newItem }) => {
        const old = getItem(id)

        if (newItem) return [old.start, newItem.start]
        return [old.start]
      })
    ),
    end: Math.max(
      ...adjacentUpdates.flatMap(({ id, newItem: newItem }) => {
        const old = getItem(id)

        if (newItem) return [old.end, newItem.end]
        return [old.end]
      })
    )
  }
  const isAffected = (region: WaveformRegion, i: number): boolean => {
    const regionCoords = {
      start: region.start,
      end: getRegionEnd(regions, i)
    }
    return overlap(regionCoords, updatesRange)
  }
  const affectedRegionsStart = search(regions, 0, regions.length, isAffected)

  if (affectedRegionsStart === -1)
    throw new Error('Invalid waveform state: target waveform item not found')

  const affectedRegionsEnd = searchFromEnd(
    regions,
    0,
    regions.length,
    isAffected
  )
  const recalculationStart = affectedRegionsStart
  const recalculationEnd = affectedRegionsEnd

  const itemsToBeIncluded: WaveformItem[] = []
  for (let i = recalculationStart; i <= recalculationEnd; i++) {
    const region = regions[i]
    for (const id of region.itemIds) {
      const update = getUpdate(id)
      const item = update ? update.newItem : getItem(id)
      if (item && !itemsToBeIncluded.includes(item))
        itemsToBeIncluded.push(item)
    }
  }

  sortWaveformItems(itemsToBeIncluded)

  const end = getRegionEnd(regions, recalculationEnd)

  const { regions: changedRegions } = calculateRegions(itemsToBeIncluded, end, [
    {
      start: regions[recalculationStart].start,
      itemIds: [],
      end
    }
  ])

  const pre = regions.slice(0, recalculationStart)
  const post = regions.slice(recalculationEnd)

  if (
    pre.length &&
    changedRegions.length &&
    setsAreEqual(
      new Set(pre[pre.length - 1].itemIds),
      new Set(changedRegions[0].itemIds)
    )
  ) {
    changedRegions.shift()
  }

  if (
    post.length &&
    changedRegions.length &&
    setsAreEqual(
      new Set(post[0].itemIds),
      new Set(changedRegions[changedRegions.length - 1].itemIds)
    )
  ) {
    post.shift()
    // THIS WILL DELETE END??
  }

  if (post.length) {
    delete changedRegions[changedRegions.length - 1].end
  }

  // return [...pre, ...changedRegions.regions, ...post]
  const recalculated = [...pre, ...changedRegions, ...post]
  // console.log({ recalculated })
  return recalculated
}

function setsAreEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false
  for (const a of as) if (!bs.has(a)) return false
  return true
}

function search<T>(
  arr: T[],
  start: number,
  endExclusive: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = start; i < endExclusive; i++) {
    if (predicate(arr[i], i)) return i
  }

  return -1
}

// TODO: optimize by searching from same direction with more sophisticated overlap tracking
function searchFromEnd<T>(
  arr: T[],
  start: number,
  endExclusive: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = endExclusive - 1; i >= start; i--) {
    if (predicate(arr[i], i)) return i
  }

  return -1
}

type Coords = { start: number; end: number }

/** mutates array */
export function sortWaveformItems<T extends Coords>(items: T[]): T[] {
  // TODO: optimize for mostly sorted
  return items.sort((a, b) => {
    const byStart = a.start - b.start
    return byStart || b.end - a.end
  })
}
