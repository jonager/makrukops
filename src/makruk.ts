import { Result } from '@badrap/result'
import {
  Rules,
  CastlingSide,
  CASTLING_SIDES,
  Color,
  COLORS,
  Square,
  ByColor,
  ByCastlingSide,
  Move,
  NormalMove,
  isDrop,
  Piece,
  Outcome
} from './types.js'
import { SquareSet } from './squareSet.js'
import { Board, boardEquals } from './board.js'
import { Setup, Material, RemainingChecks } from './setup.js'
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
import { kingCastlesTo, rookCastlesTo, opposite, defined, squareRank } from './util.js'

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
      .intersect(board.rooksAndQueens())
      .union(bishopAttacks(square, occupied).intersect(board.bishopsAndQueens()))
      .union(knightAttacks(square).intersect(board.knight))
      .union(kingAttacks(square).intersect(board.king))
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
  pockets: Material | undefined
  turn: Color
  epSquare: Square | undefined
  remainingChecks: RemainingChecks | undefined
  halfmoves: number
  fullmoves: number

  protected constructor(readonly rules: Rules) {}

  reset() {
    this.board = Board.default()
    this.pockets = undefined
    this.turn = 'white'
    this.epSquare = undefined
    this.remainingChecks = undefined
    this.halfmoves = 0
    this.fullmoves = 1
  }

  protected setupUnchecked(setup: Setup) {
    this.board = setup.board.clone()
    this.board.promoted = SquareSet.empty()
    this.pockets = undefined
    this.turn = setup.turn
    this.epSquare = validEpSquare(this, setup.epSquare)
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
  // - isVariantEnd()
  // - variantOutcome()
  // - hasInsufficientMaterial()
  // - isStandardMaterial()

  kingAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet {
    return attacksTo(square, attacker, this.board, occupied)
  }

  protected playCaptureAt(square: Square, captured: Piece): void {
    this.halfmoves = 0
    if (this.pockets) this.pockets[opposite(captured.color)][captured.promoted ? 'pawn' : captured.role]++
  }

  ctx(): Context {
    const variantEnd = this.isVariantEnd()
    const king = this.board.kingOf(this.turn)
    if (!defined(king))
      return { king, blockers: SquareSet.empty(), checkers: SquareSet.empty(), variantEnd, mustCapture: false }
    const snipers = rookAttacks(king, SquareSet.empty())
      .intersect(this.board.rooksAndQueens())
      .union(bishopAttacks(king, SquareSet.empty()).intersect(this.board.bishopsAndQueens()))
      .intersect(this.board[opposite(this.turn)])
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
    pos.pockets = this.pockets?.clone()
    pos.turn = this.turn
    pos.epSquare = this.epSquare
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

  dropDests(_ctx?: Context): SquareSet {
    return SquareSet.empty()
  }

  dests(square: Square, ctx?: Context): SquareSet {
    ctx = ctx || this.ctx()
    if (ctx.variantEnd) return SquareSet.empty()
    const piece = this.board.get(square)
    if (!piece || piece.color !== this.turn) return SquareSet.empty()

    let pseudo, legal
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
      if (defined(this.epSquare) && canCaptureEp(this, square, ctx)) {
        legal = SquareSet.fromSquare(this.epSquare)
      }
    } else if (piece.role === 'bishop') pseudo = bishopAttacks(square, this.board.occupied)
    else if (piece.role === 'knight') pseudo = knightAttacks(square)
    else if (piece.role === 'rook') pseudo = rookAttacks(square, this.board.occupied)
    else if (piece.role === 'queen') pseudo = queenAttacks(square, this.board.occupied)
    else pseudo = kingAttacks(square)

    pseudo = pseudo.diff(this.board[this.turn])

    // todo: check this
    // if (defined(ctx.king)) {
    //   if (piece.role === 'king') {
    //     const occ = this.board.occupied.without(square)
    //     for (const to of pseudo) {
    //       if (this.kingAttackers(to, opposite(this.turn), occ).nonEmpty()) pseudo = pseudo.without(to)
    //     }
    //     return pseudo.union(castlingDest(this, 'a', ctx)).union(castlingDest(this, 'h', ctx))
    //   }

    //   if (ctx.checkers.nonEmpty()) {
    //     const checker = ctx.checkers.singleSquare()
    //     if (!defined(checker)) return SquareSet.empty()
    //     pseudo = pseudo.intersect(between(checker, ctx.king).with(checker))
    //   }

    //   if (ctx.blockers.has(square)) pseudo = pseudo.intersect(ray(square, ctx.king))
    // }

    if (legal) pseudo = pseudo.union(legal)
    return pseudo
  }

  isVariantEnd(): boolean {
    return false
  }

  variantOutcome(_ctx?: Context): Outcome | undefined {
    return
  }

  hasInsufficientMaterial(color: Color): boolean {
    if (this.board[color].intersect(this.board.pawn.union(this.board.rooksAndQueens())).nonEmpty()) return false
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
      pockets: this.pockets?.clone(),
      turn: this.turn,
      epSquare: legalEpSquare(this),
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
    return this.dropDests(ctx).nonEmpty()
  }

  isLegal(move: Move, ctx?: Context): boolean {
    if (isDrop(move)) {
      if (!this.pockets || this.pockets[this.turn][move.role] <= 0) return false
      if (move.role === 'pawn' && SquareSet.backranks().has(move.to)) return false
      return this.dropDests(ctx).has(move.to)
    } else {
      if (move.promotion === 'pawn') return false
      if (!!move.promotion !== (this.board.pawn.has(move.from) && SquareSet.backranks().has(move.to))) return false
      const dests = this.dests(move.from, ctx)
      return dests.has(move.to) || dests.has(normalizeMove(this, move).to)
    }
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
    const epSquare = this.epSquare

    this.epSquare = undefined
    this.halfmoves += 1
    if (turn === 'black') this.fullmoves += 1
    this.turn = opposite(turn)

    if (isDrop(move)) {
      this.board.set(move.to, { role: move.role, color: turn })
      if (this.pockets) this.pockets[turn][move.role]--
      if (move.role === 'pawn') this.halfmoves = 0
    } else {
      const piece = this.board.take(move.from)
      if (!piece) return

      let epCapture: Piece | undefined
      if (piece.role === 'pawn') {
        this.halfmoves = 0
        if (move.to === epSquare) {
          epCapture = this.board.take(move.to + (turn === 'white' ? -8 : 8))
        }
        const delta = move.from - move.to
        if (Math.abs(delta) === 16 && 8 <= move.from && move.from <= 55) {
          this.epSquare = (move.from + move.to) >> 1
        }
        if (move.promotion) {
          piece.role = move.promotion
          piece.promoted = !!this.pockets
        }
      }

      const capture = this.board.set(move.to, piece) || epCapture
      if (capture) this.playCaptureAt(move.to, capture)
    }

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

const validEpSquare = (pos: Position, square: Square | undefined): Square | undefined => {
  if (!defined(square)) return
  const epRank = pos.turn === 'white' ? 5 : 2
  const forward = pos.turn === 'white' ? 8 : -8
  if (squareRank(square) !== epRank) return
  if (pos.board.occupied.has(square + forward)) return
  const pawn = square - forward
  if (!pos.board.pawn.has(pawn) || !pos.board[opposite(pos.turn)].has(pawn)) return
  return square
}

const legalEpSquare = (pos: Position): Square | undefined => {
  if (!defined(pos.epSquare)) return
  const ctx = pos.ctx()
  const ourPawns = pos.board.pieces(pos.turn, 'pawn')
  const candidates = ourPawns.intersect(pawnAttacks(opposite(pos.turn), pos.epSquare))
  for (const candidate of candidates) {
    if (pos.dests(candidate, ctx).has(pos.epSquare)) return pos.epSquare
  }
  return
}

const canCaptureEp = (pos: Position, pawnFrom: Square, ctx: Context): boolean => {
  if (!defined(pos.epSquare)) return false
  if (!pawnAttacks(pos.turn, pawnFrom).has(pos.epSquare)) return false
  if (!defined(ctx.king)) return true
  const delta = pos.turn === 'white' ? 8 : -8
  const captured = pos.epSquare - delta
  return pos
    .kingAttackers(
      ctx.king,
      opposite(pos.turn),
      pos.board.occupied.toggle(pawnFrom).toggle(captured).with(pos.epSquare)
    )
    .without(captured)
    .isEmpty()
}

export const pseudoDests = (pos: Position, square: Square, ctx: Context): SquareSet => {
  if (ctx.variantEnd) return SquareSet.empty()
  const piece = pos.board.get(square)
  if (!piece || piece.color !== pos.turn) return SquareSet.empty()

  let pseudo = attacks(piece, square, pos.board.occupied)
  if (piece.role === 'pawn') {
    let captureTargets = pos.board[opposite(pos.turn)]
    if (defined(pos.epSquare)) captureTargets = captureTargets.with(pos.epSquare)
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
  // todo: check this
  // if (square === ctx.king) return pseudo.union(castlingDest(pos, 'a', ctx)).union(castlingDest(pos, 'h', ctx))
  // else return pseudo
  return pseudo
}

export const equalsIgnoreMoves = (left: Position, right: Position): boolean =>
  left.rules === right.rules &&
  boardEquals(left.board, right.board) &&
  ((right.pockets && left.pockets?.equals(right.pockets)) || (!left.pockets && !right.pockets)) &&
  left.turn === right.turn &&
  legalEpSquare(left) === legalEpSquare(right) &&
  ((right.remainingChecks && left.remainingChecks?.equals(right.remainingChecks)) ||
    (!left.remainingChecks && !right.remainingChecks))

export const normalizeMove = (pos: Position, move: Move): Move => {
  // leave like this for now, not needed anymore
  return move
}

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
  if (defined(pos.epSquare)) {
    // The pushed pawn must be the only checker, or it has uncovered
    // check by a single sliding piece.
    const pushedTo = pos.epSquare ^ 8
    const pushedFrom = pos.epSquare ^ 24
    return (
      checkers.moreThanOne() ||
      (checkers.first()! !== pushedTo &&
        pos
          .kingAttackers(ourKing, opposite(pos.turn), pos.board.occupied.without(pushedTo).with(pushedFrom))
          .nonEmpty())
    )
  } else {
    // Sliding checkers aligned with king.
    return checkers.size() > 2 || (checkers.size() === 2 && ray(checkers.first()!, checkers.last()!).has(ourKing))
  }
}
