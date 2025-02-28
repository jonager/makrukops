export const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

export type FileName = (typeof FILE_NAMES)[number]

export const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export type RankName = (typeof RANK_NAMES)[number]

export type Square = number

export type SquareName = `${FileName}${RankName}`

/**
 * Indexable by square indices.
 */
export type BySquare<T> = T[]

export const COLORS = ['white', 'black'] as const

export type Color = (typeof COLORS)[number]

/**
 * Indexable by `white` and `black`.
 */
export type ByColor<T> = {
  [color in Color]: T
}

export const ROLES = ['pawn', 'promotedpawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const

export type Role = (typeof ROLES)[number]

/**
 * Indexable by `pawn`, `promotedpawn`, `knight`, `bishop`, `rook`, `queen`, and `king`.
 */
export type ByRole<T> = {
  [role in Role]: T
}

export interface Piece {
  role: Role
  color: Color
  promoted?: boolean
}

export interface Move {
  from: Square
  to: Square
  promotion?: Role
}

export const isNormal = (v: Move): v is Move => 'from' in v

export const RULES = ['makruk'] as const

export type Rules = (typeof RULES)[number]

export interface Outcome {
  winner: Color | undefined
}
