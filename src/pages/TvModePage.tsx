import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Mic, Flame, QrCode, ArrowLeft } from 'lucide-react';
import { REACTION_EMOJIS } from '../types/karaoke';

interface FloatingReaction {
  id: number;
  emoji: string;
  xOffset: number;
}

export const TvModePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  const roomCode = (code || 'FESTA1').toUpperCase();
  const joinUrl = `${window.location.origin}/room/${roomCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    joinUrl
  )}&color=ffffff&bgcolor=090a10`;

  // Simulação de reações periódicas no telão da TV para conferir animações
  useEffect(() => {
    const interval = setInterval(() => {
      const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      const id = Date.now() + Math.random();
      const xOffset = Math.floor(Math.random() * 80); // 0 a 80px no painel lateral
      setReactions((prev) => [...prev.slice(-15), { id, emoji: randomEmoji, xOffset }]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-dark-base text-text-primary flex flex-col justify-between overflow-hidden select-none p-6">
      {/* Background Neon Spotlights */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-brand-purple/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-brand-pink/20 rounded-full blur-[140px] pointer-events-none" />

      {/* TOP BAR / CABEÇALHO DA TV */}
      <header className="relative z-20 flex items-center justify-between border-b border-dark-border/60 pb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-dark-surface transition-colors"
            title="Sair do Modo TV"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎤</span>
            <div>
              <h1 className="font-display font-black text-2xl tracking-tight bg-gradient-to-r from-brand-purple-light via-brand-pink to-brand-cyan-light bg-clip-text text-transparent">
                Karaokê da Festa
              </h1>
              <p className="text-xs text-text-secondary tracking-widest uppercase font-semibold">
                Modo Telão • Ao Vivo
              </p>
            </div>
          </div>
        </div>

        {/* Central Room Code Banner */}
        <div className="flex items-center gap-3 px-6 py-2 rounded-2xl bg-dark-surface/90 border-2 border-brand-purple/60 shadow-neon-purple">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">CÓDIGO:</span>
          <span className="font-display font-black text-3xl tracking-[0.25em] text-white">
            {roomCode}
          </span>
        </div>

        {/* QR Code de Entrada Direta */}
        <div className="flex items-center gap-3 bg-dark-surface/80 border border-dark-border px-3 py-2 rounded-2xl">
          <img
            src={qrCodeUrl}
            alt={`QR Code para entrar na sala ${roomCode}`}
            className="w-12 h-12 rounded-lg border border-brand-purple/30 bg-dark-base p-0.5"
          />
          <div className="text-left">
            <p className="text-xs font-bold text-white flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-brand-cyan-light" /> Aponte a Câmera
            </p>
            <p className="text-[11px] text-text-muted">para entrar na cantoria</p>
          </div>
        </div>
      </header>

      {/* MAIN VIEW: PLAYER 16:9 + OVERLAY DE REAÇÕES */}
      <main className="relative z-10 flex-1 my-4 flex items-center justify-center">
        {isVoting ? (
          /* TELA FESTIVA DE VOTAÇÃO DA TV */
          <div className="w-full max-w-4xl rounded-3xl border-2 border-brand-gold bg-gradient-to-b from-dark-surface to-dark-elevated p-10 text-center shadow-neon-gold space-y-6">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-brand-gold/20 text-brand-gold text-sm font-bold uppercase tracking-widest animate-pulse">
              <Sparkles className="w-5 h-5" /> Hora da Nota! Avaliem no Celular!
            </div>

            <h2 className="font-display font-black text-5xl text-white">
              O que acharam do show?
            </h2>

            <div className="flex justify-center items-center gap-6 py-4">
              <div className="text-center">
                <div className="w-28 h-28 rounded-full border-4 border-brand-purple mx-auto overflow-hidden shadow-neon-purple">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                    alt="Cantor"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-xl text-white mt-3">Zé da Silva & Camila</h3>
                <p className="text-sm text-brand-pink-light">Evidências</p>
              </div>
            </div>

            <div className="flex justify-center gap-3 text-5xl">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-brand-gold animate-bounce">
                  ⭐
                </span>
              ))}
            </div>

            <p className="text-sm font-bold text-brand-cyan-light">
              🔥 16 votos registrados no celular...
            </p>

            <button
              onClick={() => setIsVoting(false)}
              className="px-6 py-2 rounded-xl border border-dark-border text-xs text-text-muted hover:text-white"
            >
              (Demo: Retornar ao Player)
            </button>
          </div>
        ) : (
          /* PLAYER CENTRAL 16:9 */
          <div className="relative w-full max-w-5xl aspect-video rounded-3xl border-2 border-brand-purple/40 bg-black/90 overflow-hidden shadow-neon-purple flex items-center justify-center">
            {/* Simulação do Player do YouTube */}
            <iframe
              className="w-full h-full pointer-events-none"
              src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=0&rel=0"
              title="YouTube Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />

            {/* Overlay com Emojis Flutuantes na lateral direita */}
            <div className="absolute right-6 bottom-4 top-4 w-32 pointer-events-none overflow-hidden">
              {reactions.map((r) => (
                <div
                  key={r.id}
                  className="reaction-particle text-4xl select-none"
                  style={{ left: `${r.xOffset}px`, bottom: '20px' }}
                >
                  {r.emoji}
                </div>
              ))}
            </div>

            {/* Botão de teste para abrir votação na demo */}
            <button
              onClick={() => setIsVoting(true)}
              className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-lg bg-dark-surface/80 border border-brand-gold/40 text-[11px] font-bold text-brand-gold hover:bg-dark-surface"
            >
              ⭐ Testar Tela de Votação
            </button>
          </div>
        )}
      </main>

      {/* LOWER THIRD / RODAPÉ CINEMATOGRÁFICO DA TV */}
      <footer className="relative z-20 rounded-2xl border border-dark-border/80 bg-dark-surface/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-brand-purple/20 text-brand-purple-light border border-brand-purple/30 animate-pulse">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-pink flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> No Palco Agora
            </span>
            <h3 className="font-display font-black text-xl text-white">
              Zé da Silva + Camila <span className="text-text-muted font-normal text-sm">(Dueto)</span>
            </h3>
            <p className="text-xs text-text-secondary">Música: "Evidências" — Chitãozinho & Xororó</p>
          </div>
        </div>

        <div className="h-10 w-px bg-dark-border" />

        {/* A Seguir */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-cyan-light">
              A Seguir:
            </span>
            <p className="text-sm font-bold text-white">Lucas DJ</p>
            <p className="text-xs text-text-muted">"Bohemian Rhapsody" (Queen)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center text-text-secondary">
            #2
          </div>
        </div>
      </footer>
    </div>
  );
};
