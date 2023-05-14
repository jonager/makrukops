# chessops

[![Test](https://github.com/niklasf/chessops/workflows/Test/badge.svg)](https://github.com/niklasf/chessops/actions)
[![npm](https://img.shields.io/npm/v/chessops)](https://www.npmjs.com/package/chessops)

Makruk rules and operations in TypeScript.

## Features

- Read and write FEN
- Vocabulary
  - `Square`
  - `SquareSet` (implemented as bitboards)
  - `Color`
  - `Role` (piece type)
  - `Piece` (`Role` and `Color`)
  - `Board` (map of piece positions)
  - `Setup` (a not necessarily legal position)
  - `Position` (base class for legal positions, `Makruk` is a concrete implementation)
- Attacks and rays
  using Hyperbola Quintessence (faster to initialize than Magic Bitboards)
- Read and write UCI move notation
- Read and write SAN
- Read and write PGN
  - Parser supports asynchronous streaming
  - Game tree model
  - Transform game tree to augment nodes with arbitrary user data
  - Parse comments with evaluations, clocks and shapes
- Transformations: Mirroring and rotating
- Compatibility:
  [makrukground](https://github.com/thaichess-org/makrukground)

## Example

```javascript
import { parseFen } from 'makrukops/fen';
import { Makruk } from 'makrukops/makruk';

const setup = parseFen('rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR 2 - - 0 1').unwrap();
const pos = Makruk.fromSetup(setup).unwrap();
console.assert(pos.isLegal());
```

## License

makrukops is licensed under the GNU General Public License 3 or any later
version at your choice. See LICENSE.txt for details.
