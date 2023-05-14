import { Result } from '@badrap/result'
import { Rules, Color, COLORS, Square, Move, Piece, Outcome } from './types.js'
import { SquareSet } from './squareSet.js'
import { Board, boardEquals } from './board.js'
import { Setup, RemainingChecks } from './setup.js'
import {
  attacks,
  bishopAttacks,
  rookAttacks,
  queenAttacks,
  knightAttacks,
  kingAttacks,
  pawnAttacks,
  between,
  ray
} from './attacks.js'
import { opposite, defined } from './util.js'

export enum IllegalSetup {
  Empty = 'ERR_EMPTY',
  OppositeCheck = 'ERR_OPPOSITE_CHECK',
  PawnsOnBackrank = 'ERR_PAWNS_ON_BACKRANK',
  Kings = 'ERR_KINGS',
  Variant = 'ERR_VARIANT'
}

export class PositionError extends Error {}

const attacksTo = (square: Square, attacker: Color, board: Board, occupied: SquareSet): SquareSet =>
  board[attacker].intersect(
    rookAttacks(square, occupied)
      .union(bishopAttacks(opposite(attacker), square).intersect(board.bishop))
      .union(knightAttacks(square).intersect(board.knight))
      .union(kingAttacks(square).intersect(board.king))
      .union(queenAttacks(square).intersect(board.king))
      .union(pawnAttacks(opposite(attacker), square).intersect(board.pawn))
  )

export interface Context {
  king: Square | undefined
  blockers: SquareSet
  checkers: SquareSet
  variantEnd: boolean
  mustCapture: boolean
}

export abstract class Position {
  board: Board
  turn: Color
  remainingChecks: RemainingChecks | undefined
  halfmoves: number
  fullmoves: number

  protected constructor(readonly rules: Rules) {}

  reset() {
    this.board = Board.default()
    this.turn = 'white'
    this.remainingChecks = undefined
    this.halfmoves = 0
    this.fullmoves = 1
  }

  protected setupUnchecked(setup: Setup) {
    this.board = setup.board.clone()
    this.turn = setup.turn
    this.remainingChecks = undefined
    this.halfmoves = setup.halfmoves
    this.fullmoves = setup.fullmoves
  }

  // When subclassing overwrite at least:
  //
  // - static default()
  // - static fromSetup()
  // - static clone()
  //
  // - dests()
  // - hasInsufficientMaterial()
  // - isStandardMaterial()

  kingAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet {
    return attacksTo(square, attacker, this.board, occupied)
  }

  ctx(): Context {
    const variantEnd = this.isVariantEnd()
    const king = this.board.kingOf(this.turn)
    if (!defined(king))
      return { king, blockers: SquareSet.empty(), checkers: SquareSet.empty(), variantEnd, mustCapture: false }
    const snipers = rookAttacks(king, SquareSet.empty()).intersect(this.board[opposite(this.turn)])
    let blockers = SquareSet.empty()
    for (const sniper of snipers) {
      const b = between(king, sniper).intersect(this.board.occupied)
      if (!b.moreThanOne()) blockers = blockers.union(b)
    }
    const checkers = this.kingAttackers(king, opposite(this.turn), this.board.occupied)
    return {
      king,
      blockers,
      checkers,
      variantEnd,
      mustCapture: false
    }
  }

  clone(): Position {
    const pos = new (this as any).constructor()
    pos.board = this.board.clone()
    pos.turn = this.turn
    pos.remainingChecks = this.remainingChecks?.clone()
    pos.halfmoves = this.halfmoves
    pos.fullmoves = this.fullmoves
    return pos
  }

  protected validate(): Result<undefined, PositionError> {
    if (this.board.occupied.isEmpty()) return Result.err(new PositionError(IllegalSetup.Empty))
    if (this.board.king.size() !== 2) return Result.err(new PositionError(IllegalSetup.Kings))

    if (!defined(this.board.kingOf(this.turn))) return Result.err(new PositionError(IllegalSetup.Kings))

    const otherKing = this.board.kingOf(opposite(this.turn))
    if (!defined(otherKing)) return Result.err(new PositionError(IllegalSetup.Kings))
    if (this.kingAttackers(otherKing, this.turn, this.board.occupied).nonEmpty())
      return Result.err(new PositionError(IllegalSetup.OppositeCheck))

    if (SquareSet.backranks().intersects(this.board.pawn))
      return Result.err(new PositionError(IllegalSetup.PawnsOnBackrank))

    return Result.ok(undefined)
  }

  dests(square: Square, ctx?: Context): SquareSet {
    ctx = ctx || this.ctx()
    if (ctx.variantEnd) return SquareSet.empty()
    const piece = this.board.get(square)
    if (!piece || piece.color !== this.turn) return SquareSet.empty()

    let pseudo
    if (piece.role === 'pawn') {
      pseudo = pawnAttacks(this.turn, square).intersect(this.board[opposite(this.turn)])
      const delta = this.turn === 'white' ? 8 : -8
      const step = square + delta
      if (0 <= step && step < 64 && !this.board.occupied.has(step)) {
        pseudo = pseudo.with(step)
        const canDoubleStep = this.turn === 'white' ? square < 16 : square >= 64 - 16
        const doubleStep = step + delta
        if (canDoubleStep && !this.board.occupied.has(doubleStep)) {
          pseudo = pseudo.with(doubleStep)
        }
      }
    } else if (piece.role === 'bishop') pseudo = bishopAttacks(this.turn, square)
    else if (piece.role === 'knight') pseudo = knightAttacks(square)
    else if (piece.role === 'rook') pseudo = rookAttacks(square, this.board.occupied)
    else if (piece.role === 'queen') pseudo = queenAttacks(square)
    else pseudo = kingAttacks(square)

    pseudo = pseudo.diff(this.board[this.turn])

    // todo: not sure about this whole block, verify with debbuger
    if (defined(ctx.king)) {
      if (piece.role === 'king') {
        const occ = this.board.occupied.without(square)
        for (const to of pseudo) {
          if (this.kingAttackers(to, opposite(this.turn), occ).nonEmpty()) pseudo = pseudo.without(to)
        }
      }

      if (ctx.checkers.nonEmpty()) {
        const checker = ctx.checkers.singleSquare()
        if (!defined(checker)) return SquareSet.empty()
        pseudo = pseudo.intersect(between(checker, ctx.king).with(checker))
      }

      if (ctx.blockers.has(square)) pseudo = pseudo.intersect(ray(square, ctx.king))
    }

    return pseudo
  }

  isVariantEnd(): boolean {
    return false
  }

  variantOutcome(_ctx?: Context): Outcome | undefined {
    return
  }

  hasInsufficientMaterial(color: Color): boolean {
    if (this.board[color].intersect(this.board.pawn).nonEmpty()) return false
    if (this.board[color].intersects(this.board.knight)) {
      return (
        this.board[color].size() <= 2 &&
        this.board[opposite(color)].diff(this.board.king).diff(this.board.queen).isEmpty()
      )
    }
    if (this.board[color].intersects(this.board.bishop)) {
      const sameColor =
        !this.board.bishop.intersects(SquareSet.darkSquares()) ||
        !this.board.bishop.intersects(SquareSet.lightSquares())
      return sameColor && this.board.pawn.isEmpty() && this.board.knight.isEmpty()
    }
    return true
  }

  // The following should be identical in all subclasses

  toSetup(): Setup {
    return {
      board: this.board.clone(),
      turn: this.turn,
      remainingChecks: this.remainingChecks?.clone(),
      halfmoves: Math.min(this.halfmoves, 150),
      fullmoves: Math.min(Math.max(this.fullmoves, 1), 9999)
    }
  }

  isInsufficientMaterial(): boolean {
    return COLORS.every(color => this.hasInsufficientMaterial(color))
  }

  hasDests(ctx?: Context): boolean {
    ctx = ctx || this.ctx()
    for (const square of this.board[this.turn]) {
      if (this.dests(square, ctx).nonEmpty()) return true
    }
    return false
  }

  isLegal(move: Move, ctx?: Context): boolean {
    if (move.promotion === 'pawn') return false
    if (!!move.promotion !== (this.board.pawn.has(move.from) && SquareSet.backranks().has(move.to))) return false
    const dests = this.dests(move.from, ctx)
    return dests.has(move.to)
  }

  isCheck(): boolean {
    const king = this.board.kingOf(this.turn)
    return defined(king) && this.kingAttackers(king, opposite(this.turn), this.board.occupied).nonEmpty()
  }

  isEnd(ctx?: Context): boolean {
    if (ctx ? ctx.variantEnd : this.isVariantEnd()) return true
    return this.isInsufficientMaterial() || !this.hasDests(ctx)
  }

  isCheckmate(ctx?: Context): boolean {
    ctx = ctx || this.ctx()
    return !ctx.variantEnd && ctx.checkers.nonEmpty() && !this.hasDests(ctx)
  }

  isStalemate(ctx?: Context): boolean {
    ctx = ctx || this.ctx()
    return !ctx.variantEnd && ctx.checkers.isEmpty() && !this.hasDests(ctx)
  }

  outcome(ctx?: Context): Outcome | undefined {
    const variantOutcome = this.variantOutcome(ctx)
    if (variantOutcome) return variantOutcome
    ctx = ctx || this.ctx()
    if (this.isCheckmate(ctx)) return { winner: opposite(this.turn) }
    else if (this.isInsufficientMaterial() || this.isStalemate(ctx)) return { winner: undefined }
    else return
  }

  allDests(ctx?: Context): Map<Square, SquareSet> {
    ctx = ctx || this.ctx()
    const d = new Map()
    if (ctx.variantEnd) return d
    for (const square of this.board[this.turn]) {
      d.set(square, this.dests(square, ctx))
    }
    return d
  }

  play(move: Move): void {
    const turn = this.turn

    this.halfmoves += 1
    if (turn === 'black') this.fullmoves += 1
    this.turn = opposite(turn)

    const piece = this.board.take(move.from)
    if (!piece) return

    let epCapture: Piece | undefined
    if (piece.role === 'pawn') {
      this.halfmoves = 0

      if (move.promotion) {
        piece.role = move.promotion
        piece.promoted = true
      }
    }

    const capture = this.board.set(move.to, piece) || epCapture
    if (capture) this.halfmoves = 0

    if (this.remainingChecks) {
      if (this.isCheck()) this.remainingChecks[turn] = Math.max(this.remainingChecks[turn] - 1, 0)
    }
  }
}

export class Makruk extends Position {
  private constructor() {
    super('makruk')
  }

  static default(): Makruk {
    const pos = new this()
    pos.reset()
    return pos
  }

  static fromSetup(setup: Setup): Result<Makruk, PositionError> {
    const pos = new this()
    pos.setupUnchecked(setup)
    return pos.validate().map(_ => pos)
  }

  clone(): Makruk {
    return super.clone() as Makruk
  }
}

export const pseudoDests = (pos: Position, square: Square, ctx: Context): SquareSet => {
  if (ctx.variantEnd) return SquareSet.empty()
  const piece = pos.board.get(square)
  if (!piece || piece.color !== pos.turn) return SquareSet.empty()

  let pseudo = attacks(piece, square, pos.board.occupied)
  if (piece.role === 'pawn') {
    let captureTargets = pos.board[opposite(pos.turn)]
    pseudo = pseudo.intersect(captureTargets)
    const delta = pos.turn === 'white' ? 8 : -8
    const step = square + delta
    if (0 <= step && step < 64 && !pos.board.occupied.has(step)) {
      pseudo = pseudo.with(step)
      const canDoubleStep = pos.turn === 'white' ? square < 16 : square >= 64 - 16
      const doubleStep = step + delta
      if (canDoubleStep && !pos.board.occupied.has(doubleStep)) {
        pseudo = pseudo.with(doubleStep)
      }
    }
    return pseudo
  } else {
    pseudo = pseudo.diff(pos.board[pos.turn])
  }
  return pseudo
}

export const equalsIgnoreMoves = (left: Position, right: Position): boolean =>
  left.rules === right.rules &&
  boardEquals(left.board, right.board) &&
  left.turn === right.turn &&
  ((right.remainingChecks && left.remainingChecks?.equals(right.remainingChecks)) ||
    (!left.remainingChecks && !right.remainingChecks))

export const isStandardMaterialSide = (board: Board, color: Color): boolean => {
  const promoted =
    Math.max(board.pieces(color, 'queen').size() - 1, 0) +
    Math.max(board.pieces(color, 'rook').size() - 2, 0) +
    Math.max(board.pieces(color, 'knight').size() - 2, 0) +
    Math.max(board.pieces(color, 'bishop').intersect(SquareSet.lightSquares()).size() - 1, 0) +
    Math.max(board.pieces(color, 'bishop').intersect(SquareSet.darkSquares()).size() - 1, 0)
  return board.pieces(color, 'pawn').size() + promoted <= 8
}

export const isStandardMaterial = (pos: Makruk): boolean =>
  COLORS.every(color => isStandardMaterialSide(pos.board, color))

export const isImpossibleCheck = (pos: Position): boolean => {
  const ourKing = pos.board.kingOf(pos.turn)
  if (!defined(ourKing)) return false
  const checkers = pos.kingAttackers(ourKing, opposite(pos.turn), pos.board.occupied)
  if (checkers.isEmpty()) return false
  // Sliding checkers aligned with king.
  return checkers.size() > 2 || (checkers.size() === 2 && ray(checkers.first()!, checkers.last()!).has(ourKing))
}
