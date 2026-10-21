import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  AlertCircle,
  Loader2,
  Key,
  Check,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { REACTION_EMOJIS, ReactionEmoji } from '../types/karaoke';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnail,
  getYouTubeApiKey,
  setYouTubeApiKey,
  searchYouTubeKaraoke,
  type YouTubeSearchResultItem,
} from '../lib/youtube';
import { RoomRealtimeService, type RankingItemSync } from '../services/roomRealtimeService';
import { generateUUID, isSelfSinger, getPerformanceKey } from '../lib/utils';
import confetti from 'canvas-confetti';

interface FloatingReactionInstance {
  id: number;
  emoji: string;
  left: number;
}

export const RoomParticipantPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const roomCode = (code || 'FESTA1').toUpperCase();

  // Entrada Obrigatória com Nome / Apelido ao escanear o QR Code
  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    const sessionJoined = sessionStorage.getItem(`karaoke_joined_${(code || 'FESTA1').toUpperCase()}`);
    const savedNick = localStorage.getItem('karaoke_nickname');
    return Boolean(sessionJoined && savedNick && savedNick.trim() !== '' && savedNick.trim() !== 'Convidado');
  });
  const [joinNickInput, setJoinNickInput] = useState(() => {
    const saved = localStorage.getItem('karaoke_nickname');
    return saved && saved !== 'Convidado' ? saved : '';
  });
  const [selectedAvatar, setSelectedAvatar] = useState('🎤');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'stage' | 'search' | 'ranking'>('stage');
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('karaoke_nickname') || 'Convidado'
  );
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [tempNick, setTempNick] = useState(nickname);

  // Reações Flutuantes Locais
  const [reactions, setReactions] = useState<FloatingReactionInstance[]>([]);

  // Modal / Opções de dueto
  const [isDuet, setIsDuet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDuetPartner, setSelectedDuetPartner] = useState('');

  // Votação interativa
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [countdownState, setCountdownState] = useState<{
    active: boolean;
    secondsRemaining: number;
    songTitle: string;
    singerName: string;
    songId?: string;
    duetName?: string;
    nextSongTitle?: string;
    nextSingerName?: string;
  } | null>(null);

  // Histórico de avaliações enviadas por este participante nesta sala (1 voto por música)
  const [votedPerformances, setVotedPerformances] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`karaoke_voted_performances_${roomCode}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sincronização em Tempo Real (Supabase Realtime)
  const [connectedParticipants, setConnectedParticipants] = useState<Array<{ id: string; name: string; isOrganizer?: boolean; joined?: string }>>([]);
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]);
  const [currentStageSong, setCurrentStageSong] = useState<{
    id?: string;
    title: string;
    artist: string;
    singer: string;
    duet?: string;
    duration: string;
    videoId?: string;
  } | null>(null);
  const [mySongs, setMySongs] = useState<Array<{ id: string; title: string; artist: string; position: number; videoId?: string }>>([]);
  const [upcomingQueue, setUpcomingQueue] = useState<Array<{ pos: string; title: string; artist: string; singer: string; duration: string; videoId?: string }>>([]);
  const [rankings, setRankings] = useState<RankingItemSync[]>(() => {
    try {
      const saved = localStorage.getItem(`karaoke_rankings_${roomCode}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const serviceRef = useRef<RoomRealtimeService | null>(null);

  // Conectar à sala do Supabase Realtime (apenas após o participante confirmar o nome)
  useEffect(() => {
    if (!hasJoined) return;

    const participantId =
      localStorage.getItem('karaoke_participant_id') ||
      ('user_' + Math.random().toString(36).substring(2, 9));
    localStorage.setItem('karaoke_participant_id', participantId);

    const service = new RoomRealtimeService(
      roomCode,
      {
        id: participantId,
        name: nickname,
        isOrganizer: false,
        joined: 'Agora',
      },
      {
        onParticipantsChange: (syncedParticipants) => {
          setConnectedParticipants(syncedParticipants);
          const others = syncedParticipants
            .filter((p) => p.name !== nickname)
            .map((p) => p.name);
          setRoomParticipants(others);
        },
        onQueueChange: (syncedQueue) => {
          const formatted = syncedQueue.map((item, idx) => ({
            id: item.id,
            pos: `#${idx + 1}`,
            title: item.title,
            artist: item.artist,
            singer: item.singer,
            duration: item.duration,
            videoId: item.youtubeVideoId,
          }));
          setUpcomingQueue(formatted);
          const mine = formatted
            .filter((item) => item.singer.toLowerCase().includes(nickname.toLowerCase()))
            .map((item, idx) => ({
              id: item.id,
              title: item.title,
              artist: item.artist,
              position: idx + 1,
              videoId: item.videoId,
            }));
          setMySongs(mine);
        },
        onCurrentSongChange: (song) => {
          if (song) {
            setCurrentStageSong({
              id: song.id,
              title: song.title,
              artist: song.artist,
              singer: song.singer,
              duet: song.duet || undefined,
              duration: song.duration,
              videoId: song.youtubeVideoId,
            });
          } else {
            setCurrentStageSong(null);
          }
        },
        onVotingChange: (isOpen) => {
          setShowVotingModal(isOpen);
        },
        onVotingCountdown: (countdown) => {
          if (countdown.active) {
            setCountdownState(countdown);
            setShowVotingModal(true);
          } else {
            setCountdownState(null);
            setShowVotingModal(false);
          }
        },
        onRankingsChange: (newRankings) => {
          setRankings(newRankings);
        },
        onRatingSubmit: (data) => {
          showToast(`🌟 ${data.voter || 'Alguém'} avaliou ${data.singer} com ${data.score}★!`);
        },
        onReaction: (reaction) => {
          setReactions((prev) => [
            ...prev,
            { id: reaction.id, emoji: reaction.emoji as any, left: reaction.xOffset },
          ]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 2500);
        },
        onRoomDeleted: () => {
          showToast('A sala foi encerrada pelo organizador e removida do banco de dados.');
          setTimeout(() => navigate('/'), 1500);
        },
      }
    );

    service.connect();
    serviceRef.current = service;

    return () => {
      service.disconnect();
    };
  }, [code, nickname, hasJoined]);

  // Estados de Busca no YouTube
  const [searchResults, setSearchResults] = useState<YouTubeSearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(getYouTubeApiKey()));
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(() => getYouTubeApiKey());

  // Debounced search no YouTube
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (extractYouTubeVideoId(searchQuery)) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      const res = await searchYouTubeKaraoke(searchQuery.trim());
      setHasApiKey(res.hasApiKey);
      setSearchResults(res.items);
      if (res.error) {
        setSearchError(res.error);
      }
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Identificação reativa da performance ativa e regras de voto
  const activeSinger = countdownState?.singerName || currentStageSong?.singer || '';
  const activeDuet = countdownState?.duetName || currentStageSong?.duet || '';
  const activeTitle = countdownState?.songTitle || currentStageSong?.title || '';
  const activeSongId = countdownState?.songId || currentStageSong?.id;
  const activePerformanceKey = getPerformanceKey(activeSongId, activeSinger, activeTitle);

  const isUserSinging = isSelfSinger(activeSinger, activeDuet, nickname);
  const userRatingForActiveSong = votedPerformances[activePerformanceKey];
  const hasAlreadyVoted = userRatingForActiveSong !== undefined;

  const handleSaveUserKey = (e: React.FormEvent) => {
    e.preventDefault();
    setYouTubeApiKey(tempApiKey.trim());
    setHasApiKey(Boolean(tempApiKey.trim()));
    setShowKeyModal(false);
    showToast('Chave do YouTube salva com sucesso!');
    if (searchQuery.trim()) {
      searchYouTubeKaraoke(searchQuery.trim(), tempApiKey.trim()).then((res) => {
        setSearchResults(res.items);
        if (res.error) setSearchError(res.error);
      });
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = joinNickInput.trim();
    if (!cleanNick) {
      setJoinError('Por favor, informe seu nome ou apelido para entrar na sala.');
      return;
    }
    const finalNick = selectedAvatar ? `${selectedAvatar} ${cleanNick}` : cleanNick;
    localStorage.setItem('karaoke_nickname', finalNick);
    sessionStorage.setItem(`karaoke_joined_${roomCode}`, 'true');
    setNickname(finalNick);
    setTempNick(finalNick);
    setHasJoined(true);
    setJoinError(null);
  };

  const handleAddSongToQueue = (title: string, artist: string, videoId: string) => {
    const newPosition = upcomingQueue.length + 1;
    const singerName = isDuet && selectedDuetPartner ? `${nickname} & ${selectedDuetPartner}` : nickname;
    const songId = generateUUID();
    const newMySong = {
      id: songId,
      title,
      artist,
      position: newPosition,
      videoId,
    };
    const newQueueItem = {
      pos: `#${newPosition}`,
      title,
      artist,
      singer: singerName,
      duration: '04:00',
      videoId,
    };
    setMySongs((prev) => [...prev, newMySong]);
    setUpcomingQueue((prev) => [...prev, newQueueItem]);

    // Transmitir para o Telão e Organizador via Supabase Realtime
    serviceRef.current?.addSongToQueue({
      id: songId,
      title,
      artist,
      singer: singerName,
      duet: isDuet && selectedDuetPartner ? selectedDuetPartner : null,
      duration: '04:00',
      youtubeVideoId: videoId,
      addedAt: new Date().toLocaleTimeString(),
    });

    setSearchQuery('');
    showToast(`"${title}" adicionada à fila! 🎤✨`);
    setActiveTab('stage');
  };

  const sendReaction = (emoji: ReactionEmoji) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 70) + 15;
    setReactions((prev) => [...prev, { id, emoji, left }]);

    // Transmitir emoji para o Telão e outros participantes
    serviceRef.current?.sendReaction(emoji, left);

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

  // Se o participante ainda não informou seu nome para esta sala, exibe a tela de entrada obrigatória
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-dark-base text-text-primary flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
        {/* Background Neon Blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-brand-purple/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-brand-pink/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="w-full max-w-sm rounded-3xl border border-brand-purple/40 bg-dark-surface/90 backdrop-blur-2xl p-6 sm:p-8 text-center shadow-glass relative z-10 space-y-6 animate-fade-in">
          {/* Header Badge */}
          <div className="flex flex-col items-center gap-2">
            <span className="px-3.5 py-1 rounded-full bg-brand-purple/20 text-brand-purple-light border border-brand-purple/40 text-xs font-bold uppercase tracking-wider shadow-neon-purple/20">
              🎤 Karaokê da Festa • Sala {roomCode}
            </span>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white mt-1">
              Quem é você na festa?
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Digite seu nome ou apelido para pedir músicas, cantar no palco e participar da classificação ao vivo!
            </p>
          </div>

          {/* Avatar / Emoji Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
              Escolha seu ícone:
            </label>
            <div className="flex justify-center gap-1.5 flex-wrap">
              {['🎤', '🌟', '🔥', '😎', '🎸', '👑', '🥳', '💃'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    selectedAvatar === emoji
                      ? 'bg-brand-purple/30 border-2 border-brand-pink scale-110 shadow-neon-pink'
                      : 'bg-dark-base border border-dark-border opacity-60 hover:opacity-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleJoinRoom} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1.5">
                Seu Nome ou Apelido:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={joinNickInput}
                  onChange={(e) => {
                    setJoinNickInput(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  placeholder="Ex: Kelvin Moreira"
                  maxLength={24}
                  autoFocus
                  required
                  className="w-full rounded-2xl border-2 border-dark-border bg-dark-base px-4 py-3.5 text-base text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none focus:shadow-neon-purple transition-all"
                />
              </div>
              {joinError && (
                <p className="text-xs text-status-danger mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {joinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!joinNickInput.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan text-white font-bold text-sm uppercase tracking-wider shadow-neon-purple hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              <span>Entrar no Karaokê</span>
              <span>🚀</span>
            </button>
          </form>

          <p className="text-[11px] text-text-muted">
            Você poderá alterar seu apelido a qualquer momento durante a festa.
          </p>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTempNick(nickname);
              setIsEditingNick(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-purple/30 bg-dark-elevated hover:border-brand-purple transition-all text-xs"
          >
            <span className="w-2 h-2 rounded-full bg-brand-cyan" />
            <span className="font-semibold text-text-primary max-w-[80px] truncate">{nickname}</span>
          </button>
        </div>
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
            {/* Banner: No Palco Agora ou Empty State */}
            {currentStageSong ? (
              <section className="relative overflow-hidden rounded-2xl border-2 border-brand-purple/50 bg-gradient-to-b from-dark-surface to-dark-elevated p-4 shadow-neon-purple">
                <div className="flex items-center justify-between text-xs font-semibold text-brand-pink uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 animate-bounce" /> No Palco Agora
                  </span>
                  <span className="text-brand-cyan-light font-mono">{currentStageSong.duration}</span>
                </div>

                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl bg-dark-base border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {currentStageSong.videoId ? (
                      <img
                        src={getYouTubeThumbnail(currentStageSong.videoId)}
                        alt={currentStageSong.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary text-base truncate">{currentStageSong.title}</h3>
                    <p className="text-xs text-text-secondary truncate">{currentStageSong.artist}</p>

                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple-light text-xs font-semibold border border-brand-purple/30">
                        <Mic className="w-3 h-3" /> {currentStageSong.singer}
                      </span>
                      {currentStageSong.duet && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink-light text-xs font-semibold border border-brand-pink/30">
                          <Users className="w-3 h-3" /> + {currentStageSong.duet}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dark-border/80 flex items-center justify-between">
                  {isUserSinging ? (
                    <>
                      <span className="text-xs text-brand-purple-light flex items-center gap-1.5 font-bold">
                        <Mic className="w-3.5 h-3.5 animate-pulse text-brand-pink" /> Você está no palco agora!
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-brand-purple/20 text-brand-purple-light border border-brand-purple/30 text-xs font-bold shadow-neon-purple/20">
                        🎤 Dê um show!
                      </span>
                    </>
                  ) : hasAlreadyVoted ? (
                    <>
                      <span className="text-xs text-text-muted">Avaliação enviada:</span>
                      <span className="px-3 py-1 rounded-lg bg-dark-base text-brand-gold border border-brand-gold/30 text-xs font-bold flex items-center gap-1.5 shadow-neon-gold/15">
                        <CheckCircle2 className="w-3.5 h-3.5 text-status-success" /> Sua nota: {userRatingForActiveSong} ★
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-text-muted">Gostando do show? Avalie:</span>
                      <button
                        onClick={() => {
                          setSelectedRating(null);
                          setShowVotingModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-xs font-bold hover:bg-brand-gold/30 transition-all flex items-center gap-1 shadow-neon-gold/20"
                      >
                        <Star className="w-3.5 h-3.5 fill-brand-gold" /> Avaliar Cantoria ⭐
                      </button>
                    </>
                  )}
                </div>
              </section>
            ) : (
              /* Empty State Palco Liberado */
              <section className="relative overflow-hidden rounded-2xl border border-dashed border-dark-border bg-dark-surface/60 p-6 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-brand-purple/20 text-brand-purple-light flex items-center justify-center mx-auto text-2xl shadow-neon-purple/20">
                  🎤
                </div>
                <h3 className="font-display font-black text-lg text-white">Palco Liberado!</h3>
                <p className="text-xs text-text-muted max-w-xs mx-auto">
                  Ninguém cantando no momento. Seja o primeiro a pedir uma música!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Escolher Música Agora
                  </button>
                </div>
              </section>
            )}

            {/* Minhas Músicas na Fila */}
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Music className="w-4 h-4 text-brand-cyan" /> Minhas Músicas ({mySongs.length})
              </h4>

              {mySongs.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-dark-border bg-dark-surface/40 text-center">
                  <p className="text-xs text-text-muted">Você ainda não adicionou nenhuma música à fila.</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-2 text-xs text-brand-cyan-light font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" /> Buscar uma música no YouTube
                  </button>
                </div>
              ) : (
                mySongs.map((song) => (
                  <div
                    key={song.id}
                    className="p-3 rounded-xl border border-brand-cyan/30 bg-dark-surface/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {song.videoId ? (
                        <img
                          src={getYouTubeThumbnail(song.videoId)}
                          alt={song.title}
                          className="w-14 h-10 object-cover rounded-lg border border-dark-border shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-10 rounded-lg bg-dark-base border border-dark-border flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-brand-cyan-light" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary truncate">{song.title}</p>
                        <p className="text-xs text-text-muted truncate">
                          {song.artist} • Posição #{song.position} na fila
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-cyan/20 text-brand-cyan-light border border-brand-cyan/30 shrink-0">
                      Na Fila
                    </span>
                  </div>
                ))
              )}
            </section>

            {/* Próximos na Fila */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-purple-light" /> Próximos na Fila ({upcomingQueue.length})
                </h4>
              </div>

              {upcomingQueue.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-dark-border bg-dark-surface/40 text-center text-xs text-text-muted">
                  A fila de espera está vazia. O palco está te esperando!
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingQueue.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-surface/80 hover:bg-dark-elevated transition-colors"
                    >
                      <span className="w-6 h-6 rounded-lg bg-dark-base flex items-center justify-center font-bold text-xs text-text-secondary shrink-0">
                        {item.pos}
                      </span>
                      {item.videoId ? (
                        <img
                          src={getYouTubeThumbnail(item.videoId)}
                          alt={item.title}
                          className="w-14 h-10 object-cover rounded-lg border border-dark-border shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-10 rounded-lg bg-dark-base border border-dark-border flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-brand-purple-light" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                        <p className="text-xs text-text-muted truncate">
                          {item.artist} • <span className="text-brand-purple-light">{item.singer}</span>
                        </p>
                      </div>
                      <span className="text-xs font-mono text-text-muted shrink-0">{item.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Galera na Festa (Participantes Conectados) */}
            <section className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-cyan-light" /> Galera na Festa ({connectedParticipants.length})
                </h4>
                <span className="text-[10px] font-semibold text-status-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" /> Ao Vivo
                </span>
              </div>

              {connectedParticipants.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-dark-border bg-dark-surface/40 text-center text-xs text-text-muted">
                  Você é o primeiro a chegar! Convide a galera pelo código da sala #{code || 'SALA'}.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {connectedParticipants.map((p) => (
                    <div
                      key={p.id || p.name}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        p.name === nickname
                          ? 'bg-brand-purple/20 text-brand-purple-light border-brand-purple/50 shadow-neon-purple/20'
                          : 'bg-dark-surface text-text-primary border-dark-border'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.isOrganizer ? 'bg-brand-gold animate-pulse' : 'bg-brand-cyan'
                        }`}
                      />
                      <span className="truncate max-w-[120px]">{p.name}</span>
                      {p.name === nickname && (
                        <span className="text-[9px] uppercase px-1 rounded bg-brand-purple/40 text-white font-bold">
                          Você
                        </span>
                      )}
                      {p.isOrganizer && (
                        <span className="text-[9px] uppercase px-1 rounded bg-brand-gold/30 text-brand-gold font-bold">
                          Host
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                placeholder="Busque por nome ou cole o link do YouTube..."
                className="w-full rounded-xl border border-dark-border bg-dark-surface px-4 py-3 pl-10 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              />
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
            </div>

            {/* CARD SE LINK DO YOUTUBE FOR DETECTADO */}
            {(() => {
              const detectedVideoId = extractYouTubeVideoId(searchQuery);
              if (!detectedVideoId) return null;
              return (
                <div className="p-4 rounded-2xl border-2 border-brand-purple/60 bg-gradient-to-b from-dark-surface to-dark-elevated shadow-neon-purple space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-purple-light uppercase">
                    <Sparkles className="w-4 h-4" /> Link do YouTube Reconhecido!
                  </div>
                  <div className="flex gap-3 items-center">
                    <img
                      src={getYouTubeThumbnail(detectedVideoId)}
                      alt="Thumbnail do Vídeo"
                      className="w-24 h-16 rounded-lg object-cover border border-brand-purple/40"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">Música por Link do YouTube</p>
                      <p className="text-xs text-brand-cyan-light font-mono truncate">ID: {detectedVideoId}</p>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">
                        Cantor: {isDuet && selectedDuetPartner ? `${nickname} & ${selectedDuetPartner}` : nickname}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddSongToQueue('Música do YouTube', 'Karaokê', detectedVideoId)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" /> Colocar Este Vídeo na Fila
                  </button>
                </div>
              );
            })()}

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
                  {roomParticipants.length === 0 ? (
                    <div className="p-2.5 rounded-lg border border-dark-border bg-dark-base flex items-center gap-2 text-xs text-status-warning">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Nenhum outro participante na sala ainda. Aguarde a galera entrar!</span>
                    </div>
                  ) : (
                    <select
                      value={selectedDuetPartner}
                      onChange={(e) => setSelectedDuetPartner(e.target.value)}
                      className="w-full rounded-lg border border-dark-border bg-dark-base px-3 py-2 text-xs text-text-primary focus:border-brand-pink focus:outline-none"
                    >
                      <option value="">Selecione um participante...</option>
                      {roomParticipants.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* STATUS / ERRO / LOADER DE BUSCA DO YOUTUBE */}
            {isSearching && (
              <div className="flex items-center justify-center gap-2 py-6 text-brand-purple-light text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Buscando no YouTube...</span>
              </div>
            )}

            {searchError && (
              <div className="p-3.5 rounded-xl bg-status-danger/15 border border-status-danger/40 text-status-danger text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <AlertCircle className="w-4 h-4 text-status-danger" /> Resposta da YouTube API:
                  </span>
                  <button
                    onClick={() => {
                      setTempApiKey(getYouTubeApiKey());
                      setShowKeyModal(true);
                    }}
                    className="px-2 py-0.5 rounded-lg border border-status-danger/40 bg-status-danger/20 hover:bg-status-danger/30 text-white text-[11px] font-bold"
                  >
                    Trocar Chave
                  </button>
                </div>
                <p className="text-[11px] text-text-primary break-words font-mono bg-dark-base/80 p-2 rounded border border-status-danger/30">
                  {searchError}
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  💡 <strong>Dica:</strong> Se a mensagem disser que a API está desativada, abra o Google Cloud Console e clique em <em>Enable YouTube Data API v3</em>. Ou cole o link direto do vídeo acima!
                </p>
              </div>
            )}

            {!hasApiKey && !searchError && searchQuery.trim().length > 1 && (
              <div className="p-3.5 rounded-xl bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-white">
                    <Key className="w-4 h-4 text-brand-gold" /> Chave de API Não Detectada
                  </span>
                  <button
                    onClick={() => {
                      setTempApiKey(getYouTubeApiKey());
                      setShowKeyModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 text-white font-bold text-[11px]"
                  >
                    Inserir Chave Aqui
                  </button>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  A variável de ambiente ainda não foi carregada no navegador. Você pode inserir sua <strong>VITE_YOUTUBE_API_KEY</strong> aqui para ativar agora mesmo, ou colar o link direto de qualquer vídeo do YouTube acima.
                </p>
              </div>
            )}

            {/* RESULTADOS DA BUSCA AO VIVO NO YOUTUBE (ESTILO YOUTUBE: THUMB GRANDE EM CIMA, TÍTULO COMPLETO EMBAIXO) */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
                  <span>Resultados no YouTube ({searchResults.length})</span>
                  <span className="text-[10px] text-brand-purple-light font-normal">Ao vivo</span>
                </p>

                <div className="grid grid-cols-1 gap-3.5">
                  {searchResults.map((song) => (
                    <div
                      key={song.id}
                      className="rounded-2xl border border-dark-border bg-dark-surface overflow-hidden hover:border-brand-purple/60 hover:shadow-neon-purple/20 transition-all flex flex-col group"
                    >
                      {/* Thumb grande em cima (proporção 16:9 aspecto de vídeo do YouTube) */}
                      <div className="relative aspect-video w-full bg-dark-base overflow-hidden">
                        <img
                          src={song.thumbnailUrl}
                          alt={song.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark-surface/90 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-sm text-[10px] font-mono text-white font-semibold shadow">
                          Karaokê
                        </span>
                      </div>

                      {/* Título embaixo completo, sem cortar */}
                      <div className="p-3.5 flex flex-col justify-between flex-1 gap-2.5">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white leading-snug break-words whitespace-normal">
                            {song.title}
                          </h4>
                          <p className="text-xs text-brand-purple-light font-medium break-words">
                            {song.channelTitle}
                          </p>
                        </div>

                        <button
                          onClick={() => handleAddSongToQueue(song.title, song.channelTitle, song.id)}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-neon-purple/40 hover:scale-[1.01] active:scale-[0.98] transition-all"
                        >
                          <Plus className="w-4 h-4" /> Cantar essa no Palco!
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guia de Busca Rápida no YouTube */}
            {searchResults.length === 0 && !isSearching && (
              <div className="rounded-2xl border border-dark-border bg-dark-surface/70 p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 text-brand-purple-light flex items-center justify-center mx-auto text-2xl shadow-neon-purple/20">
                  🔍
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">Pesquise Qualquer Música</h4>
                  <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                    Digite o título da canção ou artista no campo de busca para encontrar vídeos de karaokê no YouTube.
                  </p>
                </div>

                <div className="pt-1">
                  <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Buscar por Estilo Musical:
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      'Sertanejo',
                      'Rock Nacional',
                      'Pop',
                      'Pagode',
                      'MPB',
                      'Anos 80',
                      'Internacional',
                      'Gospel',
                    ].map((genre) => (
                      <button
                        key={genre}
                        onClick={() => setSearchQuery(`${genre} Karaokê`)}
                        className="px-2.5 py-1 rounded-lg bg-dark-elevated border border-dark-border hover:border-brand-purple/60 hover:text-brand-purple-light text-[11px] text-text-secondary transition-all"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>

                {!hasApiKey && (
                  <div className="pt-2 border-t border-dark-border/60">
                    <button
                      onClick={() => {
                        setTempApiKey(getYouTubeApiKey());
                        setShowKeyModal(true);
                      }}
                      className="text-xs text-brand-purple-light hover:underline inline-flex items-center gap-1.5 font-semibold"
                    >
                      <Key className="w-3.5 h-3.5" /> Configurar Chave YouTube API
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RANKING & PÓDIO (CLASSIFICAÇÃO EM TEMPO REAL) */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <h3 className="font-display font-black text-xl text-white flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" /> Hall da Fama da Festa
              </h3>
              <p className="text-xs text-text-muted">Classificação das melhores cantorias da noite!</p>
            </div>

            {rankings.length === 0 ? (
              /* Empty State para Ranking Vazio */
              <div className="p-8 rounded-2xl border border-dashed border-dark-border bg-dark-surface/50 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-2xl mx-auto shadow-neon-gold/10">
                  🏆
                </div>
                <h4 className="font-display font-bold text-sm text-white">Nenhum show avaliado ainda</h4>
                <p className="text-xs text-text-muted max-w-xs mx-auto">
                  As notas dos convidados aparecerão aqui após as apresentações! Cante e receba até 5 estrelas da galera.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple transition-all"
                  >
                    Cantar Agora 🎤
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Top 3 Podium Cards */}
                {rankings.slice(0, 3).map((item) => {
                  const isFirst = item.pos === 1;
                  const isSecond = item.pos === 2;
                  const isMe = item.name.toLowerCase().includes(nickname.toLowerCase());

                  return (
                    <div
                      key={`${item.pos}_${item.name}`}
                      className={`relative overflow-hidden p-4 rounded-2xl border transition-all ${
                        isFirst
                          ? 'bg-gradient-to-r from-brand-gold/20 via-dark-surface to-dark-surface border-brand-gold/60 shadow-neon-gold'
                          : isSecond
                          ? 'bg-gradient-to-r from-slate-300/15 via-dark-surface to-dark-surface border-slate-300/40 shadow-sm'
                          : 'bg-gradient-to-r from-amber-700/15 via-dark-surface to-dark-surface border-amber-700/40 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                              isFirst
                                ? 'bg-brand-gold text-dark-base shadow-neon-gold'
                                : isSecond
                                ? 'bg-slate-300 text-dark-base'
                                : 'bg-amber-700 text-white'
                            }`}
                          >
                            {isFirst ? '🥇' : isSecond ? '🥈' : '🥉'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-display font-black text-sm text-white truncate">
                                {item.name}
                              </h4>
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded-full bg-brand-purple/30 text-brand-purple-light text-[10px] font-bold border border-brand-purple/40">
                                  Você
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-text-secondary truncate">
                              {item.song ? `🎵 "${item.song}"` : 'Apresentação no Palco'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-1 text-sm font-black text-brand-gold">
                            <span>{item.stars}</span>
                            <span>★</span>
                          </div>
                          <span className="text-[10px] text-text-muted font-medium block">
                            {item.points} pts ({item.totalVotes} {item.totalVotes === 1 ? 'voto' : 'votos'})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Posições 4 em diante */}
                {rankings.slice(3).map((item) => {
                  const isMe = item.name.toLowerCase().includes(nickname.toLowerCase());
                  return (
                    <div
                      key={`${item.pos}_${item.name}`}
                      className="flex items-center justify-between p-3 rounded-xl border border-dark-border bg-dark-surface hover:border-brand-purple/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 text-xs font-black text-text-muted">#{item.pos}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-text-primary truncate">{item.name}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.2 rounded-full bg-brand-purple/20 text-brand-purple-light text-[9px] font-bold">
                                Você
                              </span>
                            )}
                          </div>
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
                  );
                })}

                <div className="pt-2 text-center">
                  <button
                    onClick={() => setActiveTab('search')}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-purple/20 to-brand-pink/20 hover:from-brand-purple/30 hover:to-brand-pink/30 border border-brand-purple/40 text-brand-purple-light font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Cantar e Subir no Ranking!
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* REAÇÕES FLUTUANTES (Partículas animadas locais) */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-brand-gold/40 bg-dark-surface p-6 text-center shadow-neon-gold space-y-4 relative">
            <button
              onClick={() => setShowVotingModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {isUserSinging ? (
              /* CENÁRIO 1: O PARTICIPANTE ESTÁ CANTANDO (AUTO-AVALIAÇÃO BLOQUEADA) */
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-purple to-brand-pink text-white flex items-center justify-center mx-auto text-3xl shadow-neon-purple animate-bounce">
                  🎤
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 text-brand-purple-light text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-brand-pink" /> Você no Palco!
                  </span>
                  <h3 className="font-display font-black text-xl text-white">
                    Show de {activeSinger || 'Você'}!
                  </h3>
                  <p className="text-xs text-text-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">
                    Você não pode avaliar a sua própria apresentação. Relaxe e aguarde as notas da galera no Telão! ✨
                  </p>
                </div>

                {/* Barra e Contador de Contagem Regressiva (10s) */}
                {countdownState?.active && (
                  <div className="w-full space-y-1.5 p-3 rounded-xl bg-dark-base/80 border border-brand-purple/40 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-bold text-brand-purple-light">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> A galera está votando:
                      </span>
                      <span className="font-mono text-sm px-2 py-0.5 rounded bg-brand-purple/20 text-brand-purple-light border border-brand-purple/50 shadow-neon-purple">
                        {countdownState.secondsRemaining}s
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-dark-base rounded-full overflow-hidden border border-brand-purple/30">
                      <div
                        className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan-light transition-all duration-1000 ease-linear shadow-neon-purple"
                        style={{ width: `${Math.max(0, Math.min(100, (countdownState.secondsRemaining / 10) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowVotingModal(false)}
                  className="w-full py-2.5 rounded-xl border border-dark-border bg-dark-elevated text-xs font-bold text-text-secondary hover:text-white transition-all"
                >
                  Fechar e Assistir ao Telão
                </button>
              </div>
            ) : hasAlreadyVoted ? (
              /* CENÁRIO 2: O PARTICIPANTE JÁ AVALIOU ESTA MÚSICA (1 VOTO POR MÚSICA) */
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-status-success/20 text-status-success border border-status-success/40 flex items-center justify-center mx-auto text-3xl shadow-neon-purple">
                  <CheckCircle2 className="w-8 h-8 text-status-success" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success/20 text-status-success text-xs font-bold uppercase tracking-wider mb-2">
                    Voto Registrado
                  </span>
                  <h3 className="font-display font-black text-xl text-white">
                    Você já avaliou este show!
                  </h3>
                  <p className="text-xs text-text-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">
                    Cada participante pode enviar somente <strong className="text-white">1 avaliação por música</strong>. Seu voto já foi somado ao Ranking da Festa!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-dark-base/80 border border-brand-gold/40 flex items-center justify-center gap-2 shadow-neon-gold/15">
                  <span className="text-xs text-text-secondary font-medium">Sua nota para {activeSinger}:</span>
                  <span className="text-brand-gold font-display font-black text-lg flex items-center gap-1">
                    {userRatingForActiveSong} ★
                  </span>
                </div>

                {countdownState?.active && (
                  <div className="w-full space-y-1.5 p-3 rounded-xl bg-dark-base/80 border border-brand-gold/40 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-bold text-brand-gold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Tempo restante de votação:
                      </span>
                      <span className="font-mono text-sm px-2 py-0.5 rounded bg-brand-gold/20 text-brand-gold border border-brand-gold/50 shadow-neon-gold">
                        {countdownState.secondsRemaining}s
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-dark-base rounded-full overflow-hidden border border-brand-gold/30">
                      <div
                        className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold transition-all duration-1000 ease-linear shadow-neon-gold"
                        style={{ width: `${Math.max(0, Math.min(100, (countdownState.secondsRemaining / 10) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowVotingModal(false)}
                  className="w-full py-2.5 rounded-xl border border-dark-border bg-dark-elevated text-xs font-bold text-text-secondary hover:text-white transition-all"
                >
                  OK, Entendido
                </button>
              </div>
            ) : (
              /* CENÁRIO 3: PARTICIPANTE APTO A VOTAR */
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Hora da Nota!
                </div>

                <div>
                  <h3 className="font-display font-black text-xl text-white">
                    Como foi o show de {activeSinger}?
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    "{activeTitle || 'Show no Palco'}"
                  </p>
                </div>

                {/* Estrelas */}
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

                {/* Barra e Contador de Contagem Regressiva (10s) */}
                {countdownState?.active && (
                  <div className="w-full space-y-1.5 p-3 rounded-xl bg-dark-base/80 border border-brand-gold/40 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-bold text-brand-gold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Tempo para avaliar:
                      </span>
                      <span className="font-mono text-sm px-2 py-0.5 rounded bg-brand-gold/20 text-brand-gold border border-brand-gold/50 shadow-neon-gold">
                        {countdownState.secondsRemaining}s
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-dark-base rounded-full overflow-hidden border border-brand-gold/30">
                      <div
                        className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold transition-all duration-1000 ease-linear shadow-neon-gold"
                        style={{ width: `${Math.max(0, Math.min(100, (countdownState.secondsRemaining / 10) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  disabled={!selectedRating}
                  onClick={async () => {
                    if (selectedRating && serviceRef.current) {
                      const res = await serviceRef.current.submitRating(
                        selectedRating,
                        activeTitle,
                        activeSinger,
                        activeSongId,
                        activeDuet
                      );
                      if (res.success) {
                        const updated = {
                          ...votedPerformances,
                          [activePerformanceKey]: selectedRating,
                        };
                        setVotedPerformances(updated);
                        try {
                          confetti({
                            particleCount: 50,
                            spread: 60,
                            origin: { y: 0.6 },
                          });
                        } catch {
                          // ignore
                        }
                        showToast(`Voto de ${selectedRating} estrelas computado no Ranking! 🌟`);
                        setShowVotingModal(false);
                        setSelectedRating(null);
                      } else {
                        showToast(res.message || 'Não foi possível registrar o voto.');
                      }
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-gold to-brand-pink font-bold text-dark-base text-sm shadow-neon-gold disabled:opacity-50 transition-all hover:scale-[1.02]"
                >
                  Confirmar Meu Voto
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST FLUTUANTE DE NOTIFICAÇÃO */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-dark-surface/95 backdrop-blur-md border border-brand-purple/50 text-white text-xs font-bold shadow-neon-purple animate-fadeIn flex items-center gap-2 max-w-[90vw] text-center">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO DIRETA DE API KEY NO CELULAR */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-brand-purple/40 bg-dark-surface p-6 shadow-glass relative text-left space-y-4">
            <button
              onClick={() => setShowKeyModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-purple/20 text-brand-purple-light border border-brand-purple/30">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-white">Chave YouTube Data API v3</h3>
                <p className="text-[11px] text-text-muted">Ativação instantânea de busca</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Cole sua chave da <strong>YouTube Data API v3</strong> abaixo para ativar a pesquisa de músicas em tempo real neste dispositivo:
            </p>

            <form onSubmit={handleSaveUserKey} className="space-y-3">
              <input
                type="text"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-xl border border-dark-border bg-dark-base px-3.5 py-2.5 text-xs text-white placeholder:text-text-muted focus:border-brand-purple focus:outline-none"
                required
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar Chave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
