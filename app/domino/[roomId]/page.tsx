"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Piece, BoardPiece, createDeck, dealHands, getPlayableIndices, playPiece } from "@/lib/domino";

// ─── Button with press feedback ──────────────────────────────────────────────
function Btn({ label, onClick, disabled, color, fullWidth, small }: {
  label: string; onClick: () => void; disabled?: boolean;
  color: string; fullWidth?: boolean; small?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setPressed(true);
        setTimeout(() => setPressed(false), 150);
        onClick();
      }}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: small ? '6px 14px' : '10px 20px',
        borderRadius: 10,
        border: 'none',
        background: disabled ? '#1e293b' : pressed ? lighten(color) : color,
        color: disabled ? '#475569' : 'white',
        fontWeight: 700,
        fontSize: small ? 13 : 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s, background 0.1s',
        boxShadow: disabled || pressed ? 'none' : `0 2px 8px ${color}55`,
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8) & 0xff) + 40);
  const b = Math.min(255, (n & 0xff) + 40);
  return `rgb(${r},${g},${b})`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: copied ? '#15803d' : '#4f46e5', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s' }}
    >
      {copied ? "✅ Copiado!" : "📋 Copiar Link"}
    </button>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .sp{display:inline-block;width:14px;height:14px;border:2px solid #334155;border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}`}</style>
      <span className="sp" />
    </>
  );
}

// ─── Name Entry ──────────────────────────────────────────────────────────────
function NameEntry({ roomId, onConfirm }: { roomId: string; onConfirm: (n: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <main style={{ background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⬛</div>
        <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Dominó</h1>
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
        <Btn label="Entrar na Sala →" disabled={!val.trim()} color="#4f46e5" onClick={() => val.trim() && onConfirm(val.trim())} fullWidth />
      </div>
    </main>
  );
}

// ─── Domino piece rendering ───────────────────────────────────────────────────
const DOTS: Record<number, [number, number][]> = {
  0: [],
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
};

function DiceFace({ v, size, dotSize }: { v: number; size: number; dotSize: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {(DOTS[v] || []).map(([cx, cy], i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          width: dotSize, height: dotSize, background: '#1e293b',
          left: `calc(${cx}% - ${dotSize/2}px)`,
          top: `calc(${cy}% - ${dotSize/2}px)`,
        }} />
      ))}
    </div>
  );
}

function DomPiece({ a, b, small, selected, dim }: { a: number; b: number; small?: boolean; selected?: boolean; dim?: boolean }) {
  const faceSize = small ? 28 : 38;
  const dotSize = small ? 5 : 7;
  const pad = small ? 2 : 4;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: selected ? '#312e81' : '#f8fafc',
      border: `2px solid ${selected ? '#818cf8' : '#94a3b8'}`,
      borderRadius: 6, padding: pad,
      opacity: dim ? 0.35 : 1,
      transition: 'opacity 0.15s, border-color 0.15s, transform 0.15s',
    }}>
      <DiceFace v={a} size={faceSize} dotSize={dotSize} />
      <div style={{ height: 1, background: '#94a3b8', width: '100%', margin: '2px 0' }} />
      <DiceFace v={b} size={faceSize} dotSize={dotSize} />
    </div>
  );
}

// ─── Game State ───────────────────────────────────────────────────────────────
type GS = {
  myHand: Piece[];
  oppCount: number;
  board: BoardPiece[];
  leftEnd: number;
  rightEnd: number;
  pile: Piece[];
  turn: "host" | "guest";
  scores: { host: number; guest: number };
  passCount: number;
};

const INIT_GS: GS = {
  myHand: [], oppCount: 0, board: [],
  leftEnd: -1, rightEnd: -1, pile: [],
  turn: "host", scores: { host: 0, guest: 0 }, passCount: 0,
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DominoGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = (searchParams.get("role") || "host") as "host" | "guest";

  const [myName, setMyName] = useState(searchParams.get("name") || "");
  const [nameConfirmed, setNameConfirmed] = useState(!!searchParams.get("name"));

  const [connected, setConnected] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [gs, setGs] = useState<GS>(INIT_GS);
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myNameRef = useRef(myName);
  myNameRef.current = myName;
  const gsRef = useRef(gs);
  gsRef.current = gs;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/domino/${roomId}?role=guest`
    : "";

  function send(event: string, payload: Record<string, unknown>) {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }

  const startGame = useCallback((existingScores?: { host: number; guest: number }) => {
    const deck = createDeck();
    const { hand1, hand2, pile } = dealHands(deck);
    const scores = existingScores || { host: 0, guest: 0 };
    const state: GS = {
      myHand: hand1, oppCount: hand2.length,
      board: [], leftEnd: -1, rightEnd: -1,
      pile, turn: "host", scores, passCount: 0,
    };
    setGs(state);
    setResult(null);
    setSelected(null);
    setMsg("");
    channelRef.current?.send({
      type: "broadcast", event: "game_start",
      payload: { guestHand: hand2, hostCount: hand1.length, pile, scores },
    });
  }, []);

  useEffect(() => {
    if (!nameConfirmed) return;

    const channel = supabase.channel(`domino-${roomId}`, {
      config: { broadcast: { self: true, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (payload.role === role && payload.name === myNameRef.current) return;
        if (payload.role === role) return;

        setOpponentName(payload.name);

        if (!connectedRef.current) {
          connectedRef.current = true;
          setConnected(true);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          send("hello", { role, name: myNameRef.current });
          if (role === "host") startGame();
        } else {
          send("hello", { role, name: myNameRef.current });
        }
      })
      .on("broadcast", { event: "game_start" }, ({ payload }) => {
        if (role !== "guest") return;
        setGs(prev => ({
          ...prev,
          myHand: payload.guestHand,
          oppCount: payload.hostCount,
          board: [], leftEnd: -1, rightEnd: -1,
          pile: payload.pile,
          turn: "host",
          scores: payload.scores,
          passCount: 0,
        }));
        setResult(null); setSelected(null); setMsg("");
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (payload.role === role) return;
        setGs(prev => ({
          ...prev,
          board: payload.board, leftEnd: payload.leftEnd, rightEnd: payload.rightEnd,
          oppCount: payload.oppCount, turn: payload.turn, passCount: 0,
        }));
        setMsg("Oponente jogou");
        if (payload.finished) {
          setResult(payload.result);
          setGs(prev => ({ ...prev, scores: payload.scores }));
        }
      })
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        if (payload.role === role) return;
        setGs(prev => ({ ...prev, pile: payload.pile, oppCount: payload.oppCount, turn: payload.turn }));
        setMsg("Oponente comprou");
      })
      .on("broadcast", { event: "pass" }, ({ payload }) => {
        if (payload.role === role) return;
        setGs(prev => ({ ...prev, turn: payload.turn, passCount: payload.passCount }));
        setMsg("Oponente passou");
        if (payload.finished) { setResult(payload.result); }
      })
      .on("broadcast", { event: "request_reset" }, ({ payload }) => {
        if (payload.role === role) return;
        if (role === "host") startGame(gsRef.current.scores);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
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
  }, [nameConfirmed, roomId, role, startGame]);

  const isMyTurn = connected && !result && gs.turn === role;
  const playable = isMyTurn ? getPlayableIndices(gs.myHand, gs.leftEnd, gs.rightEnd) : [];
  const canDraw = isMyTurn && playable.length === 0 && gs.pile.length > 0;
  const canPass = isMyTurn && playable.length === 0 && gs.pile.length === 0;

  function doPlay(idx: number, side: "left" | "right") {
    const piece = gs.myHand[idx];
    const { board, leftEnd, rightEnd } = playPiece(gs.board, piece, side, gs.leftEnd, gs.rightEnd);
    const newHand = gs.myHand.filter((_, i) => i !== idx);
    const nextTurn = role === "host" ? "guest" : "host";
    const newScores = { ...gs.scores };
    const finished = newHand.length === 0;
    if (finished) newScores[role] += 1;

    setGs(prev => ({ ...prev, myHand: newHand, board, leftEnd, rightEnd, turn: nextTurn, scores: newScores, passCount: 0 }));
    setSelected(null); setMsg("");
    send("move", { board, leftEnd, rightEnd, oppCount: newHand.length, turn: nextTurn, finished, result: finished ? `${myName} venceu!` : "", scores: newScores, role });
    if (finished) setResult("Você venceu! 🎉");
  }

  function handlePieceClick(i: number) {
    if (!isMyTurn || !playable.includes(i)) return;
    if (selected === i) { setSelected(null); return; }
    if (gs.board.length === 0) { setSelected(i); return; }
    const [a, b] = gs.myHand[i];
    const canL = a === gs.leftEnd || b === gs.leftEnd;
    const canR = a === gs.rightEnd || b === gs.rightEnd;
    if (canL && !canR) doPlay(i, "left");
    else if (!canL && canR) doPlay(i, "right");
    else setSelected(i);
  }

  function handleDraw() {
    if (!canDraw) return;
    const drawn = gs.pile[0];
    const newPile = gs.pile.slice(1);
    const newHand = [...gs.myHand, drawn];
    const newPlayable = getPlayableIndices(newHand, gs.leftEnd, gs.rightEnd);
    const nextTurn = role === "host" ? "guest" : "host";
    const turn = newPlayable.length > 0 ? role : nextTurn;
    setGs(prev => ({ ...prev, myHand: newHand, pile: newPile, turn }));
    setMsg(newPlayable.length > 0 ? "Você comprou — jogue agora" : "Você comprou e passou");
    send("draw", { pile: newPile, oppCount: newHand.length, turn, role });
  }

  function handlePass() {
    if (!canPass) return;
    const nextTurn = role === "host" ? "guest" : "host";
    const newPassCount = gs.passCount + 1;
    const finished = newPassCount >= 2;
    setGs(prev => ({ ...prev, turn: nextTurn, passCount: newPassCount }));
    send("pass", { turn: nextTurn, passCount: newPassCount, finished, result: finished ? "Jogo bloqueado!" : "", role });
    if (finished) setResult("Jogo bloqueado! Ninguém pode jogar.");
    else setMsg("Você passou");
  }

  function handleReset() {
    if (role === "host") startGame(gs.scores);
    else { send("request_reset", { role }); setMsg("Pedindo revanche..."); }
  }

  if (!nameConfirmed) {
    return <NameEntry roomId={roomId} onConfirm={n => { setMyName(n); setNameConfirmed(true); }} />;
  }

  return (
    <main style={{ background: '#0f172a', color: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '12px 12px', display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>⬛ Dominó</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>#{roomId}</span>
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            <span style={{ color: '#6366f1', fontWeight: 700 }}>{gs.scores[role]}</span>
            <span style={{ margin: '0 6px', color: '#334155' }}>–</span>
            <span style={{ color: '#6366f1', fontWeight: 700 }}>{gs.scores[role === "host" ? "guest" : "host"]}</span>
            <span style={{ marginLeft: 6, color: '#64748b' }}>{opponentName || "..."}</span>
          </div>
        </div>

        {/* Waiting */}
        {!connected && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 340 }}>
              <div style={{ color: '#94a3b8', marginBottom: 14 }}><Spinner />
                {role === "host" ? "Aguardando oponente..." : "Conectando..."}
              </div>
              {role === "host" && <>
                <div style={{ background: '#0f172a', borderRadius: 8, padding: 8, fontSize: 12, fontFamily: 'monospace', color: '#6366f1', wordBreak: 'break-all', marginBottom: 10 }}>
                  {shareUrl}
                </div>
                <CopyBtn text={shareUrl} />
              </>}
            </div>
          </div>
        )}

        {connected && (
          <>
            {/* Opponent hand count */}
            <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
              <span style={{ color: '#94a3b8' }}>
                {opponentName}: <strong style={{ color: '#f1f5f9' }}>{gs.oppCount}</strong> peças
                {gs.pile.length > 0 && <span style={{ color: '#475569', marginLeft: 10 }}>Estoque: {gs.pile.length}</span>}
              </span>
              {!isMyTurn && !result && (
                <span style={{ background: '#7c3aed', color: 'white', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>vez dele</span>
              )}
            </div>

            {/* Board */}
            <div style={{ flex: 1, background: '#1e293b', borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 8, minHeight: 130 }}>
              <div style={{ height: '100%', overflowX: 'auto', display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
                {gs.board.length === 0 ? (
                  <div style={{ width: '100%', textAlign: 'center', color: '#475569', fontSize: 14 }}>
                    {isMyTurn ? "Clique em uma peça para começar" : "Aguardando jogada..."}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 'max-content' }}>
                    {/* Left play button */}
                    {selected !== null && isMyTurn && (
                      <Btn label="← Esq" color="#15803d" small onClick={() => doPlay(selected, "left")} />
                    )}
                    {gs.board.map((bp, i) => {
                      const [a, b] = bp.flipped ? [bp.piece[1], bp.piece[0]] : bp.piece;
                      return <DomPiece key={i} a={a} b={b} small />;
                    })}
                    {/* Right play button */}
                    {selected !== null && isMyTurn && (
                      <Btn label="Dir →" color="#15803d" small onClick={() => doPlay(selected, "right")} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status bar */}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              {msg && <div style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>{msg}</div>}
              <span style={{
                display: 'inline-block', padding: '6px 18px', borderRadius: 8,
                background: isMyTurn ? '#14532d' : '#1e293b',
                color: isMyTurn ? '#4ade80' : '#64748b',
                fontWeight: 600, fontSize: 14,
                transition: 'background 0.3s',
              }}>
                {isMyTurn ? "✅ Sua vez!" : `⌛ Vez de ${opponentName}`}
              </span>
            </div>

            {/* Action buttons */}
            {isMyTurn && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
                {canDraw && <Btn label={`🃏 Comprar (${gs.pile.length})`} color="#0e7490" onClick={handleDraw} />}
                {canPass && <Btn label="⏭ Passar" color="#92400e" onClick={handlePass} />}
                {selected !== null && gs.board.length === 0 && <Btn label="▶ Jogar" color="#15803d" onClick={() => doPlay(selected, "right")} />}
              </div>
            )}

            {/* My hand */}
            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', padding: '4px 2px' }}>
                {gs.myHand.map((piece, i) => {
                  const isPlayable = playable.includes(i);
                  const isSel = selected === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handlePieceClick(i)}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        cursor: isMyTurn && isPlayable ? 'pointer' : 'default',
                        transform: isSel ? 'translateY(-10px)' : 'translateY(0)',
                        transition: 'transform 0.15s',
                        outline: 'none',
                      }}
                    >
                      <DomPiece a={piece[0]} b={piece[1]} selected={isSel} dim={isMyTurn && !isPlayable} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Result overlay */}
        {result && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#1e293b', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 300, width: '90%' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>{result}</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn label={role === "host" ? "Nova Partida" : "Pedir Revanche"} color="#4f46e5" onClick={handleReset} />
                <Btn label="Menu" color="#334155" onClick={() => router.push("/")} />
              </div>
            </div>
          </div>
        )}

        <button onClick={() => router.push("/")} style={{ marginTop: 8, background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}>
          ← Sair
        </button>
      </div>
    </main>
  );
}
