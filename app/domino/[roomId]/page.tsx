"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  Piece, BoardPiece, createDeck, dealHands,
  getPlayableIndices, playPiece, countPips
} from "@/lib/domino";

type GameState = {
  myHand: Piece[];
  oppHandCount: number;
  board: BoardPiece[];
  leftEnd: number;
  rightEnd: number;
  pile: Piece[];
  currentTurn: "host" | "guest";
  scores: { host: number; guest: number };
  passCount: number;
};

export default function DominoGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get("name") || "Jogador";
  const role = searchParams.get("role") as "host" | "guest";

  const [status, setStatus] = useState<"waiting" | "playing" | "finished">("waiting");
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [gs, setGs] = useState<GameState>({
    myHand: [], oppHandCount: 0, board: [],
    leftEnd: -1, rightEnd: -1, pile: [],
    currentTurn: "host", scores: { host: 0, guest: 0 }, passCount: 0,
  });
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/domino/${roomId}?name=SeuNome&role=guest`
    : "";

  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // Host starts the game
  function startGame(existingScores?: { host: number; guest: number }) {
    const deck = createDeck();
    const { hand1, hand2, pile } = dealHands(deck);
    const scores = existingScores || { host: 0, guest: 0 };
    const state: GameState = {
      myHand: hand1,
      oppHandCount: hand2.length,
      board: [],
      leftEnd: -1,
      rightEnd: -1,
      pile,
      currentTurn: "host",
      scores,
      passCount: 0,
    };
    setGs(state);
    setStatus("playing");
    setResult(null);
    setSelected(null);
    setMessage("");

    // Send guest their hand
    broadcast("game_start", {
      guestHand: hand2,
      hostHandCount: hand1.length,
      pile,
      scores,
    });
  }

  useEffect(() => {
    const channel = supabase.channel(`domino:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "join" }, ({ payload }) => {
        setOpponentName(payload.name);
        setStatus("playing");
        startGame();
      })
      .on("broadcast", { event: "opponent_name" }, ({ payload }) => {
        setOpponentName(payload.name);
      })
      .on("broadcast", { event: "game_start" }, ({ payload }) => {
        setGs(prev => ({
          ...prev,
          myHand: payload.guestHand,
          oppHandCount: payload.hostHandCount,
          board: [],
          leftEnd: -1,
          rightEnd: -1,
          pile: payload.pile,
          currentTurn: "host",
          scores: payload.scores,
          passCount: 0,
        }));
        setStatus("playing");
        setResult(null);
        setSelected(null);
        setMessage("");
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        // Opponent played a piece
        setGs(prev => ({
          ...prev,
          board: payload.board,
          leftEnd: payload.leftEnd,
          rightEnd: payload.rightEnd,
          oppHandCount: payload.oppHandCount,
          currentTurn: payload.currentTurn,
          passCount: payload.passCount || 0,
        }));
        setMessage(`${opponentName || "Oponente"} jogou uma peça`);
        if (payload.finished) {
          setResult(payload.result);
          setStatus("finished");
          setGs(prev => ({ ...prev, scores: payload.scores }));
        }
      })
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        // Opponent drew from pile
        setGs(prev => ({
          ...prev,
          pile: payload.pile,
          oppHandCount: payload.oppHandCount,
          currentTurn: payload.currentTurn,
          passCount: payload.passCount || 0,
        }));
        setMessage(`${opponentName || "Oponente"} comprou uma peça`);
      })
      .on("broadcast", { event: "pass" }, ({ payload }) => {
        setGs(prev => ({
          ...prev,
          currentTurn: payload.currentTurn,
          passCount: payload.passCount,
        }));
        setMessage(`${opponentName || "Oponente"} passou`);
        if (payload.finished) {
          setResult(payload.result);
          setStatus("finished");
          setGs(prev => ({ ...prev, scores: payload.scores }));
        }
      })
      .on("broadcast", { event: "request_reset" }, () => {
        if (role === "host") {
          startGame(gs.scores);
        }
      })
      .subscribe(() => {
        if (role === "guest") {
          channel.send({ type: "broadcast", event: "join", payload: { name } });
        } else {
          channel.send({ type: "broadcast", event: "opponent_name", payload: { name } });
        }
      });

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, role, name]);

  const isMyTurn = gs.currentTurn === role && status === "playing";
  const playable = isMyTurn ? getPlayableIndices(gs.myHand, gs.leftEnd, gs.rightEnd) : [];
  const canDraw = isMyTurn && playable.length === 0 && gs.pile.length > 0;
  const canPass = isMyTurn && playable.length === 0 && gs.pile.length === 0;

  function handlePlay(idx: number, side: "left" | "right") {
    if (!isMyTurn || !playable.includes(idx)) return;
    const piece = gs.myHand[idx];
    const { board, leftEnd, rightEnd } = playPiece(
      gs.board, piece, side, gs.leftEnd, gs.rightEnd
    );
    const newHand = gs.myHand.filter((_, i) => i !== idx);
    const nextTurn = role === "host" ? "guest" : "host";

    let finished = false;
    let result = "";
    let newScores = { ...gs.scores };

    if (newHand.length === 0) {
      finished = true;
      result = "Você venceu! Bateu as peças! 🎉";
      newScores[role] += 1;
    }

    setGs(prev => ({
      ...prev,
      myHand: newHand,
      board,
      leftEnd,
      rightEnd,
      currentTurn: nextTurn,
      scores: newScores,
      passCount: 0,
    }));
    setSelected(null);
    setMessage("");

    broadcast("move", {
      board,
      leftEnd,
      rightEnd,
      oppHandCount: newHand.length,
      currentTurn: nextTurn,
      finished,
      result: finished ? (role === "host" ? `${name} venceu!` : `${name} venceu!`) : "",
      scores: newScores,
      passCount: 0,
    });

    if (finished) {
      setResult("Você venceu! 🎉");
      setStatus("finished");
    }
  }

  function handleDraw() {
    if (!canDraw) return;
    const drawn = gs.pile[0];
    const newPile = gs.pile.slice(1);
    const newHand = [...gs.myHand, drawn];
    const nextTurn = role === "host" ? "guest" : "host";

    const newPlayable = getPlayableIndices(newHand, gs.leftEnd, gs.rightEnd);
    if (newPlayable.length > 0) {
      // Drew and can play — keep turn
      setGs(prev => ({ ...prev, myHand: newHand, pile: newPile }));
      setMessage("Você comprou uma peça");
      broadcast("draw", {
        pile: newPile,
        oppHandCount: newHand.length,
        currentTurn: role,
        passCount: 0,
      });
    } else {
      setGs(prev => ({ ...prev, myHand: newHand, pile: newPile, currentTurn: nextTurn }));
      setMessage("Você comprou uma peça e passou");
      broadcast("draw", {
        pile: newPile,
        oppHandCount: newHand.length,
        currentTurn: nextTurn,
        passCount: 0,
      });
    }
  }

  function handlePass() {
    if (!canPass) return;
    const nextTurn = role === "host" ? "guest" : "host";
    const newPassCount = gs.passCount + 1;

    let finished = false;
    let result = "";
    let newScores = { ...gs.scores };

    if (newPassCount >= 2) {
      // Both passed — game over, count pips
      finished = true;
      const myPips = countPips(gs.myHand);
      // We don't have opp hand locally, so just declare blocked
      result = "Jogo bloqueado! Contando pontos...";
      // Whoever has fewer pips wins — but we can only know our own
      // We'll just say "game blocked"
    }

    setGs(prev => ({ ...prev, currentTurn: nextTurn, passCount: newPassCount, scores: newScores }));
    broadcast("pass", {
      currentTurn: nextTurn,
      passCount: newPassCount,
      finished,
      result,
      scores: newScores,
    });

    if (finished) {
      setResult("Jogo bloqueado! Ninguém pode jogar.");
      setStatus("finished");
    } else {
      setMessage("Você passou");
    }
  }

  function handleReset() {
    if (role === "host") {
      startGame(gs.scores);
    } else {
      broadcast("request_reset", {});
      setMessage("Pedindo nova partida...");
    }
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#0f172a', color: '#f1f5f9' }}>
      <div className="flex flex-col h-screen max-w-2xl mx-auto w-full p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">⬛ Dominó</h1>
            <div className="text-xs font-mono" style={{ color: '#64748b' }}>Sala: {roomId}</div>
          </div>
          <div className="text-right">
            <div className="text-sm" style={{ color: '#94a3b8' }}>
              {name} <span style={{ color: '#6366f1' }}>{gs.scores[role]}</span>
              {" "}<span style={{ color: '#475569' }}>-</span>{" "}
              <span style={{ color: '#6366f1' }}>{gs.scores[role === "host" ? "guest" : "host"]}</span> {opponentName || "..."}
            </div>
          </div>
        </div>

        {/* Waiting */}
        {status === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="p-6 rounded-xl text-center" style={{ background: '#1e293b' }}>
              <p className="mb-3" style={{ color: '#94a3b8' }}>Aguardando oponente...</p>
              <div className="text-xs font-mono p-2 rounded break-all mb-3" style={{ background: '#0f172a', color: '#6366f1' }}>
                {shareUrl}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="text-xs px-3 py-2 rounded-lg font-semibold"
                style={{ background: '#4f46e5', color: 'white' }}
              >
                📋 Copiar Link
              </button>
            </div>
          </div>
        )}

        {status !== "waiting" && (
          <>
            {/* Opponent info */}
            <div className="flex items-center justify-between mb-2 px-3 py-2 rounded-lg" style={{ background: '#1e293b' }}>
              <span className="text-sm" style={{ color: '#94a3b8' }}>
                {opponentName || "Oponente"}: {gs.oppHandCount} peças
                {gs.pile.length > 0 && <span style={{ color: '#64748b' }}> | Estoque: {gs.pile.length}</span>}
              </span>
              {!isMyTurn && status === "playing" && (
                <span className="text-xs px-2 py-1 rounded" style={{ background: '#7c3aed', color: 'white' }}>Vez dele</span>
              )}
            </div>

            {/* Board */}
            <div className="flex-1 overflow-x-auto flex items-center rounded-xl mb-3" style={{ background: '#1e293b', minHeight: '120px' }}>
              {gs.board.length === 0 ? (
                <div className="w-full text-center" style={{ color: '#475569' }}>
                  {isMyTurn ? "Jogue uma peça para começar" : "Aguardando..."}
                </div>
              ) : (
                <div className="flex items-center gap-1 p-3 min-w-max">
                  {gs.board.map((bp, i) => {
                    const [a, b] = bp.flipped ? [bp.piece[1], bp.piece[0]] : bp.piece;
                    const isLeft = i === 0;
                    const isRight = i === gs.board.length - 1;
                    return (
                      <div key={i} className="flex flex-col items-center">
                        {(isLeft || isRight) && (
                          <div className="flex gap-1 mb-1">
                            {isLeft && playable.length > 0 && selected !== null && isMyTurn && (
                              <button
                                onClick={() => handlePlay(selected, "left")}
                                className="text-xs px-2 py-0.5 rounded font-bold"
                                style={{ background: '#15803d', color: 'white' }}
                              >
                                ← Esq
                              </button>
                            )}
                            {isRight && playable.length > 0 && selected !== null && isMyTurn && (
                              <button
                                onClick={() => handlePlay(selected, "right")}
                                className="text-xs px-2 py-0.5 rounded font-bold"
                                style={{ background: '#15803d', color: 'white' }}
                              >
                                Dir →
                              </button>
                            )}
                          </div>
                        )}
                        <DominoPiece a={a} b={b} small />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message */}
            {message && (
              <div className="text-center text-sm mb-2" style={{ color: '#94a3b8' }}>{message}</div>
            )}

            {/* Turn indicator */}
            <div className="text-center mb-2">
              <span className="px-3 py-1 rounded-lg text-sm font-semibold" style={{
                background: isMyTurn ? '#14532d' : '#1e293b',
                color: isMyTurn ? '#4ade80' : '#64748b',
              }}>
                {isMyTurn ? "✅ Sua vez!" : `⌛ Vez de ${opponentName || "..."}`}
              </span>
            </div>

            {/* Action buttons */}
            {isMyTurn && (
              <div className="flex gap-2 mb-3 justify-center">
                {canDraw && (
                  <button
                    onClick={handleDraw}
                    className="px-4 py-2 rounded-lg font-semibold text-sm"
                    style={{ background: '#0e7490', color: 'white' }}
                  >
                    🃏 Comprar ({gs.pile.length})
                  </button>
                )}
                {canPass && (
                  <button
                    onClick={handlePass}
                    className="px-4 py-2 rounded-lg font-semibold text-sm"
                    style={{ background: '#92400e', color: 'white' }}
                  >
                    ⏭ Passar
                  </button>
                )}
                {selected !== null && gs.board.length === 0 && (
                  <button
                    onClick={() => handlePlay(selected, "right")}
                    className="px-4 py-2 rounded-lg font-semibold text-sm"
                    style={{ background: '#15803d', color: 'white' }}
                  >
                    ▶ Jogar
                  </button>
                )}
              </div>
            )}

            {/* My hand */}
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-2 min-w-max px-1">
                {gs.myHand.map((piece, i) => {
                  const isPlayable = playable.includes(i);
                  const isSelected = selected === i;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!isMyTurn || !isPlayable) return;
                        if (isSelected) {
                          setSelected(null);
                        } else {
                          setSelected(i);
                          // If board is empty, play immediately
                          if (gs.board.length === 0) {
                            setSelected(i);
                          } else if (gs.board.length > 0) {
                            // Check if only one side possible
                            const [a, b] = piece;
                            const canLeft = a === gs.leftEnd || b === gs.leftEnd;
                            const canRight = a === gs.rightEnd || b === gs.rightEnd;
                            if (canLeft && !canRight) {
                              handlePlay(i, "left");
                            } else if (!canLeft && canRight) {
                              handlePlay(i, "right");
                            } else {
                              setSelected(i);
                            }
                          }
                        }
                      }}
                      className="transition-all"
                      style={{
                        opacity: isMyTurn && !isPlayable ? 0.4 : 1,
                        transform: isSelected ? 'translateY(-8px)' : 'none',
                        cursor: isMyTurn && isPlayable ? 'pointer' : 'default',
                      }}
                    >
                      <DominoPiece a={piece[0]} b={piece[1]} highlighted={isSelected} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Finished */}
        {status === "finished" && result && (
          <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="p-8 rounded-2xl text-center" style={{ background: '#1e293b' }}>
              <p className="text-3xl font-bold mb-4">{result}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl font-bold"
                  style={{ background: '#4f46e5', color: 'white' }}
                >
                  {role === "host" ? "Nova Partida" : "Pedir Revanche"}
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 rounded-xl font-bold"
                  style={{ background: '#334155', color: 'white' }}
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="mt-2 text-center text-xs underline"
          style={{ color: '#475569' }}
        >
          ← Sair
        </button>
      </div>
    </main>
  );
}

function DominoPiece({ a, b, small, highlighted }: {
  a: number; b: number; small?: boolean; highlighted?: boolean;
}) {
  const size = small ? 36 : 48;
  const dotSize = small ? 5 : 7;
  const gap = small ? 'gap-0.5' : 'gap-1';

  return (
    <div
      className={`flex flex-col items-center rounded border-2 ${gap}`}
      style={{
        background: highlighted ? '#312e81' : '#f8fafc',
        borderColor: highlighted ? '#818cf8' : '#94a3b8',
        padding: small ? '2px' : '4px',
        width: size,
      }}
    >
      <DiceFace value={a} size={size} dotSize={dotSize} />
      <div style={{ height: 1, background: '#94a3b8', width: '100%' }} />
      <DiceFace value={b} size={size} dotSize={dotSize} />
    </div>
  );
}

const DOT_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DiceFace({ value, size, dotSize }: { value: number; size: number; dotSize: number }) {
  const positions = DOT_POSITIONS[value] || [];
  return (
    <div className="relative" style={{ width: size - 8, height: size - 8 }}>
      {positions.map(([cx, cy], i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            background: '#1e293b',
            left: `calc(${cx}% - ${dotSize / 2}px)`,
            top: `calc(${cy}% - ${dotSize / 2}px)`,
          }}
        />
      ))}
    </div>
  );
}
