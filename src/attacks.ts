/**
 * Compute attacks and rays.
 *
 * These are low-level functions that can be used to implement makruk rules.
 *
 * Implementation notes: Sliding attacks are computed using
 * [Hyperbola Quintessence](https://www.chessprogramming.org/Hyperbola_Quintessence).
 * Magic Bitboards would deliver slightly faster lookups, but also require
 * initializing considerably larger attack tables. On the web, initialization
 * time is important, so the chosen method may strike a better balance.
 *
 * @packageDocumentation
 */

import { squareFile, squareRank } from './util.js'
import { Square, Piece, Color, BySquare } from './types.js'
import { SquareSet } from './squareSet.js'

const computeRange = (square: Square, deltas: number[]): SquareSet => {
  let range = SquareSet.empty()
  for (const delta of deltas) {
    const sq = square + delta
    if (0 <= sq && sq < 64 && Math.abs(squareFile(square) - squareFile(sq)) <= 2) {
      range = range.with(sq)
    }
  }
  return range
}

const tabulate = <T>(f: (square: Square) => T): BySquare<T> => {
  const table = []
  for (let square = 0; square < 64; square++) table[square] = f(square)
  return table
}

const KING_ATTACKS = tabulate(sq => computeRange(sq, [-9, -8, -7, -1, 1, 7, 8, 9]))
const QUEEN_ATTACKS = tabulate(sq => computeRange(sq, [-9, -7, 7, 9])) // queen and promoted pawn move the same way
const KNIGHT_ATTACKS = tabulate(sq => computeRange(sq, [-17, -15, -10, -6, 6, 10, 15, 17]))
const BISHOP_ATTACKS = {
  white: tabulate(sq => computeRange(sq, [-7, -9, 7, 8, 9])),
  black: tabulate(sq => computeRange(sq, [-7, -8, -9, 7, 9]))
}
const PAWN_ATTACKS = {
  white: tabulate(sq => computeRange(sq, [7, 9])),
  black: tabulate(sq => computeRange(sq, [-7, -9]))
}

/**
 * Gets squares attacked or defended by a king on `square`.
 */
export const kingAttacks = (square: Square): SquareSet => KING_ATTACKS[square]

/**
 * Gets squares attacked or defended by a queen or a promoted pawn on `square`.
 */
export const queenAttacks = (square: Square): SquareSet => QUEEN_ATTACKS[square]

/**
 * Gets squares attacked or defended by a knight on `square`.
 */
export const knightAttacks = (square: Square): SquareSet => KNIGHT_ATTACKS[square]

/**
 * Gets squares attacked or defended by a bishop on `square`.
 */
export const bishopAttacks = (color: Color, square: Square): SquareSet => BISHOP_ATTACKS[color][square]

/**
 * Gets squares attacked or defended by a pawn of the given `color`
 * on `square`.
 */
export const pawnAttacks = (color: Color, square: Square): SquareSet => PAWN_ATTACKS[color][square]

const FILE_RANGE = tabulate(sq => SquareSet.fromFile(squareFile(sq)).without(sq))
const RANK_RANGE = tabulate(sq => SquareSet.fromRank(squareRank(sq)).without(sq))

const hyperbola = (bit: SquareSet, range: SquareSet, occupied: SquareSet): SquareSet => {
  let forward = occupied.intersect(range)
  let reverse = forward.bswap64() // Assumes no more than 1 bit per rank
  forward = forward.minus64(bit)
  reverse = reverse.minus64(bit.bswap64())
  return forward.xor(reverse.bswap64()).intersect(range)
}

const fileAttacks = (square: Square, occupied: SquareSet): SquareSet =>
  hyperbola(SquareSet.fromSquare(square), FILE_RANGE[square], occupied)

const rankAttacks = (square: Square, occupied: SquareSet): SquareSet => {
  const range = RANK_RANGE[square]
  let forward = occupied.intersect(range)
  let reverse = forward.rbit64()
  forward = forward.minus64(SquareSet.fromSquare(square))
  reverse = reverse.minus64(SquareSet.fromSquare(63 - square))
  return forward.xor(reverse.rbit64()).intersect(range)
}

/**
 * Gets squares attacked or defended by a rook on `square`, given `occupied`
 * squares.
 */
export const rookAttacks = (square: Square, occupied: SquareSet): SquareSet =>
  fileAttacks(square, occupied).xor(rankAttacks(square, occupied))

/**
 * Gets squares attacked or defended by a `piece` on `square`, given
 * `occupied` squares.
 */
export const attacks = (piece: Piece, square: Square, occupied: SquareSet): SquareSet => {
  switch (piece.role) {
    case 'pawn':
      return pawnAttacks(piece.color, square)
    case 'knight':
      return knightAttacks(square)
    case 'bishop':
      return bishopAttacks(piece.color, square)
    case 'rook':
      return rookAttacks(square, occupied)
    case 'queen':
    case 'promotedpawn':
      return queenAttacks(square)
    case 'king':
      return kingAttacks(square)
  }
}

/**
 * Gets all squares of the rank, file with the two squares
 * `a` and `b`, or an empty set if they are not aligned.
 */
export const ray = (a: Square, b: Square): SquareSet => {
  const other = SquareSet.fromSquare(b)
  if (RANK_RANGE[a].intersects(other)) return RANK_RANGE[a].with(a)
  if (FILE_RANGE[a].intersects(other)) return FILE_RANGE[a].with(a)
  return SquareSet.empty()
}

/**
 * Gets all squares between `a` and `b` (bounds not included), or an empty set
 * if they are not on the same rank, file or diagonal.
 */
export const between = (a: Square, b: Square): SquareSet =>
  ray(a, b)
    .intersect(SquareSet.full().shl64(a).xor(SquareSet.full().shl64(b)))
    .withoutFirst()
