"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Cell = null | "X" | "O";
type Board = Cell[];

const WINNING = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board: Board) {
  for (const [a,b,c] of WINNING) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a]!, line: [a,b,c] };
  }
  return null;
}

// ─── Name Entry ──────────────────────────────────────────────────────────────
function NameEntry({ roomId, onConfirm }: { roomId: string; onConfirm: (n: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <main style={{ background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>❌</div>
        <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Jogo da Velha</h1>
        <p style={{ color: '#64748b', marginBottom: 4, fontSize: 14 }}>Sala:</p>
        <p style={{ color: '#6366f1', fontFamily: 'monospace', fontWeight: 700, fontSize: 18, marginBottom: 24 }}>{roomId}</p>
        <input
          autoFocus
          placeholder="Digite seu nome..."
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && val.trim() && onConfirm(val.trim())}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: 16, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />
        <Btn
          label="Entrar na Sala →"
          disabled={!val.trim()}
          color="#4f46e5"
          onClick={() => val.trim() && onConfirm(val.trim())}
          fullWidth
        />
      </div>
    </main>
  );
}

// ─── Button with visual feedback ─────────────────────────────────────────────
function Btn({ label, onClick, disabled, color, fullWidth, small }: {
  label: string; onClick: () => void; disabled?: boolean;
  color: string; fullWidth?: boolean; small?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={() => { if (disabled) return; setPressed(true); setTimeout(() => setPressed(false), 150); onClick(); }}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: small ? '6px 14px' : '12px 24px',
        borderRadius: 12,
        border: 'none',
        background: disabled ? '#334155' : pressed ? lighten(color) : color,
        color: disabled ? '#64748b' : 'white',
        fontWeight: 700,
        fontSize: small ? 13 : 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s, background 0.1s',
        boxShadow: pressed ? 'none' : `0 2px 8px ${color}55`,
      }}
    >
      {label}
    </button>
  );
}

function lighten(hex: string) {
  // simple lighten by mixing with white
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8) & 0xff) + 40);
  const b = Math.min(255, (n & 0xff) + 40);
  return `rgb(${r},${g},${b})`;
}

// ─── Copy button with "Copiado!" feedback ────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ marginTop: 10, padding: '6px 16px', borderRadius: 8, border: 'none', background: copied ? '#15803d' : '#4f46e5', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s' }}
    >
      {copied ? "✅ Copiado!" : "📋 Copiar Link"}
    </button>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function VelhaGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = (searchParams.get("role") || "host") as "host" | "guest";

  const [myName, setMyName] = useState(searchParams.get("name") || "");
  const [nameConfirmed, setNameConfirmed] = useState(!!searchParams.get("name"));

  const mySymbol: Cell = role === "host" ? "X" : "O";
  const oppSymbol: Cell = role === "host" ? "O" : "X";

  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<"X" | "O">("X");
  const [opponentName, setOpponentName] = useState("");
  const [connected, setConnected] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState({ me: 0, opp: 0 });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myNameRef = useRef(myName);
  myNameRef.current = myName;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/velha/${roomId}?role=guest`
    : `https://yourapp.vercel.app/velha/${roomId}?role=guest`;

  // Send a message through the channel
  function send(event: string, payload: Record<string, unknown>) {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }

  useEffect(() => {
    if (!nameConfirmed) return;

    // Use a unique key per user so both can join the same channel
    const channel = supabase.channel(`velha-${roomId}`, {
      config: { broadcast: { self: true, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        // Ignore our own hellos
        if (payload.role === role && payload.name === myNameRef.current) return;
        // Ignore same-role stranger
        if (payload.role === role) return;

        if (!connectedRef.current) {
          connectedRef.current = true;
          setConnected(true);
          setOpponentName(payload.name);
          // Stop the heartbeat
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          // Reply once so the other side also knows us
          send("hello", { role, name: myNameRef.current });
          // Host resets board
          if (role === "host") {
            setBoard(Array(9).fill(null));
            setCurrentTurn("X");
            setResult(null);
            setWinLine(null);
          }
        } else {
          // Already connected but opponent re-announced (e.g. they refreshed)
          setOpponentName(payload.name);
        }
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (payload.role === role) return; // own move echo (self:true)
        const nb = payload.board as Board;
        setBoard(nb);
        setCurrentTurn(payload.next);
        const w = checkWinner(nb);
        if (w) {
          setWinLine(w.line);
          setResult(`${payload.name} venceu! 🏆`);
          setScores(s => ({ ...s, opp: s.opp + 1 }));
        } else if (nb.every(Boolean)) {
          setResult("Empate! 🤝");
        }
      })
      .on("broadcast", { event: "reset" }, ({ payload }) => {
        if (payload.role === role) return;
        setBoard(Array(9).fill(null));
        setCurrentTurn("X");
        setResult(null);
        setWinLine(null);
        setScores({ me: payload.scores.opp, opp: payload.scores.me });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Start hello heartbeat — send every 1.5s until connected
          const fire = () => send("hello", { role, name: myNameRef.current });
          fire();
          timerRef.current = setInterval(() => {
            if (!connectedRef.current) fire();
            else { clearInterval(timerRef.current!); timerRef.current = null; }
          }, 1500);
        }
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      connectedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [nameConfirmed, roomId, role]);

  function handleClick(i: number) {
    if (!connected || result || board[i] || currentTurn !== mySymbol) return;
    const nb = [...board] as Board;
    nb[i] = mySymbol;
    const next = mySymbol === "X" ? "O" : "X";
    setBoard(nb);
    setCurrentTurn(next);
    const w = checkWinner(nb);
    if (w) {
      setWinLine(w.line);
      setResult("Você venceu! 🎉");
      setScores(s => ({ ...s, me: s.me + 1 }));
    } else if (nb.every(Boolean)) {
      setResult("Empate! 🤝");
    }
    send("move", { board: nb, next, name: myName, role });
  }

  function resetGame() {
    const nb = Array(9).fill(null);
    setBoard(nb);
    setCurrentTurn("X");
    setResult(null);
    setWinLine(null);
    send("reset", { role, scores });
  }

  if (!nameConfirmed) {
    return <NameEntry roomId={roomId} onConfirm={n => { setMyName(n); setNameConfirmed(true); }} />;
  }

  const isMyTurn = connected && !result && currentTurn === mySymbol;
  const S = { background: '#0f172a', color: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: 16 };

  return (
    <main style={S}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>❌ Jogo da Velha</h1>
          <span style={{ background: '#1e293b', color: '#64748b', borderRadius: 8, padding: '2px 10px', fontSize: 13, fontFamily: 'monospace' }}>
            Sala: {roomId}
          </span>
        </div>

        {/* Scoreboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', borderRadius: 16, padding: '12px 16px', marginBottom: 16, alignItems: 'center' }}>
          <ScoreCol symbol={mySymbol} name={`${myName} (você)`} score={scores.me} />
          <span style={{ color: '#475569', fontWeight: 700, fontSize: 18 }}>vs</span>
          <ScoreCol symbol={oppSymbol} name={opponentName || "..."} score={scores.opp} right />
        </div>

        {/* Waiting banner */}
        {!connected && (
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ color: '#94a3b8', marginBottom: 12 }}>
              <Spinner /> Aguardando oponente...
            </div>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 8 }}>Mande o link para seu amigo:</div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: 8, fontSize: 12, fontFamily: 'monospace', color: '#6366f1', wordBreak: 'break-all', marginBottom: 4 }}>
              {shareUrl}
            </div>
            <CopyBtn text={shareUrl} />
          </div>
        )}

        {/* Turn indicator */}
        {connected && !result && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 10,
              background: isMyTurn ? '#14532d' : '#1e293b',
              color: isMyTurn ? '#4ade80' : '#94a3b8',
              fontWeight: 600,
              fontSize: 15,
              transition: 'background 0.3s',
            }}>
              {isMyTurn ? "✅ Sua vez!" : `⌛ Vez de ${opponentName}`}
            </span>
          </div>
        )}

        {/* Board */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {board.map((cell, i) => {
            const isWin = winLine?.includes(i);
            const canClick = !cell && isMyTurn;
            return (
              <BoardCell
                key={i}
                cell={cell}
                isWin={!!isWin}
                canClick={canClick}
                onClick={() => handleClick(i)}
              />
            );
          })}
        </div>

        {/* Result */}
        {result && (
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>{result}</div>
            <Btn label="Jogar Novamente" color="#4f46e5" onClick={resetGame} fullWidth />
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => router.push("/")} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            ← Menu
          </button>
        </div>
      </div>
    </main>
  );
}

function BoardCell({ cell, isWin, canClick, onClick }: { cell: Cell; isWin: boolean; canClick: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [flash, setFlash] = useState(false);

  function handleClick() {
    if (!canClick) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    onClick();
  }

  let bg = '#1e293b';
  if (isWin) bg = '#1d4ed8';
  else if (flash) bg = '#312e81';
  else if (hover && canClick) bg = '#273449';

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        aspectRatio: '1',
        borderRadius: 14,
        border: `2px solid ${isWin ? '#3b82f6' : hover && canClick ? '#6366f1' : '#334155'}`,
        background: bg,
        color: cell === "X" ? '#ef4444' : '#3b82f6',
        fontSize: 48,
        fontWeight: 700,
        cursor: canClick ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
        transform: flash ? 'scale(0.92)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {cell}
    </button>
  );
}

function ScoreCol({ symbol, name, score, right }: { symbol: Cell; name: string; score: number; right?: boolean }) {
  const color = symbol === "X" ? '#ef4444' : '#3b82f6';
  return (
    <div style={{ textAlign: right ? 'right' : 'left' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{symbol}</div>
      <div style={{ fontSize: 12, color: '#64748b', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{score}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', marginRight: 8 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .sp{display:inline-block;width:14px;height:14px;border:2px solid #334155;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle}`}</style>
      <span className="sp" />
    </span>
  );
}
