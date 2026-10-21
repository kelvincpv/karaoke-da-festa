import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Star,
  Users,
  Music,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  Check,
  Tv,
  Sparkles,
  ArrowLeft,
  Crown,
} from 'lucide-react';

export const OrganizerPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [votingOpen, setVotingOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [allowDuets, setAllowDuets] = useState(true);

  // Fila mock para manipulação
  const [queue, setQueue] = useState([
    {
      id: '1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      singer: 'Lucas DJ',
      duet: null,
      isPriority: true,
      duration: '05:55',
    },
    {
      id: '2',
      title: 'Cheia de Manias',
      artist: 'Raça Negra',
      singer: 'Carlos',
      duet: 'Ana',
      isPriority: false,
      duration: '03:40',
    },
    {
      id: '3',
      title: 'Shallow',
      artist: 'Lady Gaga & Bradley Cooper',
      singer: 'Fernanda',
      duet: null,
      isPriority: false,
      duration: '03:36',
    },
  ]);

  const [participants, setParticipants] = useState([
    { id: '1', name: 'Paulinho', isSinging: true, joined: '10 min atrás' },
    { id: '2', name: 'Camila', isSinging: true, joined: '8 min atrás' },
    { id: '3', name: 'Lucas DJ', isSinging: false, joined: '15 min atrás' },
    { id: '4', name: 'Carlos', isSinging: false, joined: '20 min atrás' },
    { id: '5', name: 'Ana', isSinging: false, joined: '12 min atrás' },
    { id: '6', name: 'Fernanda', isSinging: false, joined: '5 min atrás' },
  ]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${code || 'FESTA1'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const moveQueueItem = (index: number, direction: 'up' | 'down') => {
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    setQueue(newQueue);
  };

  const togglePriority = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPriority: !item.isPriority } : item))
    );
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const kickParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-dark-base text-text-primary p-4 lg:p-6 flex flex-col gap-6">
      {/* Top Header Bar */}
      <header className="rounded-2xl border border-dark-border bg-dark-surface/90 backdrop-blur-md p-4 flex flex-wrap items-center justify-between gap-4 shadow-glass">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-text-secondary hover:text-white hover:bg-dark-elevated transition-colors"
            title="Voltar ao início"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-purple/20 text-brand-purple-light border border-brand-purple/30">
                <Shield className="w-5 h-5" />
              </span>
              <h1 className="font-display font-black text-xl text-white">
                Painel do Organizador
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple-light font-mono font-bold text-xs border border-brand-purple/40">
                SALA: {code || 'FESTA1'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Controle master de fila, player de vídeo e moderação da festa
            </p>
          </div>
        </div>

        {/* Quick Actions Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-border bg-dark-elevated hover:border-brand-purple/50 text-xs font-semibold transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4 text-brand-purple-light" />}
            {copied ? 'Link Copiado!' : 'Copiar Link da Sala'}
          </button>

          <Link
            to={`/tv/${code || 'FESTA1'}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-purple text-white text-xs font-bold shadow-neon-cyan transition-all hover:scale-105"
          >
            <Tv className="w-4 h-4" /> Abrir Modo TV
          </Link>
        </div>
      </header>

      {/* Quick Settings Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-dark-border bg-dark-surface/70 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">Auto-Play Próxima Música</span>
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              autoPlay ? 'bg-status-success' : 'bg-dark-border'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                autoPlay ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="p-3 rounded-xl border border-dark-border bg-dark-surface/70 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">Permitir Duetos</span>
          <button
            onClick={() => setAllowDuets(!allowDuets)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              allowDuets ? 'bg-brand-pink' : 'bg-dark-border'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                allowDuets ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="p-3 rounded-xl border border-dark-border bg-dark-surface/70 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">Limite por Convidado</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-dark-base border border-dark-border text-brand-cyan-light">
            3 Músicas
          </span>
        </div>
      </section>

      {/* 3 Columns Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* COLUNA 1: PALCO & PLAYER MASTER (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-dark-border bg-dark-surface p-5 flex flex-col gap-4 shadow-glass">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-ping" /> Palco Atual
              </h2>
              <span className="text-xs font-mono text-brand-cyan-light">02:14 / 04:30</span>
            </div>

            {/* Preview do Player de Vídeo */}
            <div className="aspect-video w-full rounded-xl bg-dark-base border border-dark-border overflow-hidden relative group flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80"
                alt="Player"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-base/90 via-transparent to-transparent flex flex-col justify-end p-3">
                <p className="font-bold text-sm text-white">Evidências (Karaokê Oficial)</p>
                <p className="text-xs text-brand-purple-light">Cantor: Zé da Silva + Camila (Dueto)</p>
              </div>
            </div>

            {/* Controles do Player */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => alert('Música reiniciada!')}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dark-border bg-dark-elevated hover:bg-dark-border text-xs font-semibold transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pausar' : 'Play'}
              </button>

              <button
                onClick={() => alert('Próxima música da fila acionada!')}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-status-danger/40 bg-status-danger/10 text-status-danger hover:bg-status-danger/20 text-xs font-semibold transition-all"
              >
                <SkipForward className="w-4 h-4" /> Pular
              </button>
            </div>

            {/* Seção de Votação */}
            <div className="pt-4 border-t border-dark-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                  <Star className="w-4 h-4 text-brand-gold" /> Votação do Show
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    votingOpen
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-dark-elevated text-text-muted'
                  }`}
                >
                  {votingOpen ? 'Votação Aberta' : 'Votação Fechada'}
                </span>
              </div>

              <button
                onClick={() => setVotingOpen(!votingOpen)}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  votingOpen
                    ? 'border border-status-warning bg-status-warning/20 text-status-warning'
                    : 'bg-gradient-to-r from-brand-gold to-brand-pink text-dark-base shadow-neon-gold'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {votingOpen ? 'Encerrar Votação e Computar Pontos' : '⭐ ABRIR VOTAÇÃO AGORA NA SALA'}
              </button>

              {votingOpen && (
                <div className="p-3 rounded-xl bg-dark-base border border-brand-gold/30 text-center">
                  <p className="text-xs text-brand-gold font-bold">14 de 18 convidados já votaram!</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Média parcial: 4.8 ★</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA 2: GESTÃO DA FILA (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-dark-border bg-dark-surface p-5 flex flex-col gap-4 shadow-glass flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-brand-pink" /> Fila de Espera
                </h2>
                <p className="text-xs text-text-muted">Reordene, conceda prioridade VIP ou remova</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink-light">
                {queue.length} Músicas
              </span>
            </div>

            <div className="space-y-2.5">
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all ${
                    item.isPriority
                      ? 'border-brand-gold/50 bg-brand-gold/5 shadow-neon-gold/10'
                      : 'border-dark-border bg-dark-elevated/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-dark-base flex items-center justify-center font-bold text-xs text-text-secondary shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                        <p className="text-xs text-text-muted truncate">
                          {item.artist} • <span className="text-brand-purple-light font-medium">{item.singer}</span>
                          {item.duet && <span className="text-brand-pink-light"> + {item.duet}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Ações da Fila */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePriority(item.id)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          item.isPriority
                            ? 'bg-brand-gold/20 text-brand-gold border-brand-gold/50'
                            : 'border-dark-border text-text-muted hover:text-brand-gold'
                        }`}
                        title="Tornar Prioridade VIP"
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => moveQueueItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg border border-dark-border text-text-muted hover:text-white disabled:opacity-30"
                        title="Subir posição"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => moveQueueItem(index, 'down')}
                        disabled={index === queue.length - 1}
                        className="p-1.5 rounded-lg border border-dark-border text-text-muted hover:text-white disabled:opacity-30"
                        title="Descer posição"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => removeQueueItem(item.id)}
                        className="p-1.5 rounded-lg border border-status-danger/30 text-status-danger hover:bg-status-danger/10"
                        title="Remover da fila"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA 3: PARTICIPANTES & MODERAÇÃO (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="rounded-2xl border border-dark-border bg-dark-surface p-5 flex flex-col gap-4 shadow-glass flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-cyan" /> Participantes
                </h2>
                <p className="text-xs text-text-muted">{participants.length} conectados</p>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[460px] pr-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl border border-dark-border bg-dark-elevated/50 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-status-success shrink-0" />
                      <p className="text-xs font-semibold text-text-primary truncate">{p.name}</p>
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {p.isSinging ? '🎤 No Palco Agora' : p.joined}
                    </p>
                  </div>

                  <button
                    onClick={() => kickParticipant(p.id)}
                    className="p-1 text-xs text-text-muted hover:text-status-danger transition-colors"
                    title="Expulsar participante"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-dark-border/60">
              <button
                onClick={() => alert('Modo Silêncio ativado: envio de emojis pausado temporariamente.')}
                className="w-full py-2 rounded-xl border border-dark-border bg-dark-elevated hover:bg-dark-border text-xs font-semibold text-text-secondary"
              >
                Pausar Emojis Temporariamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
