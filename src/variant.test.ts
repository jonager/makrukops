import { expect, test } from '@jest/globals'
import { RULES } from './types.js'
import { defaultPosition, isStandardMaterial } from './variant.js'

test.each(RULES)('%s standard material', rules => {
  expect(isStandardMaterial(defaultPosition(rules))).toBe(true)
})
