import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Mic,
  Flame,
  QrCode,
  ArrowLeft,
  ExternalLink,
  Star,
  RefreshCw,
  AlertTriangle,
  Cast,
  CheckCircle2,
  Trophy,
} from 'lucide-react';
import {
  YOUTUBE_PREMIUM_LOGIN_URL,
  getYouTubeThumbnail,
  searchYouTubeKaraoke,
} from '../lib/youtube';
import {
  RoomRealtimeService,
  type PlaybackCommandPayload,
  type VotingCountdownPayload,
  type RankingItemSync,
} from '../services/roomRealtimeService';
import {
  youtubeBridgeService,
  type BridgeState,
} from '../services/youtubeBridgeService';

interface FloatingReaction {
  id: number;
  emoji: string;
  xOffset: number;
}

interface CurrentTvSong {
  id?: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  singer: string;
  duet?: string;
  nextSinger?: string;
  nextSong?: string;
  nextVideoId?: string;
}

export const TvModePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [currentSong, setCurrentSong] = useState<CurrentTvSong | null>(null);
  const [countdownState, setCountdownState] = useState<{
    active: boolean;
    secondsRemaining: number;
    singer: string;
    song: string;
    nextSinger?: string;
    nextSong?: string;
    nextVideoId?: string;
  } | null>(null);
  const [videoError, setVideoError] = useState<{
    isBlocked: boolean;
    code?: number | string;
  } | null>(null);
  const [isSearchingAlt, setIsSearchingAlt] = useState(false);
  const [bridgeState, setBridgeState] = useState<BridgeState>(youtubeBridgeService.getState());
  const [rankings, setRankings] = useState<RankingItemSync[]>(() => {
    try {
      const saved = localStorage.getItem(`karaoke_rankings_${(code || 'FESTA1').toUpperCase()}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const roomCode = (code || 'FESTA1').toUpperCase();
  const joinUrl = `${window.location.origin}/room/${roomCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    joinUrl
  )}&color=ffffff&bgcolor=090a10`;

  const serviceRef = useRef<RoomRealtimeService | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSongRef = useRef<CurrentTvSong | null>(null);
  const endedSongIdRef = useRef<string | null>(null);

  // Escuta status e eventos do Karaokê Bridge (extensão Chrome)
  useEffect(() => {
    const unsubState = youtubeBridgeService.subscribe((state) => {
      setBridgeState(state);
    });

    const unsubEnded = youtubeBridgeService.onVideoEnded((payload) => {
      console.log('[TvModePage] Fim de reprodução reportado pela Karaokê Bridge:', payload);
      handleVideoEnded();
    });

    return () => {
      unsubState();
      unsubEnded();
    };
  }, []);

  // Calcula coordenadas exatas da área do player na tela/projetor para posicionamento do popup
  const getStageBounds = () => {
    if (!stageContainerRef.current) return undefined;
    const rect = stageContainerRef.current.getBoundingClientRect();
    return {
      left: Math.round(window.screenX + rect.left),
      top: Math.round(window.screenY + rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };

  // Abre a música bloqueada na janela do YouTube Premium via Karaokê Bridge
  const handleOpenViaBridge = () => {
    if (!currentSong?.youtubeVideoId) return;
    const bounds = getStageBounds();
    youtubeBridgeService.openExternalVideo({
      videoId: currentSong.youtubeVideoId,
      title: currentSong.title,
      singer: currentSong.singer,
      sessionId: roomCode,
      performanceId: currentSong.id || currentSong.youtubeVideoId,
      bounds,
    });
    setVideoError(null);
  };

  // Fecha a janela externa da Bridge se necessário
  const handleCloseBridge = () => {
    youtubeBridgeService.closeExternalVideo();
  };

  // Manter ref sincronizada para uso dentro de timers e listeners
  useEffect(() => {
    currentSongRef.current = currentSong;
    setVideoError(null);
    setIsSearchingAlt(false);
    // Se a música mudou, resetar o lock de encerramento da música anterior
    if (currentSong?.id && endedSongIdRef.current !== currentSong.id) {
      endedSongIdRef.current = null;
    }
  }, [currentSong]);

  // Busca e troca por versão de karaokê compatível quando a gravadora bloqueia o vídeo
  const handleReplaceWithCompatible = async () => {
    if (!currentSong) return;
    setIsSearchingAlt(true);
    try {
      const res = await searchYouTubeKaraoke(currentSong.title);
      const alternative = res.items.find((item) => item.id !== currentSong.youtubeVideoId);
      if (alternative) {
        const updatedSong: CurrentTvSong = {
          ...currentSong,
          youtubeVideoId: alternative.id,
          title: alternative.title,
        };
        setCurrentSong(updatedSong);
        setVideoError(null);
        serviceRef.current?.setCurrentSong({
          id: currentSong.id || String(Date.now()),
          title: alternative.title,
          artist: alternative.channelTitle,
          singer: currentSong.singer,
          duet: currentSong.duet,
          duration: '04:00',
          youtubeVideoId: alternative.id,
        });
      } else {
        // Se não encontrar alternativa liberada, abre direto no site do YouTube
        window.open(
          `https://www.youtube.com/watch?v=${currentSong.youtubeVideoId}&autoplay=1`,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } catch (err) {
      console.warn('Erro ao buscar alternativa compatível:', err);
    } finally {
      setIsSearchingAlt(false);
    }
  };

  // Enviar comando para o iframe do YouTube via postMessage
  const sendIframeCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*'
      );
    }
  };

  // Envia handshake para ativar o envio de eventos pelo YouTube IFrame
  const sendIframeHandshake = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
          '*'
        );
      } catch {
        // ignore
      }
    }
  };

  // Ciclo pós-show: 10 segundos de avaliação com barra de progresso e avanço automático
  const handleVideoEnded = () => {
    const activeSong = currentSongRef.current;
    if (!activeSong) return;

    // Evita duplo disparo para a mesma música
    if (activeSong.id && endedSongIdRef.current === activeSong.id) return;
    if (activeSong.id) {
      endedSongIdRef.current = activeSong.id;
    }

    // Fecha janela externa do Karaokê Bridge se estiver ativa
    if (youtubeBridgeService.isPlayingExternally()) {
      youtubeBridgeService.closeExternalVideo();
    }

    // Cancela contagem anterior se houver
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    let remaining = 10;
    const countdownData = {
      active: true,
      secondsRemaining: remaining,
      singer: activeSong.singer,
      song: activeSong.title,
      nextSinger: activeSong.nextSinger,
      nextSong: activeSong.nextSong,
      nextVideoId: activeSong.nextVideoId,
    };

    setCountdownState(countdownData);

    // Notifica todos na sala (Celulares e Organizador) para abrir avaliação
    serviceRef.current?.sendVotingCountdown({
      active: true,
      secondsRemaining: remaining,
      songTitle: activeSong.title,
      singerName: activeSong.singer,
      songId: activeSong.id,
      duetName: activeSong.duet,
      nextSongTitle: activeSong.nextSong,
      nextSingerName: activeSong.nextSinger,
    });
    serviceRef.current?.toggleVoting(true);

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        setCountdownState(null);
        serviceRef.current?.sendVotingCountdown({
          active: false,
          secondsRemaining: 0,
          songTitle: '',
          singerName: '',
        });
        serviceRef.current?.toggleVoting(false);

        // Avança automaticamente para a próxima música da fila
        serviceRef.current?.advanceToNextSong();
      } else {
        setCountdownState((prev) => (prev ? { ...prev, secondsRemaining: remaining } : null));
        serviceRef.current?.sendVotingCountdown({
          active: true,
          secondsRemaining: remaining,
          songTitle: activeSong.title,
          singerName: activeSong.singer,
          songId: activeSong.id,
          duetName: activeSong.duet,
          nextSongTitle: activeSong.nextSong,
          nextSingerName: activeSong.nextSinger,
        });
      }
    }, 1000);
  };

  // Listener de eventos do YouTube Player via postMessage (onStateChange e infoDelivery)
  useEffect(() => {
    // Envia handshake a cada 2.5s para garantir recepção de mensagens do YouTube
    const handshakeInterval = setInterval(() => {
      sendIframeHandshake();
    }, 2500);

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;

        // 1. YouTube onStateChange com info = 0 (ENDED) ou infoDelivery com playerState = 0
        const isEndedByState =
          (data.event === 'onStateChange' && (data.info === 0 || data.info === '0')) ||
          (data.event === 'infoDelivery' && data.info?.playerState === 0);

        // 2. YouTube infoDelivery com currentTime próximo da duração total
        const isNearEnd =
          data.event === 'infoDelivery' &&
          typeof data.info?.currentTime === 'number' &&
          typeof data.info?.duration === 'number' &&
          data.info.duration > 8 &&
          data.info.currentTime >= data.info.duration - 1.2;

        if (isEndedByState || isNearEnd) {
          handleVideoEnded();
        }

        // 3. YouTube onError: 101 ou 150 (vídeo desativado para incorporação em outros sites)
        const isEmbedBlocked =
          (data.event === 'onError' &&
            (data.info === 150 ||
              data.info === 101 ||
              data.info === '150' ||
              data.info === '101' ||
              data.info === 100)) ||
          (data.event === 'infoDelivery' &&
            (data.info?.errorCode === 150 ||
              data.info?.errorCode === 101 ||
              data.info?.error === 150 ||
              data.info?.error === 101));

        if (isEmbedBlocked) {
          setVideoError({
            isBlocked: true,
            code: data.info || data.info?.errorCode || 150,
          });
        }
      } catch {
        // Ignora mensagens de outros iframes/extensões
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(handshakeInterval);
      window.removeEventListener('message', handleMessage);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

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
            const first = syncedQueue[0];
            const next = syncedQueue[1];
            setCurrentSong({
              id: first.id,
              youtubeVideoId: first.youtubeVideoId || '',
              title: first.title,
              artist: first.artist,
              singer: first.singer,
              duet: first.duet || undefined,
              nextSinger: next?.singer,
              nextSong: next?.title,
              nextVideoId: next?.youtubeVideoId,
            });
          } else {
            setCurrentSong(null);
          }
        },
        onCurrentSongChange: (song) => {
          if (song) {
            setCurrentSong((prev) => ({
              id: song.id,
              youtubeVideoId: song.youtubeVideoId || '',
              title: song.title,
              artist: song.artist,
              singer: song.singer,
              duet: song.duet || undefined,
              nextSinger: prev?.nextSinger,
              nextSong: prev?.nextSong,
              nextVideoId: prev?.nextVideoId,
            }));
          } else {
            setCurrentSong(null);
          }
        },
        onVotingChange: (isOpen) => {
          setIsVoting(isOpen);
        },
        onVotingCountdown: (countdown: VotingCountdownPayload) => {
          if (countdown.active) {
            setCountdownState({
              active: true,
              secondsRemaining: countdown.secondsRemaining,
              singer: countdown.singerName,
              song: countdown.songTitle,
              nextSinger: countdown.nextSingerName,
              nextSong: countdown.nextSongTitle,
            });
          } else {
            setCountdownState(null);
          }
        },
        onPlaybackCommand: (command: PlaybackCommandPayload) => {
          if (command.action === 'play') {
            sendIframeCommand('playVideo');
          } else if (command.action === 'pause') {
            sendIframeCommand('pauseVideo');
          } else if (command.action === 'restart') {
            sendIframeCommand('seekTo', [0, true]);
            sendIframeCommand('playVideo');
          } else if (command.action === 'skip') {
            handleVideoEnded();
          }
        },
        onReaction: (reaction) => {
          setReactions((prev) => [...prev.slice(-20), reaction]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 2500);
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
  }, [roomCode]);

  // Localiza a pontuação / nota atual do cantor no ranking em tempo real
  const currentSingerRanking = currentSong
    ? rankings.find(
        (r) => r.name.trim().toLowerCase() === currentSong.singer.trim().toLowerCase()
      )
    : null;

  return (
    <div className="relative w-screen h-screen bg-black text-text-primary overflow-hidden select-none">
      {/* Background Neon Spotlights */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-brand-purple/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-brand-pink/20 rounded-full blur-[160px] pointer-events-none" />

      {currentSong ? (
        /* MODO TELÃO FULLSCREEN: PLAYER OCUPANDO TODA A TELA COM HUD VERTICAL SOBREPOSTO */
        <div ref={stageContainerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
          {bridgeState.isExternalPlaying ? (
            /* TELÃO DEDICADO QUANDO REPRODUZINDO VIA KARAOKÊ BRIDGE */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 md:p-12 text-center bg-gradient-to-b from-dark-base via-dark-surface to-dark-base overflow-hidden">
              <div className="absolute w-[450px] h-[450px] bg-brand-purple/20 rounded-full blur-[130px] pointer-events-none animate-pulse-slow" />
              <div className="absolute w-[350px] h-[350px] bg-red-600/15 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative z-10 max-w-2xl flex flex-col items-center space-y-5 animate-fade-in pr-0 md:pr-80">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-brand-purple/25 text-brand-purple-light border border-brand-purple/40 text-xs font-bold uppercase tracking-widest shadow-neon-purple">
                  <Cast className="w-4 h-4 text-brand-pink animate-pulse" />
                  <span>Reprodução via Karaokê Bridge (YouTube Premium)</span>
                </div>

                <div className="space-y-2">
                  <h2 className="font-display font-black text-3xl md:text-5xl text-white tracking-tight">
                    {currentSong.title}
                  </h2>
                  <p className="text-base md:text-xl font-bold bg-gradient-to-r from-brand-purple-light via-brand-pink to-brand-cyan-light bg-clip-text text-transparent">
                    Cantor(a): {currentSong.singer} {currentSong.duet && `+ ${currentSong.duet}`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-dark-base/85 border border-dark-border/80 backdrop-blur-md max-w-lg space-y-2 shadow-glass text-xs md:text-sm text-text-secondary leading-relaxed">
                  <p className="flex items-center justify-center gap-2 font-semibold text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-ping" />
                    Janela Oficial do YouTube Ativa sobre o Telão
                  </p>
                  <p className="text-text-muted text-xs">
                    Tocando sem anúncios via conta Premium. Ao término da apresentação, a janela fecha e a votação abre automaticamente!
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCloseBridge}
                    className="px-4 py-2 rounded-xl border border-dark-border bg-dark-surface hover:bg-dark-elevated text-text-secondary hover:text-white text-xs font-bold transition-all"
                  >
                    Fechar Janela Externa
                  </button>
                  <button
                    onClick={() => {
                      handleCloseBridge();
                      handleVideoEnded();
                    }}
                    className="px-4 py-2 rounded-xl bg-status-danger/20 border border-status-danger/40 text-status-danger hover:bg-status-danger/30 text-xs font-bold transition-all"
                  >
                    Finalizar e Abrir Avaliação ⏭
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <iframe
              key={currentSong.youtubeVideoId}
              ref={iframeRef}
              id="tv-youtube-iframe"
              onLoad={sendIframeHandshake}
              className="w-full h-full object-cover"
              src={`https://www.youtube.com/embed/${currentSong.youtubeVideoId}?autoplay=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(
                typeof window !== 'undefined' ? window.location.origin : ''
              )}`}
              title="YouTube Player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {/* CONTROLES DISCRETOS FLUTUANTES NO CANTO SUPERIOR ESQUERDO */}
          <div className="absolute top-3 md:top-5 left-3 md:left-5 z-20 flex items-center gap-2 pointer-events-auto">
            <Link
              to="/"
              className="p-2.5 rounded-xl bg-dark-base/85 hover:bg-dark-surface border border-dark-border/80 text-text-muted hover:text-white backdrop-blur-md transition-all shadow-glass"
              title="Sair do Modo TV"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {bridgeState.isExternalPlaying ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-purple/60 bg-dark-base/85 text-brand-purple-light backdrop-blur-md text-xs font-bold shadow-neon-purple animate-pulse">
                <Cast className="w-3.5 h-3.5 text-brand-pink" />
                <span>Bridge Ativa</span>
              </div>
            ) : bridgeState.status !== 'not_installed' ? (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-status-success/40 bg-dark-base/85 text-status-success backdrop-blur-md text-xs font-bold shadow-glass"
                title="Extensão Karaokê Bridge instalada e pronta"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bridge Pronta</span>
              </div>
            ) : null}

            <button
              onClick={() => {
                if (currentSong?.youtubeVideoId) {
                  window.open(
                    `https://www.youtube.com/watch?v=${currentSong.youtubeVideoId}&autoplay=1`,
                    '_blank',
                    'noopener,noreferrer'
                  );
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 bg-dark-base/85 hover:bg-red-500/20 text-red-400 backdrop-blur-md transition-all text-xs font-bold shadow-glass"
              title="Abrir diretamente no site oficial do YouTube em tela cheia"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Assistir no YouTube</span>
            </button>
          </div>

          {/* PAINEL VERTICAL SOBREPOSTO ALINHADO À DIREITA (HUD DO TELÃO) */}
          <aside className="absolute right-3 md:right-5 top-3 md:top-5 bottom-3 md:bottom-5 w-72 md:w-80 flex flex-col justify-between z-20 pointer-events-none gap-2.5">
            {/* 1. TOPO: QR CODE & CÓDIGO DA SALA */}
            <div className="pointer-events-auto rounded-2xl border border-brand-purple/40 bg-dark-base/85 backdrop-blur-xl p-3 md:p-3.5 shadow-glass flex flex-col items-center text-center gap-2.5">
              <div className="flex items-center justify-between w-full border-b border-dark-border/60 pb-1.5 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple-light flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-brand-cyan-light" /> Entrar na Sala
                </span>
                <span className="text-[10px] text-text-muted">Aponte a câmera</span>
              </div>

              {/* QR Code com borda e fundo branco nítido */}
              <div className="p-1.5 bg-white rounded-xl shadow-md border border-brand-purple/30">
                <img
                  src={qrCodeUrl}
                  alt={`QR Code da sala ${roomCode}`}
                  className="w-24 h-24 md:w-28 md:h-28 rounded-lg"
                />
              </div>

              {/* Código da Sala em Destaque Neon */}
              <div className="w-full py-1.5 px-3 rounded-xl bg-dark-surface/90 border border-brand-purple/50 flex items-center justify-between shadow-neon-purple/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">CÓDIGO:</span>
                <span className="font-display font-black text-lg md:text-xl tracking-[0.2em] text-white">
                  {roomCode}
                </span>
              </div>
            </div>

            {/* 2. CENTRO: QUEM ESTÁ CANTANDO + NOTA ATUAL DA PESSOA */}
            <div className="pointer-events-auto rounded-2xl border border-brand-pink/40 bg-dark-base/85 backdrop-blur-xl p-3.5 md:p-4 shadow-glass flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-pink flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 animate-pulse" /> No Palco Agora
                </span>
                {isVoting ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold text-brand-gold text-[10px] font-bold animate-pulse shadow-neon-gold">
                    <Star className="w-3 h-3 fill-brand-gold" /> Votação Aberta
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-text-muted">
                    <Mic className="w-3 h-3 text-brand-purple-light animate-pulse" /> Ao Vivo
                  </span>
                )}
              </div>

              {/* Nome do Cantor(a) */}
              <div>
                <h3 className="font-display font-black text-lg md:text-xl text-white leading-tight truncate">
                  <span className="bg-gradient-to-r from-brand-purple-light to-brand-pink bg-clip-text text-transparent">
                    {currentSong.singer}
                  </span>
                  {currentSong.duet && (
                    <span className="text-text-muted font-normal text-xs block truncate mt-0.5">
                      + {currentSong.duet} (Dueto)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-text-secondary truncate mt-1">
                  🎵 {currentSong.title}
                </p>
              </div>

              {/* NOTA ATUAL DO CANTOR */}
              <div className="mt-1 p-2.5 rounded-xl bg-dark-surface/90 border border-brand-gold/40 flex items-center justify-between shadow-neon-gold/15">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-brand-gold fill-brand-gold" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Nota Atual:
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {currentSingerRanking && currentSingerRanking.totalVotes > 0 ? (
                    <>
                      <span className="font-display font-black text-base md:text-lg text-brand-gold">
                        {currentSingerRanking.stars} ★
                      </span>
                      <span className="text-[10px] text-text-muted">
                        ({currentSingerRanking.totalVotes} {currentSingerRanking.totalVotes === 1 ? 'voto' : 'votos'})
                      </span>
                      {currentSingerRanking.pos <= 3 && (
                        <span className="text-sm ml-0.5" title={`#${currentSingerRanking.pos} no Ranking da Festa`}>
                          {currentSingerRanking.pos === 1 ? '🥇' : currentSingerRanking.pos === 2 ? '🥈' : '🥉'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-brand-purple-light flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-brand-gold" /> Estreia no Palco
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. BASE: QUEM É O PRÓXIMO E QUAL É A MÚSICA */}
            <div className="pointer-events-auto rounded-2xl border border-brand-cyan/40 bg-dark-base/85 backdrop-blur-xl p-3 md:p-3.5 shadow-glass flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-cyan-light flex items-center gap-1">
                  ⏭ A Seguir
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-dark-surface border border-dark-border text-text-muted">
                  {currentSong.nextSinger ? '#2 na Fila' : '—'}
                </span>
              </div>

              {currentSong.nextSinger ? (
                <div className="flex items-center gap-2.5">
                  {currentSong.nextVideoId ? (
                    <img
                      src={getYouTubeThumbnail(currentSong.nextVideoId)}
                      alt={currentSong.nextSong || ''}
                      className="w-14 h-10 rounded-lg object-cover border border-dark-border shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-10 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4 text-text-muted" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-bold text-white truncate">
                      {currentSong.nextSinger}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">
                      "{currentSong.nextSong || 'Música a confirmar'}"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center">
                  <p className="text-xs text-text-muted italic">Palco livre • Seja o próximo a pedir!</p>
                </div>
              )}
            </div>
          </aside>

          {/* EMOJIS FLUTUANTES EM TEMPO REAL AO LADO DO HUD */}
          <div className="absolute right-80 md:right-88 bottom-4 top-4 w-32 pointer-events-none overflow-hidden z-20">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="reaction-particle text-5xl select-none"
                style={{ left: `${r.xOffset}px`, bottom: '20px' }}
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* OVERLAY DE VÍDEO COM RESTRIÇÃO DE INCORPORAÇÃO (ERRO 150/101) */}
          {videoError?.isBlocked && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-dark-base/95 backdrop-blur-xl p-6 md:p-10 text-center animate-fade-in space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-status-danger/20 border border-status-danger/40 flex items-center justify-center text-3xl shadow-neon-pink mb-1">
                <AlertTriangle className="w-8 h-8 text-status-danger" />
              </div>

              <div className="max-w-xl space-y-2">
                <span className="px-3 py-1 rounded-full bg-status-danger/20 text-status-danger border border-status-danger/30 text-xs font-bold uppercase tracking-wider">
                  Restrição do Proprietário do Vídeo (Erro 150/101)
                </span>
                <h3 className="font-display font-black text-2xl md:text-3xl text-white">
                  Reprodução Externa Bloqueada
                </h3>
                <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
                  A gravadora de <strong className="text-white">"{currentSong.title}"</strong> desativou a incorporação em outros sites.
                  {bridgeState.status !== 'not_installed' ? (
                    <span className="block mt-1 text-brand-purple-light font-medium">
                      ✨ Sua extensão <strong>Karaokê Bridge</strong> está conectada! Você pode abrir diretamente no YouTube Premium sobre este telão com sincronização total.
                    </span>
                  ) : (
                    ' Você pode abrir no YouTube oficial ou trocar por outra versão liberada.'
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full max-w-lg">
                {bridgeState.status !== 'not_installed' ? (
                  <button
                    onClick={handleOpenViaBridge}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan text-white font-bold text-xs flex items-center justify-center gap-2 shadow-neon-purple hover:scale-105 active:scale-95 transition-all"
                  >
                    <Cast className="w-4 h-4" />
                    <span>Abrir no Karaokê Bridge (Recomendado)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (currentSong?.youtubeVideoId) {
                        window.open(
                          `https://www.youtube.com/watch?v=${currentSong.youtubeVideoId}&autoplay=1`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                    }}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-brand-pink text-white font-bold text-xs flex items-center justify-center gap-2 shadow-neon-pink hover:scale-105 active:scale-95 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir no YouTube Agora</span>
                  </button>
                )}

                <button
                  disabled={isSearchingAlt}
                  onClick={handleReplaceWithCompatible}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-brand-purple/50 bg-brand-purple/20 text-brand-purple-light hover:bg-brand-purple/30 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSearchingAlt ? 'animate-spin' : ''}`} />
                  <span>{isSearchingAlt ? 'Buscando...' : 'Trocar por Versão Compatível'}</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => serviceRef.current?.advanceToNextSong()}
                  className="text-xs text-text-muted hover:text-white underline transition-colors"
                >
                  Pular para a próxima música da fila ⏭
                </button>
              </div>
            </div>
          )}

          {/* OVERLAY DE CONTAGEM REGRESSIVA PÓS-SHOW (10 SEGUNDOS COM BARRA DE PROGRESSO) */}
          {countdownState?.active && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl p-8 text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-sm font-bold uppercase tracking-widest shadow-neon-gold animate-bounce mb-4">
                <Star className="w-5 h-5 fill-brand-gold" /> Show Finalizado! Avaliem no Celular!
              </div>

              <h2 className="font-display font-black text-4xl md:text-6xl text-white mb-2">
                Como foi a cantoria de {countdownState.singer}?
              </h2>
              <p className="text-base md:text-xl text-brand-pink-light font-medium mb-6">
                Música: "{countdownState.song}"
              </p>

              {/* Grande Círculo de Contagem de Segundos */}
              <div className="w-24 h-24 rounded-full border-4 border-brand-gold flex items-center justify-center bg-dark-surface shadow-neon-gold mb-6 animate-pulse">
                <span className="font-display font-black text-4xl text-brand-gold">
                  {countdownState.secondsRemaining}s
                </span>
              </div>

              {/* BARRA DE PROGRESSO DE 10 SEGUNDOS */}
              <div className="w-full max-w-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-text-secondary uppercase tracking-wider">
                  <span>Tempo de Votação</span>
                  <span className="text-brand-gold font-mono">{countdownState.secondsRemaining} segundos restantes</span>
                </div>
                <div className="w-full h-4 bg-dark-base rounded-full overflow-hidden border border-brand-gold/40 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-gold transition-all duration-1000 ease-linear shadow-neon-gold"
                    style={{ width: `${(countdownState.secondsRemaining / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Ranking Parcial / Top 3 da Festa em Tempo Real */}
              {rankings.length > 0 && (
                <div className="mt-4 px-4 py-2.5 rounded-2xl bg-dark-surface/90 border border-brand-gold/40 flex items-center justify-center gap-3 text-xs max-w-lg w-full shadow-neon-gold/20">
                  <span className="font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Trophy className="w-3.5 h-3.5" /> Líderes:
                  </span>
                  <div className="flex items-center gap-3 overflow-hidden truncate">
                    {rankings.slice(0, 3).map((r) => (
                      <span key={r.pos} className="flex items-center gap-1 font-bold text-white shrink-0">
                        <span>{r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : '🥉'}</span>
                        <span>{r.name}</span>
                        <span className="text-brand-gold font-normal">({r.stars}★)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview da Próxima Música */}
              <div className="mt-5 p-4 rounded-2xl bg-dark-surface/90 border border-dark-border text-center max-w-lg w-full">
                <span className="text-xs font-bold uppercase text-brand-cyan-light tracking-wider block mb-2">
                  A Seguir:
                </span>
                <div className="flex items-center justify-center gap-3">
                  {countdownState.nextVideoId && (
                    <img
                      src={getYouTubeThumbnail(countdownState.nextVideoId)}
                      alt={countdownState.nextSong || ''}
                      className="w-16 h-11 object-cover rounded-lg border border-dark-border shrink-0 shadow-md"
                    />
                  )}
                  <div className="text-left">
                    <p className="text-base font-bold text-white">
                      {countdownState.nextSinger ? (
                        <>
                          <span className="text-brand-purple-light">{countdownState.nextSinger}</span>
                          <span className="text-xs text-text-secondary block">
                            "{countdownState.nextSong}"
                          </span>
                        </>
                      ) : (
                        'Palco Livre • Nenhum pedido na fila'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current);
                      countdownIntervalRef.current = null;
                    }
                    setCountdownState(null);
                    serviceRef.current?.sendVotingCountdown({
                      active: false,
                      secondsRemaining: 0,
                      songTitle: '',
                      singerName: '',
                    });
                    serviceRef.current?.toggleVoting(false);
                    serviceRef.current?.advanceToNextSong();
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white font-bold text-xs uppercase tracking-wider shadow-neon-purple hover:scale-105 active:scale-95 transition-all"
                >
                  Iniciar Próxima Música Agora ⏭
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TELA DE BOAS-VINDAS / PALCO LIBERADO (QUANDO A FILA ESTÁ VAZIA) */
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 md:p-6">
          {/* Top Bar da Tela de Boas-Vindas */}
          <header className="flex items-center justify-between border-b border-dark-border/40 pb-3">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-dark-surface transition-colors"
                title="Sair do Modo TV"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎤</span>
                <div>
                  <h1 className="font-display font-black text-xl tracking-tight bg-gradient-to-r from-brand-purple-light via-brand-pink to-brand-cyan-light bg-clip-text text-transparent">
                    Karaokê da Festa
                  </h1>
                  <p className="text-[10px] text-text-secondary tracking-widest uppercase font-semibold">
                    Modo Telão • Ao Vivo
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-dark-surface/90 border-2 border-brand-purple/60 shadow-neon-purple">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">CÓDIGO:</span>
                <span className="font-display font-black text-2xl md:text-3xl tracking-[0.25em] text-white">
                  {roomCode}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={YOUTUBE_PREMIUM_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-all text-xs font-bold"
                title="Conecte sua conta do YouTube Premium para tocar sem anúncios"
              >
                <span>👑</span>
                <span>YouTube Premium</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </header>

          {/* Conteúdo Central: Card de Boas-Vindas */}
          <main className="flex-1 my-3 flex items-center justify-center min-h-0 w-full">
            <div className="w-full max-w-3xl rounded-3xl border border-brand-purple/40 bg-dark-surface/90 backdrop-blur-2xl p-6 md:p-8 text-center shadow-glass flex flex-col items-center justify-center gap-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple/15 text-brand-purple-light border border-brand-purple/30 text-xs font-bold uppercase tracking-wider shadow-neon-purple/20">
                <Sparkles className="w-4 h-4" /> Telão da Festa • Sala Pronta
              </div>

              <div>
                <h2 className="font-display font-black text-3xl md:text-5xl text-white">
                  🎤 Palco Liberado!
                </h2>
                <p className="text-text-secondary text-sm md:text-base mt-2 max-w-lg mx-auto">
                  Aponte a câmera para o QR Code abaixo para entrar na sala e pedir sua música!
                </p>
              </div>

              {/* QR Code Grande e Centralizado com Efeito Glow */}
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-cyan rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition duration-700 animate-pulse-slow" />
                <div className="relative p-3.5 bg-dark-base rounded-2xl border-2 border-brand-purple/50 shadow-neon-purple">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code para a sala ${roomCode}`}
                    className="w-44 h-44 md:w-52 md:h-52 rounded-xl"
                  />
                </div>
              </div>

              {/* Top 3 Líderes do Karaokê no Telão */}
              {rankings.length > 0 && (
                <div className="w-full max-w-lg p-3 rounded-2xl bg-dark-base/80 border border-brand-gold/40 shadow-neon-gold/15">
                  <div className="flex items-center justify-between text-xs font-bold text-brand-gold uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" /> Hall da Fama da Festa
                    </span>
                    <span className="text-[10px] text-text-muted">Top 3 Cantorias</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {rankings.slice(0, 3).map((r) => (
                      <div
                        key={r.pos}
                        className="p-2 rounded-xl bg-dark-surface/90 border border-dark-border text-center flex flex-col items-center"
                      >
                        <span className="text-base mb-0.5">{r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : '🥉'}</span>
                        <p className="font-bold text-xs text-white truncate w-full">{r.name}</p>
                        <p className="text-[11px] font-bold text-brand-gold mt-0.5">{r.stars} ★</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passos rápidos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-dark-base/60 border border-dark-border">
                  <span className="font-bold text-brand-purple-light block text-sm mb-0.5">1. Leia o QR Code</span>
                  <span className="text-text-muted">com a câmera do seu smartphone</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-base/60 border border-dark-border">
                  <span className="font-bold text-brand-pink-light block text-sm mb-0.5">2. Escolha seu Apelido</span>
                  <span className="text-text-muted">solo ou chame um amigo para dueto</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-base/60 border border-dark-border">
                  <span className="font-bold text-brand-cyan-light block text-sm mb-0.5">3. Solte a Voz!</span>
                  <span className="text-text-muted">acompanhe a letra aqui na TV</span>
                </div>
              </div>
            </div>
          </main>

          {/* Rodapé da tela de boas-vindas */}
          <footer className="rounded-2xl border border-dark-border/80 bg-dark-surface/90 backdrop-blur-xl px-5 py-3 flex items-center justify-between text-xs text-text-muted">
            <span>Aponte o celular para o QR Code acima para adicionar músicas à fila.</span>
            <span>Karaokê da Festa • Telão Interativo</span>
          </footer>
        </div>
      )}
    </div>
  );
};
