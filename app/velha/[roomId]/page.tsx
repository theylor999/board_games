"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

type Board = (null | "X" | "O")[];

const WINNING = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board: Board): { winner: string; line: number[] } | null {
  for (const line of WINNING) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a]!, line };
    }
  }
  return null;
}

export default function VelhaGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get("name") || "Jogador";
  const role = searchParams.get("role") as "host" | "guest";

  const mySymbol = role === "host" ? "X" : "O";
  const opponentSymbol = role === "host" ? "O" : "X";

  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<"X" | "O">("X"); // X always starts
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "playing" | "finished">("waiting");
  const [result, setResult] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ me: 0, opp: 0 });
  const channelRef = useRef<RealtimeChannel | null>(null);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/velha/${roomId}?name=SeuNome&role=guest`
    : "";

  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`velha:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "join" }, ({ payload }) => {
        setOpponentName(payload.name);
        setStatus("playing");
        // host sends current board state to new joiner
        if (role === "host") {
          channel.send({
            type: "broadcast",
            event: "sync",
            payload: { board: Array(9).fill(null), currentTurn: "X" },
          });
        }
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        setBoard(payload.board);
        setCurrentTurn(payload.currentTurn);
        setStatus("playing");
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const newBoard = [...payload.board] as Board;
        setBoard(newBoard);
        setCurrentTurn(payload.currentTurn);
        const w = checkWinner(newBoard);
        if (w) {
          setWinLine(w.line);
          setResult(w.winner === mySymbol ? "Você venceu! 🎉" : `${payload.opponentName} venceu!`);
          setStatus("finished");
          setScores(s => ({
            me: w.winner === mySymbol ? s.me + 1 : s.me,
            opp: w.winner !== mySymbol ? s.opp + 1 : s.opp,
          }));
        } else if (newBoard.every(Boolean)) {
          setResult("Empate! 🤝");
          setStatus("finished");
        }
      })
      .on("broadcast", { event: "reset" }, ({ payload }) => {
        setBoard(Array(9).fill(null));
        setCurrentTurn("X");
        setStatus("playing");
        setResult(null);
        setWinLine(null);
        if (payload.scores) setScores(payload.scores);
      })
      .on("broadcast", { event: "opponent_name" }, ({ payload }) => {
        setOpponentName(payload.name);
        setStatus("playing");
      })
      .subscribe(() => {
        if (role === "guest") {
          channel.send({ type: "broadcast", event: "join", payload: { name } });
        } else {
          channel.send({ type: "broadcast", event: "opponent_name", payload: { name } });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, role, name, mySymbol]);

  function handleClick(i: number) {
    if (status !== "playing" || board[i] || currentTurn !== mySymbol) return;
    const newBoard = [...board] as Board;
    newBoard[i] = mySymbol;
    const nextTurn = mySymbol === "X" ? "O" : "X";
    setBoard(newBoard);
    setCurrentTurn(nextTurn);

    const w = checkWinner(newBoard);
    if (w) {
      setWinLine(w.line);
      setResult("Você venceu! 🎉");
      setStatus("finished");
      setScores(s => ({ ...s, me: s.me + 1 }));
    } else if (newBoard.every(Boolean)) {
      setResult("Empate! 🤝");
      setStatus("finished");
    }

    broadcast("move", { board: newBoard, currentTurn: nextTurn, opponentName: name });
  }

  function resetGame() {
    const newBoard = Array(9).fill(null);
    const newScores = result?.includes("venceu") && result.includes("Você")
      ? scores
      : scores;
    setBoard(newBoard);
    setCurrentTurn("X");
    setStatus("playing");
    setResult(null);
    setWinLine(null);
    broadcast("reset", { scores });
  }

  const isMyTurn = currentTurn === mySymbol && status === "playing";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#f1f5f9' }}>❌ Jogo da Velha</h1>
          <div className="text-sm font-mono px-3 py-1 rounded-lg inline-block" style={{ background: '#1e293b', color: '#94a3b8' }}>
            Sala: {roomId}
          </div>
        </div>

        {/* Scores */}
        <div className="flex justify-between mb-4 rounded-xl p-3" style={{ background: '#1e293b' }}>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: mySymbol === "X" ? '#ef4444' : '#3b82f6' }}>{mySymbol}</div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>{name} (você)</div>
            <div className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{scores.me}</div>
          </div>
          <div className="text-2xl font-bold self-center" style={{ color: '#475569' }}>vs</div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: opponentSymbol === "X" ? '#ef4444' : '#3b82f6' }}>{opponentSymbol}</div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>{opponentName || "..."}</div>
            <div className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{scores.opp}</div>
          </div>
        </div>

        {/* Status */}
        {status === "waiting" && (
          <div className="text-center mb-4 p-4 rounded-xl" style={{ background: '#1e293b' }}>
            <p className="mb-3" style={{ color: '#94a3b8' }}>Aguardando jogador...</p>
            <p className="text-xs mb-2" style={{ color: '#64748b' }}>Mande o link para seu amigo:</p>
            <div className="text-xs font-mono p-2 rounded-lg break-all" style={{ background: '#0f172a', color: '#6366f1' }}>
              {shareUrl}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="mt-3 text-xs px-3 py-1 rounded-lg"
              style={{ background: '#4f46e5', color: 'white' }}
            >
              📋 Copiar Link
            </button>
          </div>
        )}

        {status === "playing" && (
          <div className="text-center mb-4">
            <span className="px-4 py-2 rounded-lg font-semibold" style={{
              background: isMyTurn ? '#14532d' : '#1e293b',
              color: isMyTurn ? '#4ade80' : '#94a3b8'
            }}>
              {isMyTurn ? "Sua vez!" : `Vez de ${opponentName || "..."}`}
            </span>
          </div>
        )}

        {/* Board */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {board.map((cell, i) => {
            const isWin = winLine?.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                className="aspect-square rounded-xl text-5xl font-bold flex items-center justify-center transition-all"
                style={{
                  background: isWin ? '#1d4ed8' : '#1e293b',
                  color: cell === "X" ? '#ef4444' : '#3b82f6',
                  cursor: (!cell && isMyTurn && status === "playing") ? 'pointer' : 'default',
                  border: '2px solid',
                  borderColor: isWin ? '#3b82f6' : '#334155',
                }}
              >
                {cell}
              </button>
            );
          })}
        </div>

        {/* Result */}
        {status === "finished" && result && (
          <div className="text-center mb-4 p-4 rounded-xl" style={{ background: '#1e293b' }}>
            <p className="text-2xl font-bold mb-3" style={{ color: '#f1f5f9' }}>{result}</p>
            <button
              onClick={resetGame}
              className="px-6 py-3 rounded-xl font-bold"
              style={{ background: '#4f46e5', color: 'white' }}
            >
              Jogar Novamente
            </button>
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="w-full text-center text-sm underline"
          style={{ color: '#64748b' }}
        >
          ← Voltar ao Menu
        </button>
      </div>
    </main>
  );
}
