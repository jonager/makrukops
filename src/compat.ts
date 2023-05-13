/**
 * Compatibility with other libraries.
 *
 * Convert between the formats used by makrukops
 * and [makrukground](https://github.com/thaichess-org/makrukground)
 *
 * @packageDocumentation
 */

import { Rules, SquareName, Move } from './types.js'
import { makeSquare } from './util.js'
import { Position } from './makruk.js'

/**
 * Computes the legal move destinations in the format used by makrukground.
 */
export const makrukgroundDests = (pos: Position): Map<SquareName, SquareName[]> => {
  const result = new Map()
  const ctx = pos.ctx()
  for (const [from, squares] of pos.allDests(ctx)) {
    if (squares.nonEmpty()) {
      const d = Array.from(squares, makeSquare)
      result.set(makeSquare(from), d)
    }
  }
  return result
}

export const makrukgroundMove = (move: Move): SquareName[] => [makeSquare(move.from), makeSquare(move.to)]

export const thaichessRules = (variant: 'makruk'): Rules => {
  switch (variant) {
    case 'makruk':
      return 'makruk'
    default:
      return variant
  }
}

export const thaichessVariant = (rules: Rules): 'makruk' => {
  switch (rules) {
    case 'makruk':
      return 'makruk'
    default:
      return rules
  }
}
