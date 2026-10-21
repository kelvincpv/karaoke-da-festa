import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Mic,
  Music,
  Search,
  Trophy,
  Users,
  Flame,
  Star,
  Plus,
  Play,
  Sparkles,
  ArrowLeft,
  X,
} from 'lucide-react';
import { REACTION_EMOJIS, ReactionEmoji } from '../types/karaoke';

interface FloatingReactionInstance {
  id: number;
  emoji: string;
  left: number;
}

export const RoomParticipantPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [activeTab, setActiveTab] = useState<'stage' | 'search' | 'ranking'>('stage');
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('karaoke_nickname') || 'Convidado'
  );
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [tempNick, setTempNick] = useState(nickname);

  // Reações Flutuantes Locais
  const [reactions, setReactions] = useState<FloatingReactionInstance[]>([]);

  // Modal / Bottom sheet de dueto
  const [isDuet, setIsDuet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDuetPartner, setSelectedDuetPartner] = useState('');

  // Simulação de Votação
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const mockParticipants = ['Paulinho', 'Maria Silva', 'Carlos', 'Beatriz', 'Lucas DJ'];

  const sendReaction = (emoji: ReactionEmoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 70) + 15; // 15% a 85% horizontal
    setReactions((prev) => [...prev, { id, emoji, left }]);

    // Haptic feedback se suportado
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // Ignora caso restrito por política do browser
      }
    }

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  };

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNick.trim()) {
      setNickname(tempNick.trim());
      localStorage.setItem('karaoke_nickname', tempNick.trim());
      setIsEditingNick(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-base text-text-primary pb-24 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-64 bg-brand-purple/15 blur-3xl pointer-events-none -z-10" />

      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 bg-dark-surface/90 backdrop-blur-md border-b border-dark-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-dark-elevated transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-brand-purple-light tracking-wider text-base">
                #{code || 'SALA'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-success/20 text-status-success text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-ping" /> Ao Vivo
              </span>
            </div>
            <p className="text-xs text-text-muted">Karaokê da Festa</p>
          </div>
        </div>

        {/* User Nick Pill */}
        <button
          onClick={() => {
            setTempNick(nickname);
            setIsEditingNick(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-purple/30 bg-dark-elevated hover:border-brand-purple transition-all text-xs"
        >
          <span className="w-2 h-2 rounded-full bg-brand-cyan" />
          <span className="font-semibold text-text-primary max-w-[100px] truncate">{nickname}</span>
        </button>
      </header>

      {/* Main Tab Navigation */}
      <nav className="px-4 pt-3 pb-1">
        <div className="flex rounded-xl bg-dark-surface border border-dark-border p-1">
          <button
            onClick={() => setActiveTab('stage')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'stage'
                ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-neon-purple/50'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" /> Palco & Fila
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-neon-purple/50'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" /> Buscar Música
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ranking'
                ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-neon-purple/50'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" /> Ranking
          </button>
        </div>
      </nav>

      {/* Content Area */}
      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* TAB 1: PALCO & FILA */}
        {activeTab === 'stage' && (
          <div className="space-y-4">
            {/* Banner: No Palco Agora */}
            <section className="relative overflow-hidden rounded-2xl border-2 border-brand-purple/50 bg-gradient-to-b from-dark-surface to-dark-elevated p-4 shadow-neon-purple">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-pink uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 animate-bounce" /> No Palco Agora
                </span>
                <span className="text-brand-cyan-light font-mono">02:14 / 04:30</span>
              </div>

              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-dark-base border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80"
                    alt="Capa"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white drop-shadow" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-text-primary text-base truncate">Evidências</h3>
                  <p className="text-xs text-text-secondary truncate">Chitãozinho & Xororó</p>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple-light text-xs font-semibold border border-brand-purple/30">
                      <Mic className="w-3 h-3" /> Zé da Silva
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink-light text-xs font-semibold border border-brand-pink/30">
                      <Users className="w-3 h-3" /> + Camila (Dueto)
                    </span>
                  </div>
                </div>
              </div>

              {/* Botão de teste de votação */}
              <div className="mt-4 pt-3 border-t border-dark-border/80 flex items-center justify-between">
                <span className="text-xs text-text-muted">Gostando do show? Avalie:</span>
                <button
                  onClick={() => setShowVotingModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-xs font-bold hover:bg-brand-gold/30 transition-all flex items-center gap-1 shadow-neon-gold/20"
                >
                  <Star className="w-3.5 h-3.5 fill-brand-gold" /> Abrir Votação (Demo)
                </button>
              </div>
            </section>

            {/* Minhas Músicas na Fila */}
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Music className="w-4 h-4 text-brand-cyan" /> Minhas Músicas
              </h4>

              <div className="p-3 rounded-xl border border-brand-cyan/30 bg-dark-surface/60 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Cheia de Manias</p>
                  <p className="text-xs text-text-muted">Raça Negra • Posição: #3 na fila</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-cyan/20 text-brand-cyan-light border border-brand-cyan/30">
                  Em Breve
                </span>
              </div>
            </section>

            {/* Próximos na Fila */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-purple-light" /> Próximos na Fila (3)
                </h4>
                <span className="text-xs text-text-muted">Tempo est.: ~12 min</span>
              </div>

              <div className="space-y-2">
                {[
                  { pos: '#1', title: 'Bohemian Rhapsody', artist: 'Queen', singer: 'Lucas DJ', duration: '5:55' },
                  { pos: '#2', title: 'Shallow', artist: 'Lady Gaga', singer: 'Maria & Paulinho', duration: '3:36' },
                  { pos: '#3', title: 'Cheia de Manias', artist: 'Raça Negra', singer: nickname, duration: '3:40' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-surface/80 hover:bg-dark-elevated transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-dark-base flex items-center justify-center font-bold text-xs text-text-secondary">
                      {item.pos}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                      <p className="text-xs text-text-muted truncate">
                        {item.artist} • <span className="text-brand-purple-light">{item.singer}</span>
                      </p>
                    </div>
                    <span className="text-xs font-mono text-text-muted">{item.duration}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: BUSCA YOUTUBE & DUETOS */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque música ou artista de karaokê..."
                className="w-full rounded-xl border border-dark-border bg-dark-surface px-4 py-3 pl-10 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              />
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            </div>

            {/* Toggle Dueto */}
            <div className="p-3.5 rounded-xl border border-dark-border bg-dark-surface space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-brand-pink" /> Cantar em Dueto?
                  </p>
                  <p className="text-xs text-text-muted">Chame alguém da festa para cantar com você</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDuet(!isDuet)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    isDuet ? 'bg-brand-pink' : 'bg-dark-border'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      isDuet ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {isDuet && (
                <div className="pt-2 border-t border-dark-border/60">
                  <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                    Escolha seu parceiro de palco:
                  </label>
                  <select
                    value={selectedDuetPartner}
                    onChange={(e) => setSelectedDuetPartner(e.target.value)}
                    className="w-full rounded-lg border border-dark-border bg-dark-base px-3 py-2 text-xs text-text-primary focus:border-brand-pink focus:outline-none"
                  >
                    <option value="">Selecione um participante...</option>
                    {mockParticipants.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Resultados Mock do YouTube */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Sugestões Populares de Karaokê
              </p>

              {[
                { title: 'Evidências (Karaokê)', channel: 'Karaokê Brasil', dur: '4:30', id: 'evidencias' },
                { title: 'Menina Veneno (Karaokê)', channel: 'Top Karaokê', dur: '3:50', id: 'veneno' },
                { title: 'Temporal de Amor (Karaokê)', channel: 'SertanejoKaraoke', dur: '4:10', id: 'temporal' },
                { title: 'Rolling in the Deep (Karaoke)', channel: 'Sing King', dur: '3:48', id: 'adele' },
              ].map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-dark-border bg-dark-surface hover:border-brand-purple/50 transition-all"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-semibold text-text-primary truncate">{song.title}</p>
                    <p className="text-xs text-text-muted">
                      {song.channel} • {song.dur}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      alert(`"${song.title}" adicionada à fila com sucesso! 🎤✨`);
                      setActiveTab('stage');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold flex items-center gap-1 shadow-neon-purple/40 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RANKING & PÓDIO */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <h3 className="font-display font-black text-xl text-white flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold" /> Hall da Fama da Festa
              </h3>
              <p className="text-xs text-text-muted">Os maiores talentos da cantoria!</p>
            </div>

            {/* Pódio Top 3 */}
            <div className="grid grid-cols-3 gap-2 items-end pt-4 pb-2">
              {/* 2º Lugar */}
              <div className="flex flex-col items-center">
                <span className="text-xl">🥈</span>
                <div className="w-full bg-dark-surface border border-brand-cyan/40 rounded-t-xl p-2 text-center h-24 flex flex-col justify-end">
                  <p className="text-xs font-bold text-text-primary truncate">Maria</p>
                  <p className="text-[10px] text-brand-gold font-bold">4.8 ★</p>
                  <span className="text-[10px] text-text-muted">2º Lugar</span>
                </div>
              </div>

              {/* 1º Lugar */}
              <div className="flex flex-col items-center">
                <span className="text-2xl animate-bounce">👑</span>
                <div className="w-full bg-gradient-to-b from-brand-purple/30 to-dark-surface border-2 border-brand-gold rounded-t-xl p-2 text-center h-32 flex flex-col justify-end shadow-neon-gold">
                  <span className="text-lg">🥇</span>
                  <p className="text-xs font-black text-white truncate">Paulinho</p>
                  <p className="text-xs text-brand-gold font-black">5.0 ★</p>
                  <span className="text-[10px] text-brand-gold uppercase font-bold">Campeão</span>
                </div>
              </div>

              {/* 3º Lugar */}
              <div className="flex flex-col items-center">
                <span className="text-xl">🥉</span>
                <div className="w-full bg-dark-surface border border-brand-pink/40 rounded-t-xl p-2 text-center h-20 flex flex-col justify-end">
                  <p className="text-xs font-bold text-text-primary truncate">Carlos</p>
                  <p className="text-[10px] text-brand-gold font-bold">4.6 ★</p>
                  <span className="text-[10px] text-text-muted">3º Lugar</span>
                </div>
              </div>
            </div>

            {/* Lista restante */}
            <div className="space-y-2">
              {[
                { pos: 4, name: 'Beatriz', stars: '4.4', points: 480 },
                { pos: 5, name: 'Lucas DJ', stars: '4.2', points: 420 },
              ].map((item) => (
                <div
                  key={item.pos}
                  className="flex items-center justify-between p-3 rounded-xl border border-dark-border bg-dark-surface"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-muted">#{item.pos}</span>
                    <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-brand-gold font-bold">{item.stars} ★</span>
                    <span className="text-text-muted">({item.points} pts)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* REAÇÕES FLUTUANTES (Partículas animadas) */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="reaction-particle text-3xl select-none"
            style={{ left: `${r.left}%`, bottom: '80px' }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* BARRA FIXA DE REAÇÕES (Rodapé Mobile) */}
      <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 md:gap-2 rounded-full border border-white/10 bg-dark-surface/90 backdrop-blur-xl px-3 py-1.5 shadow-2xl">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 active:scale-90"
            title={`Enviar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </footer>

      {/* FAB: Adicionar Música Rápida */}
      {activeTab !== 'search' && (
        <button
          onClick={() => setActiveTab('search')}
          className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-purple to-brand-pink text-white shadow-neon-pink transition-transform hover:scale-110 active:scale-95"
          title="Adicionar Música"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* MODAL: EDIÇÃO DE APELIDO */}
      {isEditingNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-dark-border bg-dark-surface p-6 shadow-glass">
            <h3 className="font-display font-bold text-lg text-white mb-2">Alterar seu Apelido</h3>
            <form onSubmit={handleSaveNick} className="space-y-4">
              <input
                type="text"
                value={tempNick}
                onChange={(e) => setTempNick(e.target.value)}
                placeholder="Seu apelido na festa"
                className="w-full rounded-xl border border-dark-border bg-dark-base px-4 py-3 text-sm text-text-primary focus:border-brand-purple focus:outline-none"
                autoFocus
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingNick(false)}
                  className="flex-1 py-2.5 rounded-xl border border-dark-border text-xs font-semibold text-text-secondary hover:bg-dark-elevated"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-semibold shadow-neon-purple"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VOTAÇÃO INTERATIVA (1 a 5 Estrelas) */}
      {showVotingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-brand-gold/40 bg-dark-surface p-6 text-center shadow-neon-gold space-y-4 relative">
            <button
              onClick={() => setShowVotingModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Hora da Nota!
            </div>

            <div>
              <h3 className="font-display font-black text-xl text-white">O que achou do show?</h3>
              <p className="text-xs text-text-secondary mt-1">Cantor: Zé da Silva com "Evidências"</p>
            </div>

            {/* Estrelas Gigantes */}
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  className={`text-3xl md:text-4xl transition-all ${
                    (selectedRating || 0) >= star
                      ? 'scale-125 filter drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                      : 'opacity-40 hover:opacity-80'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>

            {selectedRating && (
              <p className="text-xs font-bold text-brand-gold animate-pulse">
                {selectedRating === 1 && 'Faltou afinação 😅'}
                {selectedRating === 2 && 'Tentativa válida! 👏'}
                {selectedRating === 3 && 'Mandou bem! 🎶'}
                {selectedRating === 4 && 'Voz de ouro! 🔥'}
                {selectedRating === 5 && 'PROFISSIONAL! SHOW HISTÓRICO! 🌟'}
              </p>
            )}

            <button
              disabled={!selectedRating}
              onClick={() => {
                alert(`Voto de ${selectedRating} estrelas enviado! 🌟`);
                setShowVotingModal(false);
                setSelectedRating(null);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-gold to-brand-pink font-bold text-dark-base text-sm shadow-neon-gold disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              Confirmar Meu Voto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
