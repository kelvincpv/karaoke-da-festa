import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Tv, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { SupabaseStatusBadge } from '../components/SupabaseStatusBadge';

export const HomePage: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    const cleanCode = roomCode.trim().toUpperCase();
    if (nickname.trim()) {
      localStorage.setItem('karaoke_nickname', nickname.trim());
    }
    navigate(`/room/${cleanCode}`);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    // Gera um código de 6 caracteres aleatórios
    const generatedCode = 'FESTA' + Math.floor(10 + Math.random() * 90);
    navigate(`/organizer/${generatedCode}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-dark-base overflow-hidden">
      {/* Indicador de Status do Supabase */}
      <div className="absolute top-4 right-4 z-20">
        <SupabaseStatusBadge />
      </div>
      {/* Background Neon Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-cyan/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header / Brand */}
      <header className="relative z-10 text-center mb-8 max-w-md w-full">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple/40 bg-brand-purple/10 text-brand-purple-light text-xs font-semibold uppercase tracking-wider mb-4 shadow-neon-purple/20">
          <Sparkles className="w-3.5 h-3.5" /> O Karaokê Definitivo da Sua Galera
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-display tracking-tight text-white flex items-center justify-center gap-3">
          <span className="bg-gradient-to-r from-brand-purple-light via-brand-pink to-brand-cyan-light bg-clip-text text-transparent">
            Karaokê da Festa
          </span>
          <span className="text-3xl">🎤</span>
        </h1>
        <p className="text-text-secondary text-sm md:text-base mt-2">
          Cante, faça duetos, reaja com emojis em tempo real e vote nos melhores shows da noite!
        </p>
      </header>

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-dark-border bg-dark-surface/90 backdrop-blur-xl p-6 md:p-8 shadow-glass">
        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-dark-base/80 p-1 mb-6 border border-dark-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'join'
                ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-neon-purple/40'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Entrar na Sala
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-neon-purple/40'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Criar Nova Sala
          </button>
        </div>

        {activeTab === 'join' ? (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Código da Sala (6 Dígitos)
              </label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="FESTA1"
                className="w-full text-center tracking-[0.35em] uppercase font-display font-black text-2xl md:text-3xl rounded-xl border border-brand-purple/40 bg-dark-base/90 py-3 text-brand-purple-light placeholder:text-text-muted/40 focus:border-brand-pink focus:shadow-neon-purple focus:outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Seu Apelido na Festa
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Paulinho do Pagode"
                className="w-full rounded-xl border border-dark-border bg-dark-base/90 px-4 py-3 text-text-primary placeholder:text-text-muted transition-all focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="mt-2 relative group overflow-hidden rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3.5 font-sans font-semibold text-white shadow-neon-purple transition-all duration-300 hover:scale-[1.02] hover:shadow-neon-pink active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Mic className="w-5 h-5" /> Entrar na Cantoria <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Nome do Evento / Festa
              </label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Ex: Aniversário do Gui 🎂"
                className="w-full rounded-xl border border-dark-border bg-dark-base/90 px-4 py-3 text-text-primary placeholder:text-text-muted transition-all focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/30 text-sm"
              />
            </div>

            <p className="text-xs text-text-muted">
              Ao criar a sala, você receberá acesso ao painel de controle do organizador e o link para o telão oficial da TV.
            </p>

            <button
              type="submit"
              className="mt-2 relative group overflow-hidden rounded-xl bg-gradient-to-r from-brand-cyan to-brand-purple px-6 py-3.5 font-sans font-semibold text-white shadow-neon-cyan transition-all duration-300 hover:scale-[1.02] hover:shadow-neon-purple active:scale-[0.98]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" /> Abrir Sala como Organizador
              </span>
            </button>
          </form>
        )}

        {/* Quick Links Footer */}
        <div className="mt-8 pt-6 border-t border-dark-border/60 flex items-center justify-around text-xs text-text-muted">
          <button
            type="button"
            onClick={() => navigate('/tv/DEMO01')}
            className="flex items-center gap-1.5 hover:text-brand-cyan-light transition-colors"
          >
            <Tv className="w-4 h-4" /> Ver Modo TV (Demo)
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => navigate('/organizer/DEMO01')}
            className="flex items-center gap-1.5 hover:text-brand-purple-light transition-colors"
          >
            <Shield className="w-4 h-4" /> Painel Admin (Demo)
          </button>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-text-muted">
        Karaokê da Festa — Dark Neon Premium Experience 🎤✨
      </footer>
    </div>
  );
};
