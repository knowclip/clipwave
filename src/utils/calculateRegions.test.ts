import {
  calculateRegions,
  newRegionsWithItems,
  recalculateRegions,
  sortWaveformItems
} from './calculateRegions'

const item = (id: string, start: number, end: number) => ({
  id,
  start,
  end,
  clipwaveType: 'Primary' as const
})

const region = (start: number, ...itemIds: string[]) => ({ start, itemIds })
const endRegion = (start: number, end: number, ...itemIds: string[]) => ({
  start,
  end,
  itemIds
})

describe('calculateRegions', () => {
  it('calculates one end region', () => {
    const end = 10000
    const { regions } = calculateRegions([], end)
    expect(regions).toEqual([
      {
        start: 0,
        itemIds: [],
        end: 10000
      }
    ])
  })

  it('calculates region for one item in middle', () => {
    const end = 10000
    const { regions } = calculateRegions([item('a', 1, 4)], end)
    expect(regions).toEqual([
      { start: 0, itemIds: [] },
      { start: 1, itemIds: ['a'] },
      { start: 4, itemIds: [], end: 10000 }
    ])
  })

  it('calculates region for one item at start', () => {
    const end = 10000
    const { regions } = calculateRegions([item('a', 0, 5)], end)
    expect(regions).toEqual([
      { start: 0, itemIds: ['a'] },
      { start: 5, end: 10000, itemIds: [] }
    ])
  })

  it('calculates regions for separate items', () => {
    const end = 10000
    const items = [item('a', 10, 20), item('b', 50, 60)]
    const { regions } = calculateRegions(items, end)
    expect(regions).toEqual([
      region(0),
      region(10, 'a'),
      region(20),
      region(50, 'b'),
      endRegion(60, 10000)
    ])
  })

  it('calculates regions for a couple overlapping items', () => {
    const end = 10000
    const items = [item('a', 10, 50), item('b', 20, 40), item('c', 60, 70)]
    const { regions } = calculateRegions(items, end)
    expect(regions).toEqual([
      region(0),
      region(10, 'a'),
      region(20, 'a', 'b'),
      region(40, 'a'),
      region(50),
      region(60, 'c'),
      endRegion(70, 10000)
    ])
  })

  it('calculates regions with overlaps', () => {
    const end = 10000
    const items = [item('a', 10, 40), item('b', 30, 70), item('c', 80, 105)]
    const { regions } = calculateRegions(items, end)
    expect(regions).toEqual([
      region(0),
      region(10, 'a'),
      region(30, 'a', 'b'),
      region(40, 'b'),
      region(70),
      region(80, 'c'),
      endRegion(105, 10000)
    ])
  })
})

describe('newRegionsWithItem', () => {
  it('works with new item & overlaps', () => {
    const items = [item('a', 10, 20), item('b', 40, 50)]
    const end = 10000

    const newItem = item('c', 15, 45)

    const { regions } = calculateRegions(items, end)

    const newRegions = newRegionsWithItems(regions, [newItem])
    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(15, 'a', 'c'),
      region(20, 'c'),
      region(40, 'b', 'c'), // TODO: verify if this should be in order ["c", "b"]
      region(45, 'b'),
      endRegion(50, 10000)
    ])
  })

  it('works with items ending or starting at the same time', () => {
    const end = 10000
    const items = [
      item('a', 10, 20),
      item('b', 40, 50),
      item('c', 15, 50),
      item('d', 60, 70),
      item('e', 60, 65),
      item('f', 80, 90),
      item('g', 80, 90)
    ]
    const { regions: newRegions } = calculateRegions(items, end)

    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(15, 'a', 'c'),
      region(20, 'c'),
      region(40, 'b', 'c'),
      region(50),
      region(60, 'd', 'e'),
      region(65, 'd'),
      region(70),
      region(80, 'f', 'g'),
      endRegion(90, 10000)
    ])
  })
})

describe('recalculateRegions', () => {
  it('works with last item delete', () => {
    const a = item('a', 10, 20)
    const b = item('b', 40, 50)
    const map = {
      a,
      b
    }
    const items = [a, b]
    const end = 10000
    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ itemId: 'b', type: 'DELETE' }]
    )
    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      endRegion(20, 10000)
    ])
  })

  it('works with lone item delete', () => {
    const a = item('a', 10, 20)
    const map = {
      a
    }
    const items = [a]
    const end = 10000
    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ itemId: 'a', type: 'DELETE' }]
    )
    expect(newRegions).toEqual([endRegion(0, 10000)])
  })

  it('works with large item delete', () => {
    const a = item('a', 10, 20)
    const b = item('b', 40, 50)
    const c = item('c', 5, 45)
    const map = { a, b, c }
    const items = sortWaveformItems([a, b, c])
    const end = 10000

    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ itemId: 'c', type: 'DELETE' }]
    )
    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(20),
      region(40, 'b'),
      endRegion(50, 10000)
    ])
  })

  it('works with last item stretch, no new item overlaps', () => {
    const a = item('a', 10, 20)
    const b = item('b', 40, 50)
    const map = { a, b }
    const items = [a, b]
    const end = 10000
    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ type: 'UPDATE', newItem: item('b', 40, 60) }]
    )

    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(20),
      region(40, 'b'),
      endRegion(60, 10000)
    ])
  })

  it('works with stretched item & overlaps', () => {
    const a = item('a', 10, 20)
    const b = item('b', 40, 50)
    const c = item('c', 5, 45)
    const items = sortWaveformItems([a, b, c])
    const map = { a, b, c }
    const end = 10000

    const newItem = item('c', 15, 45)

    const { regions } = calculateRegions(items, end)
    expect(regions).toEqual([
      region(0),
      region(5, 'c'),
      region(10, 'c', 'a'),
      region(20, 'c'),
      region(40, 'c', 'b'),
      region(45, 'b'),
      endRegion(50, 10000)
    ])
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ type: 'UPDATE', newItem }]
    )
    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(15, 'a', 'c'),
      region(20, 'c'),
      region(40, 'c', 'b'),
      region(45, 'b'),
      endRegion(50, 10000)
    ])
  })

  it('works with shrunken item', () => {
    const a = item('a', 10, 20)
    const b = item('b', 15, 45)
    const c = item('c', 40, 50)
    const items = [a, b, c]
    const map = { a, b, c }
    const end = 10000

    const newItem = item('b', 17, 45)

    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ type: 'UPDATE', newItem }]
    )
    expect(newRegions).toEqual([
      region(0),
      region(10, 'a'),
      region(17, 'a', 'b'),
      region(20, 'b'),
      region(40, 'b', 'c'),
      region(45, 'c'),
      endRegion(50, 10000)
    ])
  })

  it('works with moved item', () => {
    const a = item('a', 10, 20)
    const b = item('b', 20, 30)
    const c = item('c', 50, 60)
    const items = [a, b, c]
    const map = { a, b, c }
    const end = 10000

    const newItem = item('a', 55, 65)

    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [{ type: 'UPDATE', newItem }]
    )
    expect(newRegions).toEqual([
      region(0),
      region(20, 'b'),
      region(30),
      region(50, 'c'),
      region(55, 'c', 'a'),
      region(60, 'a'),
      endRegion(65, 10000)
    ])
  })

  it('works with merge via move', () => {
    const a = item('a', 10, 20)
    const b = item('b', 30, 40)
    const c = item('c', 50, 60)
    const items = [a, b, c]
    const map = { a, b, c }
    const end = 10000

    const { regions } = calculateRegions(items, end)
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [
        { type: 'UPDATE', newItem: item('a', 25, 40) },
        { itemId: 'b', type: 'DELETE' }
      ]
    )
    expect(newRegions).toEqual([
      region(0),
      region(25, 'a'),
      region(40),
      region(50, 'c'),
      endRegion(60, 10000)
    ])
  })

  it('works with merge via stretch', () => {
    const a = item('a', 10, 20)
    const b = item('b', 40, 50)
    const c = item('c', 5, 45)
    const items = sortWaveformItems([a, b, c])
    const map = { a, b, c }
    const end = 10000

    const { regions } = calculateRegions(items, end)
    expect(regions).toEqual([
      region(0),
      region(5, 'c'),
      region(10, 'c', 'a'),
      region(20, 'c'),
      region(40, 'c', 'b'),
      region(45, 'b'),
      endRegion(50, 10000)
    ])
    const { regions: newRegions } = recalculateRegions(
      regions,
      (id: string) => map[id],
      [
        { type: 'UPDATE', newItem: item('c', 10, 50) },
        { itemId: 'a', type: 'DELETE' },
        { itemId: 'b', type: 'DELETE' }
      ]
    )
    expect(newRegions).toEqual([
      region(0),
      region(10, 'c'),
      endRegion(50, 10000)
    ])
  })
})
