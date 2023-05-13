import { expect, test } from '@jest/globals'
import { parseFen } from './fen.js'
import { Makruk } from './makruk.js'
import { makrukgroundDests } from './compat.js'

test('makrukground dests with Kh8', () => {
  const setup = parseFen('r1bq1r2/3n2k1/p1p1pp2/3pP2P/8/PPNB2Q1/2P2P2/R3K3 b Q - 1 22').unwrap()
  const pos = Makruk.fromSetup(setup).unwrap()
  const dests = makrukgroundDests(pos)
  expect(dests.get('g7')).toContain('h8')
  expect(dests.get('g7')).not.toContain('g8')
})
