import { Square, Color } from './types';

function popcnt32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return ((n + (n >>> 4) & 0xf0f0f0f) * 0x1010101) >> 24;
}

function bswap32(n: number): number {
  n = (n >>> 8) & 0x00ff00ff | ((n & 0x00ff00ff) << 8);
  return (n >>> 16) & 0xffff | ((n & 0xffff) << 16);
}

function rbit32(n: number): number {
  n = ((n >>> 1) & 0x55555555) | ((n & 0x55555555) << 1);
  n = ((n >>> 2) & 0x33333333) | ((n & 0x33333333) << 2);
  n = ((n >>> 4) & 0x0f0f0f0f) | ((n & 0x0f0f0f0f) << 4);
  n = ((n >>> 8) & 0x00ff00ff) | ((n & 0x00ff00ff) << 8);
  n = ((n >>> 16) & 0x0000ffff) | ((n & 0x0000ffff) << 16);
  return n;
}

export default class SquareSet implements Iterable<Square> {
  constructor(readonly lo: number, readonly hi: number) {
    this.lo = lo | 0;
    this.hi = hi | 0;
  }

  static fromSquare(square: Square): SquareSet {
    return square >= 32 ?
      new SquareSet(0, 1 << (square - 32)) :
      new SquareSet(1 << square, 0);
  }

  static fromRank(rank: number): SquareSet {
    return new SquareSet(0xff, 0).shl64(8 * rank);
  }

  static fromFile(file: number): SquareSet {
    return new SquareSet(0x01010101 << file, 0x01010101 << file);
  }

  static empty(): SquareSet {
    return new SquareSet(0, 0);
  }

  static full(): SquareSet {
    return new SquareSet(0xffffffff, 0xffffffff);
  }

  static corners(): SquareSet {
    return new SquareSet(0x81, 0x81000000);
  }

  static center(): SquareSet {
    return new SquareSet(0x18000000, 0x18);
  }

  static backranks(): SquareSet {
    return new SquareSet(0xff, 0xff000000);
  }

  static backrank(color: Color): SquareSet {
    return color === 'white' ? new SquareSet(0xff, 0) : new SquareSet(0, 0xff000000);
  }

  static lightSquares(): SquareSet {
    return new SquareSet(0x55aa55aa, 0x55aa55aa);
  }

  static darkSquares(): SquareSet {
    return new SquareSet(0xaa55aa55, 0xaa55aa55);
  }

  complement(): SquareSet {
    return new SquareSet(~this.lo, ~this.hi);
  }

  xor(other: SquareSet): SquareSet {
    return new SquareSet(this.lo ^ other.lo, this.hi ^ other.hi);
  }

  union(other: SquareSet): SquareSet {
    return new SquareSet(this.lo | other.lo, this.hi | other.hi);
  }

  intersect(other: SquareSet): SquareSet {
    return new SquareSet(this.lo & other.lo, this.hi & other.hi);
  }

  diff(other: SquareSet): SquareSet {
    return new SquareSet(this.lo & ~other.lo, this.hi & ~other.hi);
  }

  intersects(other: SquareSet): boolean {
    return this.intersect(other).nonEmpty();
  }

  isDisjoint(other: SquareSet): boolean {
    return this.intersect(other).isEmpty();
  }

  supersetOf(other: SquareSet): boolean {
    return other.diff(this).isEmpty();
  }

  subsetOf(other: SquareSet): boolean {
    return this.diff(other).isEmpty();
  }

  shr64(shift: number): SquareSet {
    if (shift >= 64) return SquareSet.empty();
    if (shift >= 32) return new SquareSet(this.hi >>> (shift - 32), 0);
    if (shift > 0) return new SquareSet((this.lo >>> shift) ^ (this.hi << (32 - shift)), this.hi >>> shift);
    return this;
  }

  shl64(shift: number): SquareSet {
    if (shift >= 64) return SquareSet.empty();
    if (shift >= 32) return new SquareSet(0, this.lo << (shift - 32));
    if (shift > 0) return new SquareSet(this.lo << shift, (this.hi << shift) ^ (this.lo >>> (32 - shift)));
    return this;
  }

  bswap64(): SquareSet {
    return new SquareSet(bswap32(this.hi), bswap32(this.lo));
  }

  rbit64(): SquareSet {
    return new SquareSet(rbit32(this.hi), rbit32(this.lo));
  }

  equals(other: SquareSet): boolean {
    return this.lo === other.lo && this.hi === other.hi;
  }

  size(): number {
    return popcnt32(this.lo) + popcnt32(this.hi);
  }

  isEmpty(): boolean {
    return this.lo === 0 && this.hi === 0;
  }

  nonEmpty(): boolean {
    return this.lo !== 0 || this.hi !== 0;
  }

  has(square: Square): boolean {
    return !!(square >= 32 ? this.hi & (1 << (square - 32)) : this.lo & (1 << square));
  }

  set(square: Square, on: boolean): SquareSet {
    return on ? this.with(square) : this.without(square);
  }

  with(square: Square): SquareSet {
    return square >= 32 ?
      new SquareSet(this.lo, this.hi | (1 << (square - 32))) :
      new SquareSet(this.lo | (1 << square), this.hi);
  }

  without(square: Square): SquareSet {
    return square >= 32 ?
      new SquareSet(this.lo, this.hi & ~(1 << (square - 32))) :
      new SquareSet(this.lo & ~(1 << square), this.hi);
  }

  toggle(square: Square): SquareSet {
    return square >= 32 ?
      new SquareSet(this.lo, this.hi ^ (1 << (square - 32))) :
      new SquareSet(this.lo ^ (1 << square), this.hi);
  }

  last(): Square | undefined {
    if (this.hi !== 0) return 63 - Math.clz32(this.hi);
    if (this.lo !== 0) return 31 - Math.clz32(this.lo);
    return;
  }

  first(): Square | undefined {
    if (this.lo !== 0) return 31 - Math.clz32(this.lo & -this.lo);
    if (this.hi !== 0) return 63 - Math.clz32(this.hi & -this.hi);
    return;
  }

  moreThanOne(): boolean {
    return !!((this.hi && this.lo) || this.lo & (this.lo - 1) || this.hi & (this.hi - 1));
  }

  singleSquare(): Square | undefined {
    return this.moreThanOne() ? undefined : this.last();
  }

  isSingleSquare(): boolean {
    return this.nonEmpty() && !this.moreThanOne();
  }

  [Symbol.iterator](): Iterator<Square> {
    let lo = this.lo;
    let hi = this.hi;
    return {
      next(): IteratorResult<Square> {
        if (lo) {
          const idx = 31 - Math.clz32(lo & -lo);
          lo ^= 1 << idx;
          return { value: idx, done: false };
        }
        if (hi) {
          const idx = 31 - Math.clz32(hi & -hi);
          hi ^= 1 << idx;
          return { value: 32 + idx, done: false };
        }
        return { done: true } as IteratorResult<Square>;
      }
    };
  }

  reversed(): Iterable<Square> {
    let lo = this.lo;
    let hi = this.hi;
    return {
      [Symbol.iterator](): Iterator<Square> {
        return {
          next(): IteratorResult<Square> {
            if (hi) {
              const idx = 31 - Math.clz32(hi);
              hi ^= 1 << idx;
              return { value: 32 + idx, done: false };
            }
            if (lo) {
              const idx = 31 - Math.clz32(lo);
              lo ^= 1 << idx;
              return { value: idx, done: false };
            }
            return { done: true } as IteratorResult<Square>;
          }
        };
      }
    };
  }

  minus64(other: SquareSet): SquareSet {
    const lo = this.lo - other.lo;
    const c = ((lo & other.lo & 1) + (other.lo >>> 1) + (lo >>> 1)) >>> 31;
    return new SquareSet(lo, this.hi - (other.hi + c));
  }
}

export { SquareSet };
