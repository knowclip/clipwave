import { GetWaveformItem } from '../useWaveform'
import { WaveformItem, WaveformRegion } from '../WaveformState'
import { getRegionEnd, overlap, WaveformItemUpdate } from './getRegionEnd'

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
      region.start < updatesRange.end && regionEnd > updatesRange.start

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

function getItemId(update: WaveformItemUpdate) {
  switch (update.type) {
    case 'CREATE':
      return update.newItem.id
    case 'DELETE':
      return update.itemId
    case 'UPDATE':
      return update.newItem.id
  }
}

export function recalculateRegions(
  regions: WaveformRegion[],
  getItem: GetWaveformItem,
  adjacentUpdates: WaveformItemUpdate[],
  // currentSelection?: WaveformState['selection'],
  newSelectionMs?: number
): { regions: WaveformRegion[]; newSelectionRegion?: number } {
  const idsToIndexes = adjacentUpdates.reduce((map, update, i) => {
    map[getItemId(update)] = i
    return map
  }, {} as Record<WaveformItem['id'], number>)
  const getUpdate = (id: WaveformItem['id']): WaveformItemUpdate | undefined =>
    adjacentUpdates[idsToIndexes[id]]
  const validAdjacentUpdates = adjacentUpdates.filter((update) => {
    switch (update.type) {
      case 'CREATE':
      case 'DELETE':
        return true
      case 'UPDATE':
        return getItem(update.newItem.id)
    }
  })
  if (!validAdjacentUpdates.length) return { regions }

  const updatesRange = {
    start: Math.min(
      ...validAdjacentUpdates.flatMap((update) => {
        switch (update.type) {
          case 'CREATE':
            return update.newItem.start
          case 'DELETE':
            // TODO: investigate speeding this up by requiring deleted item coords
            return 0
          case 'UPDATE':
            return [getItem(update.newItem.id)!.start, update.newItem.start]
        }
      })
    ),
    end: Math.max(
      ...validAdjacentUpdates.flatMap((update) => {
        switch (update.type) {
          case 'CREATE':
            return update.newItem.end
          case 'DELETE':
            // TODO: investigate speeding this up by requiring deleted item coords
            return getRegionEnd(regions, regions.length - 1)
          case 'UPDATE':
            return [getItem(update.newItem.id)!.end, update.newItem.end]
        }
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
  const recalculationStartRegionIndex = affectedRegionsStart
  const recalculationEnd = affectedRegionsEnd

  const itemsToBeIncluded: WaveformItem[] = adjacentUpdates.flatMap((update) =>
    update.type === 'CREATE' ? update.newItem : []
  )
  for (let i = recalculationStartRegionIndex; i <= recalculationEnd; i++) {
    const region = regions[i]
    for (const id of region.itemIds) {
      const update = getUpdate(id)

      const item =
        update && update.type === 'DELETE'
          ? null
          : update?.newItem ?? getItem(id)
      if (item && !itemsToBeIncluded.some((i) => i.id === item.id))
        itemsToBeIncluded.push(item)
    }
  }

  sortWaveformItems(itemsToBeIncluded)

  const end = getRegionEnd(regions, recalculationEnd)

  const { regions: changedRegions } = calculateRegions(itemsToBeIncluded, end, [
    {
      start: regions[recalculationStartRegionIndex].start,
      itemIds: [],
      end
    }
  ])

  const pre = regions.slice(0, recalculationStartRegionIndex)
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

  const newRegions = [...pre, ...changedRegions, ...post]
  let newSelectionRegion: number | undefined
  if (
    typeof newSelectionMs === 'number' &&
    newSelectionMs >= regions[recalculationStartRegionIndex].start &&
    newSelectionMs < end
  )
    newSelectionRegion = newRegions.findIndex(
      (r, i) =>
        newSelectionMs >= r.start &&
        newSelectionMs < getRegionEnd(newRegions, i)
    )
  return {
    regions: newRegions,
    newSelectionRegion
  }
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

export type Coords = { start: number; end: number }

/** mutates array */
export function sortWaveformItems<T extends Coords>(items: T[]): T[] {
  // TODO: optimize for mostly sorted
  return items.sort((a, b) => {
    const byStart = a.start - b.start
    return byStart || b.end - a.end
  })
}
