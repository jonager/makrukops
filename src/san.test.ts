import { expect, test } from '@jest/globals'
import { parseUci } from './util.js'
import { makeSan, makeSanVariation, parseSan } from './san.js'
import { Makruk } from './makruk.js'
import { parseFen, makeFen } from './fen.js'

test('make variation with king move', () => {
  const pos = Makruk.default()
  const variation = 'e2e4 e7e5 e1e2'.split(' ').map(uci => parseUci(uci)!)
  expect(makeSanVariation(pos, variation)).toBe('1. e4 e5 2. Ke2')
  expect(pos).toEqual(Makruk.default())
})

test('make stockfish line with many knight moves', () => {
  const setup = parseFen('2rq1rk1/pb1nbp1p/1pn3p1/3pP3/2pP4/1N3NPQ/PP3PBP/R1B1R1K1 w - - 0 16').unwrap()
  const pos = Makruk.fromSetup(setup).unwrap()
  const variation =
    'b3d2 c6b4 e1d1 f8e8 d2f1 b4d3 f3e1 d3e1 d1e1 d7f8 f2f4 f8e6 c1e3 h7h5 f4f5 e6g5 e3g5 e7g5 f5f6 d8c7'
      .split(' ')
      .map(uci => parseUci(uci)!)
  expect(makeSanVariation(pos, variation)).toBe(
    '16. Nbd2 Nb4 17. Rd1 Re8 18. Nf1 Nd3 19. Ne1 Nxe1 20. Rxe1 Nf8 21. f4 Ne6 22. Be3 h5 23. f5 Ng5 24. Bxg5 Bxg5 25. f6 Qc7'
  )
  expect(pos).toEqual(Makruk.fromSetup(setup).unwrap())
})

test('make en passant', () => {
  const setup = parseFen('6bk/7b/8/3pP3/8/8/8/Q3K3 w - d6 0 2').unwrap()
  const pos = Makruk.fromSetup(setup).unwrap()
  const move = parseUci('e5d6')!
  expect(makeSan(pos, move)).toBe('exd6#')
})

test('parse basic san', () => {
  const pos = Makruk.default()
  expect(parseSan(pos, 'e4')).toEqual(parseUci('e2e4'))
  expect(parseSan(pos, 'Nf3')).toEqual(parseUci('g1f3'))
  expect(parseSan(pos, 'Nf6')).toBeUndefined()
  expect(parseSan(pos, 'Ke2')).toBeUndefined()
  expect(parseSan(pos, 'O-O')).toBeUndefined()
  expect(parseSan(pos, 'O-O-O')).toBeUndefined()
  expect(parseSan(pos, 'Q@e3')).toBeUndefined()
})

test('parse fools mate', () => {
  const pos = Makruk.default()
  const line = ['e4', 'e5', 'Qh5', 'Nf6', 'Bc4', 'Nc6', 'Qxf7#']
  for (const san of line) pos.play(parseSan(pos, san)!)
  expect(pos.isCheckmate()).toBe(true)
})

test('parse pawn capture', () => {
  let pos = Makruk.default()
  const line = ['e4', 'd5', 'c4', 'Nf6', 'exd5']
  for (const san of line) pos.play(parseSan(pos, san)!)
  expect(makeFen(pos.toSetup())).toBe('rnbqkb1r/ppp1pppp/5n2/3P4/2P5/8/PP1P1PPP/RNBQKBNR b KQkq - 0 3')

  pos = Makruk.fromSetup(parseFen('r4br1/pp1Npkp1/2P4p/5P2/6P1/5KnP/PP6/R1B5 b - -').unwrap()).unwrap()
  expect(parseSan(pos, 'bxc6')).toEqual({ from: 49, to: 42 })

  pos = Makruk.fromSetup(parseFen('2rq1rk1/pb2bppp/1p2p3/n1ppPn2/2PP4/PP3N2/1B1NQPPP/RB3RK1 b - -').unwrap()).unwrap()
  expect(parseSan(pos, 'c4')).toBeUndefined() // missing file
})

test('overspecified pawn move', () => {
  const pos = Makruk.default()
  expect(parseSan(pos, '2e4')).toEqual({ from: 12, to: 28 })
})
