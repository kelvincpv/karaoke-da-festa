import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, Mic, Flame, QrCode, ArrowLeft, Disc3, ExternalLink } from 'lucide-react';
import { SupabaseStatusBadge } from '../components/SupabaseStatusBadge';
import { YOUTUBE_PREMIUM_LOGIN_URL } from '../lib/youtube';
import { RoomRealtimeService } from '../services/roomRealtimeService';

interface FloatingReaction {
  id: number;
  emoji: string;
  xOffset: number;
}

interface CurrentTvSong {
  youtubeVideoId: string;
  title: string;
  artist: string;
  singer: string;
  duet?: string;
  nextSinger?: string;
  nextSong?: string;
}

export const TvModePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  // Reações reais (iniciam vazias; sem injeção periódica fake)
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [currentSong, setCurrentSong] = useState<CurrentTvSong | null>(null);
  const roomCode = (code || 'FESTA1').toUpperCase();
  const joinUrl = `${window.location.origin}/room/${roomCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    joinUrl
  )}&color=ffffff&bgcolor=090a10`;

  // Sincronização em tempo real via Supabase Realtime
  useEffect(() => {
    const service = new RoomRealtimeService(
      roomCode,
      {
        id: 'tv_' + Math.random().toString(36).substring(2, 9),
        name: 'Telão TV',
        isOrganizer: false,
        joined: 'Agora',
      },
      {
        onQueueChange: (syncedQueue) => {
          if (syncedQueue.length > 0) {
            const next = syncedQueue[1];
            setCurrentSong((prev) => {
              if (prev) {
                return {
                  ...prev,
                  nextSinger: next?.singer,
                  nextSong: next?.title,
                };
              }
              const first = syncedQueue[0];
              return {
                youtubeVideoId: first.youtubeVideoId || '',
                title: first.title,
                artist: first.artist,
                singer: first.singer,
                duet: first.duet || undefined,
                nextSinger: next?.singer,
                nextSong: next?.title,
              };
            });
          } else {
            setCurrentSong(null);
          }
        },
        onCurrentSongChange: (song) => {
          if (song) {
            setCurrentSong({
              youtubeVideoId: song.youtubeVideoId || '',
              title: song.title,
              artist: song.artist,
              singer: song.singer,
              duet: song.duet || undefined,
            });
          } else {
            setCurrentSong(null);
          }
        },
        onVotingChange: (isOpen) => {
          setIsVoting(isOpen);
        },
        onReaction: (reaction) => {
          setReactions((prev) => [...prev.slice(-20), reaction]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 2500);
        },
      }
    );

    service.connect();

    return () => {
      service.disconnect();
    };
  }, [roomCode]);

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

        {/* Right Section: YouTube Premium + Status Badge + Mini QR Code info */}
        <div className="flex items-center gap-3">
          <a
            href={YOUTUBE_PREMIUM_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-gold/40 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-all text-xs font-bold"
            title="Conecte sua conta do YouTube Premium para que o Telão toque sem anúncios comerciais"
          >
            <span>👑</span>
            <span>YouTube Premium (Sem Anúncios)</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          <SupabaseStatusBadge compact />

          <div className="flex items-center gap-2.5 bg-dark-surface/80 border border-dark-border px-3 py-1.5 rounded-2xl">
            <QrCode className="w-4 h-4 text-brand-cyan-light" />
            <div className="text-left text-[11px]">
              <span className="font-bold text-white block">Entrar na Sala</span>
              <span className="text-text-muted">Aponte a câmera</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN VIEW: PLAYER OU TELA DE BOAS-VINDAS / PALCO LIBERADO */}
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
                <div className="w-24 h-24 rounded-full border-4 border-brand-purple mx-auto flex items-center justify-center bg-dark-surface text-4xl shadow-neon-purple">
                  🎤
                </div>
                <h3 className="font-bold text-xl text-white mt-3">
                  {currentSong?.singer || 'Cantor do Show'}
                </h3>
                <p className="text-sm text-brand-pink-light">
                  {currentSong?.title || 'Música Apresentada'}
                </p>
              </div>
            </div>

            <div className="flex justify-center gap-3 text-5xl">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-brand-gold animate-bounce">
                  ⭐
                </span>
              ))}
            </div>

            <button
              onClick={() => setIsVoting(false)}
              className="px-6 py-2 rounded-xl border border-dark-border text-xs text-text-muted hover:text-white"
            >
              (Fechar Votação)
            </button>
          </div>
        ) : currentSong ? (
          /* PLAYER 16:9 QUANDO HOUVER MÚSICA (Modo com suporte a YouTube Premium / Cookies) */
          <div className="relative w-full max-w-5xl aspect-video rounded-3xl border-2 border-brand-purple/40 bg-black/90 overflow-hidden shadow-neon-purple flex items-center justify-center">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${currentSong.youtubeVideoId}?autoplay=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(
                typeof window !== 'undefined' ? window.location.origin : ''
              )}`}
              title="YouTube Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />

            {/* Overlay com Emojis Flutuantes */}
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
          </div>
        ) : (
          /* TELA DE BOAS-VINDAS / PALCO LIBERADO (MVP LIMPO) */
          <div className="w-full max-w-3xl rounded-3xl border border-brand-purple/40 bg-dark-surface/90 backdrop-blur-2xl p-8 md:p-10 text-center shadow-glass flex flex-col items-center justify-center gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple/15 text-brand-purple-light border border-brand-purple/30 text-xs font-bold uppercase tracking-wider shadow-neon-purple/20">
              <Sparkles className="w-4 h-4" /> Telão da Festa • Sala Pronta
            </div>

            <div>
              <h2 className="font-display font-black text-3xl md:text-5xl text-white">
                🎤 Palco Liberado!
              </h2>
              <p className="text-text-secondary text-base md:text-lg mt-2 max-w-lg mx-auto">
                Aponte a câmera para o QR Code abaixo para entrar na sala e pedir sua música!
              </p>
            </div>

            {/* QR Code Grande e Centralizado com Efeito Glow */}
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition duration-700 animate-pulse-slow" />
              <div className="relative p-4 bg-dark-base rounded-2xl border-2 border-brand-purple/50 shadow-neon-purple">
                <img
                  src={qrCodeUrl}
                  alt={`QR Code para a sala ${roomCode}`}
                  className="w-48 h-48 md:w-56 md:h-56 rounded-xl"
                />
              </div>
            </div>

            {/* Passos rápidos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-2 text-xs">
              <div className="p-3 rounded-xl bg-dark-base/60 border border-dark-border">
                <span className="font-bold text-brand-purple-light block text-sm mb-0.5">1. Leia o QR Code</span>
                <span className="text-text-muted">com a câmera do seu smartphone</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-base/60 border border-dark-border">
                <span className="font-bold text-brand-pink-light block text-sm mb-0.5">2. Escolha seu Apelido</span>
                <span className="text-text-muted">solo ou chame um amigo para dueto</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-base/60 border border-dark-border">
                <span className="font-bold text-brand-cyan-light block text-sm mb-0.5">3. Solte a Voz!</span>
                <span className="text-text-muted">acompanhe a letra aqui na TV</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* LOWER THIRD / RODAPÉ CINEMATOGRÁFICO DA TV */}
      <footer className="relative z-20 rounded-2xl border border-dark-border/80 bg-dark-surface/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-brand-purple/20 text-brand-purple-light border border-brand-purple/30">
            {currentSong ? <Mic className="w-6 h-6 animate-pulse" /> : <Disc3 className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-pink flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> No Palco Agora
            </span>
            <h3 className="font-display font-black text-xl text-white">
              {currentSong ? (
                <>
                  {currentSong.singer}{' '}
                  {currentSong.duet && <span className="text-text-muted font-normal text-sm">+ {currentSong.duet} (Dueto)</span>}
                </>
              ) : (
                'Palco Livre • Seja o próximo a cantar!'
              )}
            </h3>
            <p className="text-xs text-text-secondary">
              {currentSong ? `Música: "${currentSong.title}" — ${currentSong.artist}` : 'Nenhum cantor na fila no momento.'}
            </p>
          </div>
        </div>

        <div className="h-10 w-px bg-dark-border" />

        {/* A Seguir */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-cyan-light">
              A Seguir:
            </span>
            <p className="text-sm font-bold text-white">
              {currentSong?.nextSinger || 'Fila Vazia'}
            </p>
            <p className="text-xs text-text-muted">
              {currentSong?.nextSong || 'Aguardando pedidos'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-dark-elevated border border-dark-border flex items-center justify-center text-text-secondary font-bold text-xs">
            {currentSong ? '#2' : '—'}
          </div>
        </div>
      </footer>
    </div>
  );
};
