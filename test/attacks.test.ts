import { rookAttacks, ray, between } from '../src/attacks';
import { SquareSet } from '../src/squareSet';

test('rook attacks', () => {
  const d6 = 43;
  expect(rookAttacks(d6, new SquareSet(0x2826f5b9, 0x3f7f2880))).toEqual(new SquareSet(0x8000000, 0x83708));
  expect(rookAttacks(d6, SquareSet.empty())).toEqual(SquareSet.fromFile(3).xor(SquareSet.fromRank(5)));
});

test('ray', () => {
  expect(ray(0, 8)).toEqual(SquareSet.fromFile(0));
});

test('between', () => {
  expect(between(42, 42)).toEqual(SquareSet.empty());
  expect(between(0, 3).toArray()).toEqual([1, 2]);

  expect(between(61, 47).toArray()).toEqual([54]);
  expect(between(47, 61).toArray()).toEqual([54]);
});
