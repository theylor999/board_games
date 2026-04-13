"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joiningGame, setJoiningGame] = useState<string | null>(null);
  const [mode, setMode] = useState<"home" | "create">("home");

  function createRoom(game: string) {
    if (!name.trim()) return;
    const id = uuidv4().slice(0, 8).toUpperCase();
    router.push(`/${game}/${id}?name=${encodeURIComponent(name)}&role=host`);
  }

  function joinRoom(game: string) {
    if (!name.trim() || !roomId.trim()) return;
    router.push(`/${game}/${roomId.toUpperCase().trim()}?name=${encodeURIComponent(name)}&role=guest`);
  }

  if (mode === "home") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0f172a' }}>
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold mb-3" style={{ color: '#f1f5f9' }}>🎲 Board Games</h1>
          <p className="mb-10 text-lg" style={{ color: '#94a3b8' }}>Jogue com seus amigos em tempo real</p>

          <div className="mb-8">
            <input
              type="text"
              placeholder="Seu nome..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full max-w-xs px-4 py-3 rounded-xl text-center text-lg font-semibold outline-none border-2"
              style={{ background: '#1e293b', color: '#f1f5f9', borderColor: '#334155' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <GameCard
              emoji="⬛"
              title="Dominó"
              description="Clássico jogo de dominó. 28 peças, até você vencer!"
              onSelect={() => { if (name.trim()) { setJoiningGame("domino"); setMode("create"); } }}
              disabled={!name.trim()}
            />
            <GameCard
              emoji="❌"
              title="Jogo da Velha"
              description="O clássico! X ou O, quem completar 3 vence."
              onSelect={() => { if (name.trim()) { setJoiningGame("velha"); setMode("create"); } }}
              disabled={!name.trim()}
            />
          </div>

          {!name.trim() && (
            <p style={{ color: '#f59e0b' }} className="text-sm">Digite seu nome para continuar</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0f172a' }}>
      <div className="max-w-md w-full text-center">
        <h2 className="text-3xl font-bold mb-8" style={{ color: '#f1f5f9' }}>
          {joiningGame === "domino" ? "⬛ Dominó" : "❌ Jogo da Velha"}
        </h2>

        <div className="space-y-4">
          <button
            onClick={() => createRoom(joiningGame!)}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all"
            style={{ background: '#4f46e5', color: 'white' }}
          >
            🏠 Criar Sala
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#334155' }} />
            <span style={{ color: '#64748b' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: '#334155' }} />
          </div>

          <input
            type="text"
            placeholder="Código da sala..."
            value={roomId}
            onChange={e => setRoomId(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono uppercase outline-none border-2"
            style={{ background: '#1e293b', color: '#f1f5f9', borderColor: '#334155' }}
            maxLength={8}
          />
          <button
            onClick={() => joinRoom(joiningGame!)}
            disabled={!roomId.trim()}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
            style={{ background: '#0f766e', color: 'white' }}
          >
            🔗 Entrar na Sala
          </button>
        </div>

        <button
          onClick={() => setMode("home")}
          className="mt-8 text-sm underline"
          style={{ color: '#64748b' }}
        >
          ← Voltar
        </button>
      </div>
    </main>
  );
}

function GameCard({ emoji, title, description, onSelect, disabled }: {
  emoji: string;
  title: string;
  description: string;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="rounded-2xl p-8 text-left transition-all duration-200 border-2 w-full disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
      style={{
        background: '#1e293b',
        borderColor: '#334155',
        color: '#f1f5f9',
      }}
    >
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm" style={{ color: '#94a3b8' }}>{description}</p>
    </button>
  );
}
