export type Piece = [number, number];

export function createDeck(): Piece[] {
  const deck: Piece[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealHands(deck: Piece[]): { hand1: Piece[]; hand2: Piece[]; pile: Piece[] } {
  return {
    hand1: deck.slice(0, 7),
    hand2: deck.slice(7, 14),
    pile: deck.slice(14),
  };
}

export function canPlay(piece: Piece, leftEnd: number, rightEnd: number): boolean {
  return piece[0] === leftEnd || piece[1] === leftEnd || piece[0] === rightEnd || piece[1] === rightEnd;
}

export function getPlayableIndices(hand: Piece[], leftEnd: number, rightEnd: number): number[] {
  return hand.map((p, i) => canPlay(p, leftEnd, rightEnd) ? i : -1).filter(i => i >= 0);
}

export type BoardPiece = { piece: Piece; flipped: boolean };

export function playPiece(
  board: BoardPiece[],
  piece: Piece,
  side: "left" | "right",
  leftEnd: number,
  rightEnd: number
): { board: BoardPiece[]; leftEnd: number; rightEnd: number } {
  const newBoard = [...board];

  if (newBoard.length === 0) {
    newBoard.push({ piece, flipped: false });
    return { board: newBoard, leftEnd: piece[0], rightEnd: piece[1] };
  }

  if (side === "left") {
    let flipped = false;
    if (piece[0] === leftEnd) {
      // place [piece[1], piece[0]] so piece[1] is leftmost
      flipped = true;
    }
    newBoard.unshift({ piece, flipped });
    const newLeft = flipped ? piece[1] : piece[0];
    return { board: newBoard, leftEnd: newLeft, rightEnd };
  } else {
    let flipped = false;
    if (piece[1] === rightEnd) {
      flipped = true;
    }
    newBoard.push({ piece, flipped });
    const newRight = flipped ? piece[0] : piece[1];
    return { board: newBoard, leftEnd, rightEnd: newRight };
  }
}

export function countPips(hand: Piece[]): number {
  return hand.reduce((sum, p) => sum + p[0] + p[1], 0);
}
