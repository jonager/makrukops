import { Result } from '@badrap/result'
import { COLORS, Rules } from './types.js'
import { Setup } from './setup.js'
import {
  PositionError,
  Position,
  IllegalSetup,
  Context,
  Makruk,
  equalsIgnoreMoves,
  normalizeMove,
  isStandardMaterialSide,
  isImpossibleCheck
} from './makruk.js'

export { Position, PositionError, IllegalSetup, Context, Makruk, equalsIgnoreMoves, normalizeMove, isImpossibleCheck }

export const defaultPosition = (rules: Rules): Position => {
  switch (rules) {
    case 'makruk':
      return Makruk.default()
  }
}

export const setupPosition = (rules: Rules, setup: Setup): Result<Position, PositionError> => {
  switch (rules) {
    case 'makruk':
      return Makruk.fromSetup(setup)
  }
}

export const isStandardMaterial = (pos: Position): boolean => {
  switch (pos.rules) {
    case 'makruk':
      return COLORS.every(color => isStandardMaterialSide(pos.board, color))
  }
}
