import { Result } from '@badrap/result'
import { Piece, Color } from './types.js'
import { Board } from './board.js'
import { Setup, RemainingChecks } from './setup.js'
import { defined, roleToChar, charToRole } from './util.js'

export const INITIAL_BOARD_FEN = 'rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR'
export const INITIAL_EPD = INITIAL_BOARD_FEN + ' w - -'
export const INITIAL_FEN = INITIAL_EPD + ' 0 1'
export const EMPTY_BOARD_FEN = '8/8/8/8/8/8/8/8'
export const EMPTY_EPD = EMPTY_BOARD_FEN + ' w - -'
export const EMPTY_FEN = EMPTY_EPD + ' 0 1'

export enum InvalidFen {
  Fen = 'ERR_FEN',
  Board = 'ERR_BOARD',
  Turn = 'ERR_TURN',
  RemainingChecks = 'ERR_REMAINING_CHECKS',
  Halfmoves = 'ERR_HALFMOVES',
  Fullmoves = 'ERR_FULLMOVES'
}

export class FenError extends Error {}

const parseSmallUint = (str: string): number | undefined => (/^\d{1,4}$/.test(str) ? parseInt(str, 10) : undefined)

const charToPiece = (ch: string): Piece | undefined => {
  const role = charToRole(ch)
  return role && { role, color: ch.toLowerCase() === ch ? 'black' : 'white' }
}

export const parseBoardFen = (boardPart: string): Result<Board, FenError> => {
  const board = Board.empty()
  let rank = 7
  let file = 0
  for (let i = 0; i < boardPart.length; i++) {
    const c = boardPart[i]
    if (c === '/' && file === 8) {
      file = 0
      rank--
    } else {
      const step = parseInt(c, 10)
      if (step > 0) file += step
      else {
        if (file >= 8 || rank < 0) return Result.err(new FenError(InvalidFen.Board))
        const square = file + rank * 8
        const piece = charToPiece(c)
        if (!piece) return Result.err(new FenError(InvalidFen.Board))
        if (boardPart[i + 1] === '~') {
          piece.promoted = true
          i++
        }
        board.set(square, piece)
        file++
      }
    }
  }
  if (rank !== 0 || file !== 8) return Result.err(new FenError(InvalidFen.Board))
  return Result.ok(board)
}

export const parseRemainingChecks = (part: string): Result<RemainingChecks, FenError> => {
  const parts = part.split('+')
  if (parts.length === 3 && parts[0] === '') {
    const white = parseSmallUint(parts[1])
    const black = parseSmallUint(parts[2])
    if (!defined(white) || white > 3 || !defined(black) || black > 3)
      return Result.err(new FenError(InvalidFen.RemainingChecks))
    return Result.ok(new RemainingChecks(3 - white, 3 - black))
  } else if (parts.length === 2) {
    const white = parseSmallUint(parts[0])
    const black = parseSmallUint(parts[1])
    if (!defined(white) || white > 3 || !defined(black) || black > 3)
      return Result.err(new FenError(InvalidFen.RemainingChecks))
    return Result.ok(new RemainingChecks(white, black))
  } else return Result.err(new FenError(InvalidFen.RemainingChecks))
}

export const parseFen = (fen: string): Result<Setup, FenError> => {
  const parts = fen.split(/[\s_]+/)
  const boardPart = parts.shift()!

  // Board
  const board = parseBoardFen(boardPart)

  // Turn
  let turn: Color
  const turnPart = parts.shift()
  if (!defined(turnPart) || turnPart === 'w') turn = 'white'
  else if (turnPart === 'b') turn = 'black'
  else return Result.err(new FenError(InvalidFen.Turn))

  return board.chain(board => {
    // Halfmoves or remaining checks
    // todo: research how checks and moves are tracked in the fen for makruk
    let halfmovePart = parts.shift()
    let earlyRemainingChecks: Result<RemainingChecks, FenError> | undefined
    if (defined(halfmovePart) && halfmovePart.includes('+')) {
      earlyRemainingChecks = parseRemainingChecks(halfmovePart)
      halfmovePart = parts.shift()
    }
    const halfmoves = defined(halfmovePart) ? parseSmallUint(halfmovePart) : 0
    if (!defined(halfmoves)) return Result.err(new FenError(InvalidFen.Halfmoves))

    const fullmovesPart = parts.shift()
    const fullmoves = defined(fullmovesPart) ? parseSmallUint(fullmovesPart) : 1
    if (!defined(fullmoves)) return Result.err(new FenError(InvalidFen.Fullmoves))

    const remainingChecksPart = parts.shift()
    let remainingChecks: Result<RemainingChecks | undefined, FenError> = Result.ok(undefined)
    if (defined(remainingChecksPart)) {
      if (defined(earlyRemainingChecks)) return Result.err(new FenError(InvalidFen.RemainingChecks))
      remainingChecks = parseRemainingChecks(remainingChecksPart)
    } else if (defined(earlyRemainingChecks)) {
      remainingChecks = earlyRemainingChecks
    }

    if (parts.length > 0) return Result.err(new FenError(InvalidFen.Fen))

    return remainingChecks.map(remainingChecks => {
      return {
        board,
        turn,
        remainingChecks,
        halfmoves,
        fullmoves: Math.max(1, fullmoves)
      }
    })
  })
}

export interface FenOpts {
  epd?: boolean
}

export const parsePiece = (str: string): Piece | undefined => {
  if (!str) return
  const piece = charToPiece(str[0])
  if (!piece) return
  if (str.length === 2 && str[1] === '~') piece.promoted = true
  else if (str.length > 1) return
  return piece
}

export const makePiece = (piece: Piece): string => {
  let r = roleToChar(piece.role)
  if (piece.color === 'white') r = r.toUpperCase()
  if (piece.promoted) r += '~'
  return r
}

export const makeBoardFen = (board: Board): string => {
  let fen = ''
  let empty = 0
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = file + rank * 8
      const piece = board.get(square)
      if (!piece) empty++
      else {
        if (empty > 0) {
          fen += empty
          empty = 0
        }
        fen += makePiece(piece)
      }

      if (file === 7) {
        if (empty > 0) {
          fen += empty
          empty = 0
        }
        if (rank !== 0) fen += '/'
      }
    }
  }
  return fen
}

export const makeRemainingChecks = (checks: RemainingChecks): string => `${checks.white}+${checks.black}`

export const makeFen = (setup: Setup, opts?: FenOpts): string =>
  [
    makeBoardFen(setup.board) + '',
    setup.turn[0],
    ...(setup.remainingChecks ? [makeRemainingChecks(setup.remainingChecks)] : []),
    ...(opts?.epd ? [] : [Math.max(0, Math.min(setup.halfmoves, 9999)), Math.max(1, Math.min(setup.fullmoves, 9999))])
  ].join(' ')
