import { expect, test } from '@jest/globals'
import { parseUci, makeUci } from './util.js'

test('parse uci', () => {
  expect(parseUci('a1a2')).toEqual({ from: 0, to: 8 })
  expect(parseUci('h7h8q')).toEqual({ from: 55, to: 63, promotion: 'queen' })
})

test('make uci', () => {
  expect(makeUci({ from: 2, to: 3 })).toBe('c1d1')
  expect(makeUci({ from: 0, to: 0, promotion: 'pawn' })).toBe('a1a1p')
})
