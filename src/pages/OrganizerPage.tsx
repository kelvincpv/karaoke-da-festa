import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  Disc3,
  QrCode,
  ExternalLink,
  Plus,
  Key,
  Cast,
  Trophy,
} from 'lucide-react';
import { extractYouTubeVideoId, getYouTubeThumbnail, YOUTUBE_PREMIUM_LOGIN_URL } from '../lib/youtube';
import { RoomRealtimeService, type RankingItemSync } from '../services/roomRealtimeService';
import { youtubeBridgeService, type BridgeState } from '../services/youtubeBridgeService';
import { generateUUID } from '../lib/utils';

interface QueueItemLocal {
  id: string;
  title: string;
  artist: string;
  singer: string;
  duet?: string | null;
  isPriority?: boolean;
  duration: string;
  youtubeVideoId?: string;
  addedAt?: string;
}

interface ParticipantLocal {
  id: string;
  name: string;
  isSinging: boolean;
  joined: string;
}

export const OrganizerPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [votingOpen, setVotingOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [allowDuets, setAllowDuets] = useState(true);

  // MVP Limpo & Realtime: Fila e Participantes sincronizados via Supabase Realtime
  const [queue, setQueue] = useState<QueueItemLocal[]>([]);
  const [participants, setParticipants] = useState<ParticipantLocal[]>([]);
  const [countdownState, setCountdownState] = useState<{
    active: boolean;
    secondsRemaining: number;
    songTitle: string;
    singerName: string;
  } | null>(null);
  const [rankings, setRankings] = useState<RankingItemSync[]>(() => {
    try {
      const saved = localStorage.getItem(`karaoke_rankings_${(code || 'FESTA1').toUpperCase()}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [bridgeState, setBridgeState] = useState<BridgeState>(youtubeBridgeService.getState());
  const serviceRef = useRef<RoomRealtimeService | null>(null);

  // Escuta status da extensão Karaokê Bridge
  useEffect(() => {
    const unsub = youtubeBridgeService.subscribe((state) => {
      setBridgeState(state);
    });
    return () => unsub();
  }, []);

  // Inicialização do Supabase Realtime para a sala
  useEffect(() => {
    const roomCode = (code || 'FESTA1').toUpperCase();
    const service = new RoomRealtimeService(
      roomCode,
      {
        id: 'organizer_' + Math.random().toString(36).substring(2, 9),
        name: 'Organizador',
        isOrganizer: true,
        joined: 'Agora',
      },
      {
        onParticipantsChange: (syncedParticipants) => {
          setParticipants(
            syncedParticipants.map((p) => ({
              id: p.id,
              name: p.name,
              isSinging: Boolean(p.isSinging),
              joined: p.joined || 'Agora',
            }))
          );
        },
        onQueueChange: (syncedQueue) => {
          setQueue(syncedQueue);
        },
        onVotingChange: (isOpen) => {
          setVotingOpen(isOpen);
        },
        onVotingCountdown: (countdown) => {
          if (countdown.active) {
            setCountdownState(countdown);
          } else {
            setCountdownState(null);
          }
        },
        onPlaybackCommand: (command) => {
          if (command.action === 'play') setIsPlaying(true);
          if (command.action === 'pause') setIsPlaying(false);
        },
        onRankingsChange: (newRankings) => {
          setRankings(newRankings);
        },
        onRoomDeleted: () => {
          navigate('/');
        },
      }
    );

    service.connect();
    serviceRef.current = service;

    return () => {
      service.disconnect();
    };
  }, [code]);

  // Palco atual derivado da fila ou nulo
  const currentSong = queue[0] || null;

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
    serviceRef.current?.updateQueue(newQueue);
  };

  const togglePriority = (id: string) => {
    const updated = queue.map((item) =>
      item.id === id ? { ...item, isPriority: !item.isPriority } : item
    );
    setQueue(updated);
    serviceRef.current?.updateQueue(updated);
  };

  const removeQueueItem = (id: string) => {
    const updated = queue.filter((item) => item.id !== id);
    setQueue(updated);
    serviceRef.current?.updateQueue(updated);
  };

  const kickParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  // Estados para YouTube & Adição Direta
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [manualSongTitle, setManualSongTitle] = useState('');
  const [manualSinger, setManualSinger] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState(
    () => localStorage.getItem('karaoke_youtube_api_key') || ''
  );
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(youtubeApiKey);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddDirectSong = (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractYouTubeVideoId(youtubeUrlInput);
    if (!videoId) {
      showToast('Por favor insira um link válido do YouTube');
      return;
    }
    const newItem: QueueItemLocal = {
      id: generateUUID(),
      title: manualSongTitle.trim() || 'Música do YouTube',
      artist: 'Karaokê',
      singer: manualSinger.trim() || 'Organizador',
      duet: null,
      isPriority: false,
      duration: '04:00',
      youtubeVideoId: videoId,
    };
    setQueue((prev) => [...prev, newItem]);
    serviceRef.current?.addSongToQueue(newItem);
    setYoutubeUrlInput('');
    setManualSongTitle('');
    setManualSinger('');
    setShowAddForm(false);
    showToast('Música adicionada à fila com sucesso!');
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('karaoke_youtube_api_key', tempApiKey.trim());
    setYoutubeApiKey(tempApiKey.trim());
    setShowKeyModal(false);
    showToast('Chave da YouTube Data API salva com sucesso!');
  };

  const handleOpenViaBridge = () => {
    if (!currentSong?.youtubeVideoId) return;
    youtubeBridgeService.openExternalVideo({
      videoId: currentSong.youtubeVideoId,
      title: currentSong.title,
      singer: currentSong.singer,
      sessionId: (code || 'FESTA1').toUpperCase(),
      performanceId: currentSong.id || currentSong.youtubeVideoId,
    });
    showToast('Reprodução enviada para a extensão Karaokê Bridge!');
  };

  const handleCloseBridge = () => {
    youtubeBridgeService.closeExternalVideo();
    showToast('Janela externa do YouTube fechada.');
  };

  const handleCloseAndDestroyRoom = async () => {
    if (
      window.confirm(
        `Tem certeza que deseja encerrar a sala "${code || 'FESTA1'}"? A sala e todos os dados associados serão excluídos do banco de dados Supabase.`
      )
    ) {
      await serviceRef.current?.closeAndDeleteRoom();
      showToast('Sala encerrada e excluída com sucesso do Supabase.');
      setTimeout(() => navigate('/'), 800);
    }
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
          {bridgeState.isExternalPlaying ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-purple/60 bg-brand-purple/20 text-brand-purple-light text-xs font-bold shadow-neon-purple animate-pulse">
              <Cast className="w-4 h-4 text-brand-pink" />
              <span>Bridge Ativa</span>
            </div>
          ) : bridgeState.status !== 'not_installed' ? (
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-status-success/40 bg-status-success/15 text-status-success text-xs font-bold"
              title="Extensão Karaokê Bridge detectada e sincronizada"
            >
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              <span>Bridge Pronta</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-border bg-dark-elevated text-text-muted text-xs font-semibold"
              title="Extensão Karaokê Bridge não detectada neste navegador. Recomendada para vídeos com restrição."
            >
              <span className="w-2 h-2 rounded-full bg-dark-border" />
              <span>Bridge Offline</span>
            </div>
          )}

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

          <button
            onClick={handleCloseAndDestroyRoom}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-status-danger/40 bg-status-danger/15 text-status-danger hover:bg-status-danger/25 transition-all text-xs font-bold shadow-sm"
            title="Encerrar a festa e excluir permanentemente a sala no Supabase"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Encerrar e Excluir Sala</span>
            <span className="sm:hidden">Encerrar</span>
          </button>
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
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    currentSong ? 'bg-status-success animate-ping' : 'bg-text-muted'
                  }`}
                />{' '}
                {currentSong ? 'Palco Atual' : 'Palco Liberado'}
              </h2>
              {currentSong && (
                <span className="text-xs font-mono text-brand-cyan-light">00:00 / {currentSong.duration}</span>
              )}
            </div>

            {/* Preview do Player ou Empty State */}
            {currentSong ? (
              <div className="aspect-video w-full rounded-xl bg-dark-base border border-dark-border overflow-hidden relative flex flex-col justify-end p-4">
                {currentSong.youtubeVideoId && (
                  <img
                    src={getYouTubeThumbnail(currentSong.youtubeVideoId)}
                    alt={currentSong.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-base via-dark-base/40 to-transparent" />
                <div className="relative z-10">
                  <p className="font-bold text-sm text-white">{currentSong.title}</p>
                  <p className="text-xs text-brand-purple-light">
                    Cantor: {currentSong.singer} {currentSong.duet && `+ ${currentSong.duet}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl border-2 border-dashed border-dark-border bg-dark-base/50 flex flex-col items-center justify-center p-6 text-center">
                <Disc3 className="w-10 h-10 text-brand-purple/40 animate-spin mb-2" style={{ animationDuration: '6s' }} />
                <p className="font-bold text-sm text-text-primary">Palco Livre</p>
                <p className="text-xs text-text-muted mt-1 max-w-[240px]">
                  Nenhuma música sendo reproduzida no momento. A próxima música da fila entrará aqui.
                </p>
              </div>
            )}

            {/* Controles do Player */}
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={!currentSong}
                onClick={() => {
                  serviceRef.current?.sendPlaybackCommand('restart');
                  setIsPlaying(true);
                  showToast('Música reiniciada no Telão!');
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dark-border bg-dark-elevated hover:bg-dark-border text-xs font-semibold transition-all disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar
              </button>

              <button
                disabled={!currentSong}
                onClick={() => {
                  const nextAction = isPlaying ? 'pause' : 'play';
                  setIsPlaying(!isPlaying);
                  serviceRef.current?.sendPlaybackCommand(nextAction);
                  showToast(isPlaying ? 'Música pausada no Telão!' : 'Música reproduzindo no Telão!');
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple transition-all disabled:opacity-40"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pausar' : 'Play'}
              </button>

              <button
                disabled={!currentSong}
                onClick={async () => {
                  await serviceRef.current?.advanceToNextSong();
                  showToast('Música pulada! Próxima atração no palco.');
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-status-danger/40 bg-status-danger/10 text-status-danger hover:bg-status-danger/20 text-xs font-semibold transition-all disabled:opacity-40"
              >
                <SkipForward className="w-4 h-4" /> Pular
              </button>
            </div>

            {/* Atalho Direto para o Site do YouTube */}
            {currentSong && (
              <div className="flex flex-col gap-2 pt-1">
                {bridgeState.isExternalPlaying ? (
                  <button
                    onClick={handleCloseBridge}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-brand-purple/50 bg-brand-purple/20 text-brand-purple-light hover:bg-brand-purple/30 text-xs font-bold transition-all shadow-neon-purple"
                  >
                    <Cast className="w-3.5 h-3.5 text-brand-pink" />
                    <span>Fechar Janela do Karaokê Bridge</span>
                  </button>
                ) : (
                  <button
                    onClick={handleOpenViaBridge}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-brand-purple/40 bg-brand-purple/15 text-brand-purple-light hover:bg-brand-purple/25 text-xs font-bold transition-all"
                    title="Abre o vídeo em janela popup do YouTube Premium posicionada sobre o telão"
                  >
                    <Cast className="w-3.5 h-3.5 text-brand-pink" />
                    <span>Reproduzir via Karaokê Bridge (Sem Restrições)</span>
                  </button>
                )}

                <a
                  href={`https://www.youtube.com/watch?v=${currentSong.youtubeVideoId}&autoplay=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all shadow-sm"
                  title="Abrir o vídeo direto no YouTube caso o canal bloqueie reprodução externa"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Música no YouTube Oficial</span>
                </a>
              </div>
            )}

            {/* Banner de Contagem Regressiva de Avaliação (10 segundos) */}
            {countdownState?.active && (
              <div className="p-3.5 rounded-xl border border-brand-gold/60 bg-brand-gold/15 space-y-2.5 shadow-neon-gold/20 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-brand-gold">
                  <span className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-brand-gold" /> Avaliação em Andamento
                  </span>
                  <span className="font-mono text-sm px-2 py-0.5 rounded-md bg-dark-surface border border-brand-gold/40">
                    {countdownState.secondsRemaining}s
                  </span>
                </div>
                <div className="w-full h-2.5 bg-dark-base rounded-full overflow-hidden border border-brand-gold/30">
                  <div
                    className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold transition-all duration-1000 ease-linear shadow-neon-gold"
                    style={{ width: `${(countdownState.secondsRemaining / 10) * 100}%` }}
                  />
                </div>
                <button
                  onClick={async () => {
                    setCountdownState(null);
                    serviceRef.current?.sendVotingCountdown({
                      active: false,
                      secondsRemaining: 0,
                      songTitle: '',
                      singerName: '',
                    });
                    serviceRef.current?.toggleVoting(false);
                    await serviceRef.current?.advanceToNextSong();
                    showToast('Contagem encerrada! Próximo show iniciado.');
                  }}
                  className="w-full py-2 rounded-lg bg-brand-gold text-dark-base hover:bg-brand-gold/90 font-bold text-xs shadow-md transition-all"
                >
                  Pular Contagem e Iniciar Próxima Agora
                </button>
              </div>
            )}

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
                disabled={!currentSong}
                onClick={() => {
                  const nextVal = !votingOpen;
                  setVotingOpen(nextVal);
                  serviceRef.current?.toggleVoting(nextVal);
                }}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${
                  votingOpen
                    ? 'border border-status-warning bg-status-warning/20 text-status-warning'
                    : 'bg-gradient-to-r from-brand-gold to-brand-pink text-dark-base shadow-neon-gold'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {votingOpen ? 'Encerrar Votação e Computar Pontos' : '⭐ ABRIR VOTAÇÃO AGORA NA SALA'}
              </button>
            </div>
          </div>

          {/* CARD YOUTUBE PREMIUM DO ORGANIZADOR */}
          <div className="rounded-2xl border border-brand-gold/40 bg-gradient-to-b from-dark-surface to-dark-elevated p-5 flex flex-col gap-3 shadow-neon-gold/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">👑</span>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">YouTube Premium (Sem Anúncios)</h3>
                  <p className="text-xs text-text-muted">Exclusivo para o organizador do palco</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] font-bold border border-brand-gold/30">
                Ativo no Telão
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              O modo Telão usa o player oficial com cookies habilitados. Faça login com sua conta do <strong className="text-white">YouTube Premium</strong> no navegador do Telão/TV para que todas as músicas toquem sem anúncios comerciais.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={YOUTUBE_PREMIUM_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-gold/30 to-brand-pink/20 hover:from-brand-gold/40 hover:to-brand-pink/30 border border-brand-gold/50 text-brand-gold text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-neon-gold/10"
              >
                <span>Fazer Login no YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setTempApiKey(youtubeApiKey);
                  setShowKeyModal(true);
                }}
                className="py-2.5 px-3 rounded-xl border border-dark-border bg-dark-base hover:bg-dark-surface text-text-muted hover:text-white text-xs font-semibold flex items-center gap-1 transition-all"
                title="Configurar Chave da YouTube Data API v3"
              >
                <Key className="w-3.5 h-3.5 text-brand-cyan-light" />
                <span>API Key</span>
              </button>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-2.5 py-1 rounded-lg border border-brand-purple/40 bg-brand-purple/10 text-brand-purple-light hover:bg-brand-purple/20 text-xs font-semibold flex items-center gap-1 transition-all"
                  title="Colar link de vídeo do YouTube"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Link</span>
                </button>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink-light">
                  {queue.length} Músicas
                </span>
              </div>
            </div>

            {/* Formulário Rápido de Adição por Link do YouTube */}
            {showAddForm && (
              <form onSubmit={handleAddDirectSong} className="p-3.5 rounded-xl border border-brand-purple/40 bg-dark-base/80 space-y-2.5 shadow-neon-purple/10">
                <p className="text-xs font-bold text-brand-purple-light flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Vídeo do YouTube à Fila
                </p>
                <input
                  type="text"
                  value={youtubeUrlInput}
                  onChange={(e) => setYoutubeUrlInput(e.target.value)}
                  placeholder="Cole o link do YouTube (ex: https://youtu.be/...)"
                  className="w-full text-xs rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualSongTitle}
                    onChange={(e) => setManualSongTitle(e.target.value)}
                    placeholder="Título da Música (Opcional)"
                    className="text-xs rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none"
                  />
                  <input
                    type="text"
                    value={manualSinger}
                    onChange={(e) => setManualSinger(e.target.value)}
                    placeholder="Nome do Cantor"
                    className="text-xs rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1 rounded-lg text-xs text-text-muted hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple"
                  >
                    Confirmar e Inserir
                  </button>
                </div>
              </form>
            )}

            {queue.length === 0 ? (
              /* Empty State Festivo para Fila Vazia */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-dark-border bg-dark-base/40">
                <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-center text-2xl mb-3 shadow-neon-purple/20">
                  🎤
                </div>
                <h3 className="font-display font-bold text-sm text-white">
                  Nenhum cantor na fila. A festa está começando!
                </h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs">
                  Convide os participantes a lerem o QR Code da TV ou acessarem o link da sala para escolherem suas músicas.
                </p>
                <button
                  onClick={handleCopyLink}
                  className="mt-4 px-3 py-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 text-brand-purple-light hover:bg-brand-purple/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar Link para Convidar
                </button>
              </div>
            ) : (
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
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-md bg-dark-base flex items-center justify-center font-bold text-xs text-text-secondary shrink-0">
                          #{index + 1}
                        </span>
                        {item.youtubeVideoId ? (
                          <img
                            src={getYouTubeThumbnail(item.youtubeVideoId)}
                            alt={item.title}
                            className="w-14 h-10 object-cover rounded-lg border border-dark-border shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-14 h-10 rounded-lg bg-dark-base border border-dark-border flex items-center justify-center shrink-0">
                            <Music className="w-4 h-4 text-brand-purple-light" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
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
            )}
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

            {participants.length === 0 ? (
              /* Empty State para Participantes Vazios */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-dark-border bg-dark-base/40">
                <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-xl mb-2">
                  <QrCode className="w-6 h-6 text-brand-cyan-light" />
                </div>
                <h3 className="font-semibold text-xs text-white">
                  Nenhum participante conectado ainda.
                </h3>
                <p className="text-[11px] text-text-muted mt-1">
                  Compartilhe o código ou QR Code da sala para começar a ver quem entrou!
                </p>
              </div>
            ) : (
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
            )}

            <div className="pt-2 border-t border-dark-border/60">
              <button
                onClick={() => showToast('Modo Silêncio ativado: envio de emojis pausado.')}
                className="w-full py-2 rounded-xl border border-dark-border bg-dark-elevated hover:bg-dark-border text-xs font-semibold text-text-secondary"
              >
                Pausar Emojis Temporariamente
              </button>
            </div>
          </div>

          {/* CARD CLASSIFICAÇÃO DA FESTA (RANKING AO VIVO) */}
          <div className="rounded-2xl border border-brand-gold/40 bg-dark-surface p-5 flex flex-col gap-3 shadow-neon-gold/15">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-brand-gold" /> Classificação da Festa
              </h2>
              {rankings.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.confirm('Tem certeza que deseja zerar a classificação desta festa?')) {
                      await serviceRef.current?.resetRankings();
                      showToast('Classificação zerada com sucesso!');
                    }
                  }}
                  className="text-[10px] text-text-muted hover:text-status-danger underline transition-colors"
                >
                  Zerar Placar
                </button>
              )}
            </div>

            {rankings.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-dark-border bg-dark-base/40 text-center space-y-1">
                <p className="text-xs font-semibold text-text-secondary">Nenhum voto computado ainda</p>
                <p className="text-[10px] text-text-muted">
                  Assim que os participantes avaliarem as apresentações, os líderes aparecerão aqui em tempo real.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {rankings.map((item) => (
                  <div
                    key={`${item.pos}_${item.name}`}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      item.pos === 1
                        ? 'bg-brand-gold/15 border-brand-gold/50 shadow-sm'
                        : 'bg-dark-elevated/40 border-dark-border'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                        item.pos === 1 ? 'bg-brand-gold text-dark-base font-bold' : 'bg-dark-base text-text-muted'
                      }`}>
                        {item.pos === 1 ? '🥇' : item.pos === 2 ? '🥈' : item.pos === 3 ? '🥉' : `#${item.pos}`}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        {item.song && (
                          <p className="text-[10px] text-text-muted truncate">"{item.song}"</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-brand-gold">{item.stars} ★</span>
                      <span className="text-[10px] text-text-muted block">({item.points} pts)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO NÃO-BLOQUEANTE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-dark-surface/95 backdrop-blur-md border border-brand-purple/50 text-white text-xs font-bold shadow-neon-purple animate-fadeIn flex items-center gap-2">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL CONFIGURAR CHAVE DA YOUTUBE DATA API V3 */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-purple/40 bg-dark-surface p-6 shadow-glass space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-brand-purple-light" /> YouTube Data API Key
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-xs text-text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Insira sua chave pública da <strong className="text-white">YouTube Data API v3</strong> do Google Cloud para habilitar a pesquisa de músicas em tempo real para os participantes da sua sala.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <input
                type="text"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-xl border border-dark-border bg-dark-base px-3.5 py-2.5 text-xs text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none"
              />

              <p className="text-[11px] text-text-muted">
                Sem a chave, os participantes e organizadores podem colar o link direto do YouTube na aba de busca.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple"
                >
                  Salvar Chave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
