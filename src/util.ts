import { FILE_NAMES, RANK_NAMES, Color, Square, Role, Move, isNormal, SquareName } from './types.js'

export const defined = <A>(v: A | undefined): v is A => v !== undefined

export const opposite = (color: Color): Color => (color === 'white' ? 'black' : 'white')

export const squareRank = (square: Square): number => square >> 3

export const squareFile = (square: Square): number => square & 0x7

export const squareFromCoords = (file: number, rank: number): Square | undefined =>
  0 <= file && file < 8 && 0 <= rank && rank < 8 ? file + 8 * rank : undefined

export const roleToChar = (role: Role): string => {
  switch (role) {
    case 'pawn':
      return 'p'
    case 'promotedpawn':
      return 'M'
    case 'knight':
      return 'n'
    case 'bishop':
      return 's'
    case 'rook':
      return 'r'
    case 'queen':
      return 'm'
    case 'king':
      return 'k'
  }
}

export function charToRole(ch: 'p' | 'n' | 's' | 'r' | 'm' | 'k' | 'P' | 'N' | 'S' | 'R' | 'M' | 'K'): Role
export function charToRole(ch: string): Role | undefined
export function charToRole(ch: string): Role | undefined {
  switch (ch.toLowerCase()) {
    case 'p':
      return 'pawn'
    case 'M':
      return 'promotedpawn'
    case 'n':
      return 'knight'
    case 's':
      return 'bishop'
    case 'r':
      return 'rook'
    case 'm':
      return 'queen'
    case 'k':
      return 'king'
    default:
      return
  }
}

export function parseSquare(str: SquareName): Square
export function parseSquare(str: string): Square | undefined
export function parseSquare(str: string): Square | undefined {
  if (str.length !== 2) return
  return squareFromCoords(str.charCodeAt(0) - 'a'.charCodeAt(0), str.charCodeAt(1) - '1'.charCodeAt(0))
}

export const makeSquare = (square: Square): SquareName =>
  (FILE_NAMES[squareFile(square)] + RANK_NAMES[squareRank(square)]) as SquareName

export const parseUci = (str: string): Move | undefined => {
  if (str.length === 4 || str.length === 5) {
    const from = parseSquare(str.slice(0, 2))
    const to = parseSquare(str.slice(2, 4))
    let promotion: Role | undefined
    if (str.length === 5) {
      promotion = charToRole(str[4])
      if (!promotion) return
    }
    if (defined(from) && defined(to)) return { from, to, promotion }
  }
  return
}

export const moveEquals = (left: Move, right: Move): boolean => {
  if (left.to !== right.to) return false
  else return isNormal(right) && left.from === right.from && left.promotion === right.promotion
}

/**
 * Converts a move to UCI notation, like `g1f3` for a normal move,
 * `a5a6` for promotion to a promoted pawn
 */
export const makeUci = (move: Move): string =>
  makeSquare(move.from) + makeSquare(move.to) + (move.promotion ? roleToChar(move.promotion) : '')
