/**
 * Serviço central de sincronização em tempo real (Supabase Realtime & PostgreSQL)
 * Conecta Celulares, Telão (TV) e Painel do Organizador via Presence, Broadcast e Persistência Resiliente.
 * 100% compatível com as regras e constraints de supabase/SCHEMA_COMPLETO.sql.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RoomParticipantSync {
  id: string;
  name: string;
  isOrganizer?: boolean;
  isSinging?: boolean;
  joined: string;
}

export interface QueueItemSync {
  id: string;
  title: string;
  artist: string;
  singer: string;
  duet?: string | null;
  duration: string;
  youtubeVideoId?: string;
  isPriority?: boolean;
  addedAt?: string;
}

export interface FloatingReactionSync {
  id: number;
  emoji: string;
  xOffset: number;
}

export interface PlaybackCommandPayload {
  action: 'play' | 'pause' | 'restart' | 'skip';
  timestamp: number;
}

export interface VotingCountdownPayload {
  active: boolean;
  secondsRemaining: number;
  songTitle: string;
  singerName: string;
  nextSongTitle?: string;
  nextSingerName?: string;
}

export interface RoomSyncCallbacks {
  onParticipantsChange?: (participants: RoomParticipantSync[]) => void;
  onQueueChange?: (queue: QueueItemSync[]) => void;
  onCurrentSongChange?: (song: QueueItemSync | null) => void;
  onVotingChange?: (votingOpen: boolean) => void;
  onReaction?: (reaction: FloatingReactionSync) => void;
  onRatingSubmit?: (rating: { singer: string; score: number }) => void;
  onPlaybackCommand?: (command: PlaybackCommandPayload) => void;
  onVotingCountdown?: (countdown: VotingCountdownPayload) => void;
}

export class RoomRealtimeService {
  private channel: RealtimeChannel | null = null;
  private roomCode: string;
  private currentUser: RoomParticipantSync;
  private callbacks: RoomSyncCallbacks;
  private currentQueue: QueueItemSync[] = [];
  private currentSong: QueueItemSync | null = null;
  private votingOpen: boolean = false;
  private roomId: string | null = null;
  private participantDbId: string | null = null;
  private sessionToken: string;

  constructor(
    roomCode: string,
    currentUser: RoomParticipantSync,
    callbacks: RoomSyncCallbacks = {}
  ) {
    this.roomCode = roomCode.toUpperCase();
    this.currentUser = currentUser;
    this.callbacks = callbacks;
    this.sessionToken = this.getOrCreateSessionToken();
  }

  /**
   * Garante um session_token UUID consistente no localStorage
   */
  private getOrCreateSessionToken(): string {
    const key = `karaoke_session_token_${this.roomCode}`;
    let token = localStorage.getItem(key) || localStorage.getItem('karaoke_session_token');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || !uuidRegex.test(token)) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        token = crypto.randomUUID();
      } else {
        token = '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
          (
            Number(c) ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
          ).toString(16)
        );
      }
      localStorage.setItem(key, token);
      localStorage.setItem('karaoke_session_token', token);
    }
    return token;
  }

  /**
   * Conecta à sala do Supabase Realtime e registra listeners
   */
  public async connect(): Promise<void> {
    // 1. Garantir sala e participante no PostgreSQL se o Supabase estiver configurado
    if (isSupabaseConfigured) {
      await this.ensureRoomAndParticipantInDatabase();
      await this.reloadQueueFromDatabase();
      await this.reloadParticipantsFromDatabase();
    }

    // 2. Canal Supabase Realtime (Presence, Broadcast e Postgres Changes)
    const channelName = `karaoke_room_${this.roomCode}`;
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: true },
        presence: { key: this.currentUser.id || this.sessionToken },
      },
    });

    // PRESENCE: Participantes conectados agora
    this.channel
      .on('presence', { event: 'sync' }, () => {
        if (!this.channel) return;
        const presenceState = this.channel.presenceState<RoomParticipantSync>();
        const participantList: RoomParticipantSync[] = [];

        Object.values(presenceState).forEach((presences) => {
          presences.forEach((p) => {
            if (p && p.name && !participantList.some((item) => item.name === p.name)) {
              participantList.push({
                id: p.id || p.name,
                name: p.name,
                isOrganizer: Boolean(p.isOrganizer),
                isSinging: Boolean(p.isSinging),
                joined: p.joined || 'Agora',
              });
            }
          });
        });

        if (this.callbacks.onParticipantsChange) {
          this.callbacks.onParticipantsChange(participantList);
        }
      })
      .on('presence', { event: 'join' }, () => {
        if (this.currentUser.isOrganizer || this.currentQueue.length > 0) {
          this.broadcastState();
        }
      });

    // BROADCAST: Fila de músicas, palco, votação e reações
    this.channel
      .on('broadcast', { event: 'queue_update' }, ({ payload }) => {
        if (Array.isArray(payload?.queue)) {
          this.currentQueue = payload.queue;
          this.callbacks.onQueueChange?.(this.currentQueue);
        }
      })
      .on('broadcast', { event: 'queue_add_item' }, ({ payload }) => {
        if (payload?.item) {
          const exists = this.currentQueue.some((q) => q.id === payload.item.id);
          if (!exists) {
            this.currentQueue = [...this.currentQueue, payload.item];
            this.callbacks.onQueueChange?.(this.currentQueue);
          }
        }
      })
      .on('broadcast', { event: 'stage_change' }, ({ payload }) => {
        this.currentSong = payload?.currentSong || null;
        this.callbacks.onCurrentSongChange?.(this.currentSong);
      })
      .on('broadcast', { event: 'voting_toggle' }, ({ payload }) => {
        this.votingOpen = Boolean(payload?.votingOpen);
        this.callbacks.onVotingChange?.(this.votingOpen);
      })
      .on('broadcast', { event: 'playback_command' }, ({ payload }) => {
        if (payload?.action && this.callbacks.onPlaybackCommand) {
          this.callbacks.onPlaybackCommand(payload);
        }
      })
      .on('broadcast', { event: 'voting_countdown' }, ({ payload }) => {
        if (payload && this.callbacks.onVotingCountdown) {
          this.callbacks.onVotingCountdown(payload);
        }
      })
      .on('broadcast', { event: 'rating_submit' }, ({ payload }) => {
        if (payload && this.callbacks.onRatingSubmit) {
          this.callbacks.onRatingSubmit({
            singer: payload.singer,
            score: payload.stars || payload.score,
          });
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (payload?.emoji && this.callbacks.onReaction) {
          this.callbacks.onReaction({
            id: Date.now() + Math.random(),
            emoji: payload.emoji,
            xOffset: payload.xOffset ?? Math.floor(Math.random() * 80),
          });
        }
      })
      .on('broadcast', { event: 'request_state' }, () => {
        if (this.currentUser.isOrganizer || this.currentQueue.length > 0 || this.currentSong) {
          this.broadcastState();
        }
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        if (payload) {
          if (Array.isArray(payload.queue) && payload.queue.length > 0) {
            this.currentQueue = payload.queue;
            this.callbacks.onQueueChange?.(this.currentQueue);
          }
          if (payload.currentSong !== undefined) {
            this.currentSong = payload.currentSong;
            this.callbacks.onCurrentSongChange?.(this.currentSong);
          }
          if (payload.votingOpen !== undefined) {
            this.votingOpen = payload.votingOpen;
            this.callbacks.onVotingChange?.(this.votingOpen);
          }
        }
      });

    // POSTGRES CHANGES: Sincronização automática do banco quando houver inserção/atualização
    if (this.roomId) {
      this.channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_items',
            filter: `room_id=eq.${this.roomId}`,
          },
          () => {
            this.reloadQueueFromDatabase();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participants',
            filter: `room_id=eq.${this.roomId}`,
          },
          () => {
            this.reloadParticipantsFromDatabase();
          }
        );
    }

    // Iniciar inscrição no canal
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.channel) {
        await this.channel.track({
          id: this.currentUser.id || this.sessionToken,
          name: this.currentUser.name,
          isOrganizer: Boolean(this.currentUser.isOrganizer),
          isSinging: Boolean(this.currentUser.isSinging),
          joined: this.currentUser.joined || 'Agora',
        });

        this.channel.send({
          type: 'broadcast',
          event: 'request_state',
          payload: { requesterId: this.currentUser.id },
        });

        this.fetchInitialStateFromLocalStorage();
      }
    });
  }

  /**
   * Assegura existência da sala e do participante no PostgreSQL
   */
  private async ensureRoomAndParticipantInDatabase(): Promise<void> {
    try {
      // 1. Localizar ou criar a sala
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id, code, name, status, voting_open')
        .eq('code', this.roomCode)
        .maybeSingle();

      if (existingRoom?.id) {
        this.roomId = existingRoom.id;
        this.votingOpen = Boolean(existingRoom.voting_open);
      } else {
        const { data: newRoom, error: createError } = await supabase
          .from('rooms')
          .insert({
            code: this.roomCode,
            name: `Sala ${this.roomCode}`,
            status: 'active',
          })
          .select('id, code, name, status')
          .maybeSingle();

        if (newRoom?.id) {
          this.roomId = newRoom.id;
        } else if (createError) {
          console.warn('[Realtime] Tentando buscar sala criada concorrentemente:', createError.message);
          const { data: retryRoom } = await supabase
            .from('rooms')
            .select('id, code')
            .eq('code', this.roomCode)
            .maybeSingle();
          if (retryRoom?.id) this.roomId = retryRoom.id;
        }
      }

      // 2. Registrar ou reconectar participante no banco
      if (this.roomId && this.currentUser.name && this.currentUser.name !== 'Telão TV') {
        const cleanNick = this.currentUser.name.trim();

        // Tentar via RPC `rpc_join_room` primeiro
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_join_room', {
            p_room_code: this.roomCode,
            p_nickname: cleanNick,
            p_session_token: this.sessionToken,
            p_avatar_url: null,
            p_is_organizer: Boolean(this.currentUser.isOrganizer),
          });

          if (!rpcErr && rpcRes?.participant?.id) {
            const partId = String(rpcRes.participant.id);
            this.participantDbId = partId;
            localStorage.setItem(`karaoke_participant_db_id_${this.roomCode}`, partId);
            return;
          }
        } catch {
          // Fallback para inserção direta
        }

        // Fallback: verificar se já existe participante por session_token
        const { data: existingPart } = await supabase
          .from('participants')
          .select('id, nickname')
          .eq('room_id', this.roomId)
          .eq('session_token', this.sessionToken)
          .maybeSingle();

        if (existingPart?.id) {
          this.participantDbId = existingPart.id;
          if (existingPart.nickname !== cleanNick) {
            await supabase
              .from('participants')
              .update({ nickname: cleanNick, last_active_at: new Date().toISOString() })
              .eq('id', existingPart.id);
          }
        } else {
          // Inserir novo participante com session_token
          const { data: insertedPart } = await supabase
            .from('participants')
            .insert({
              room_id: this.roomId,
              nickname: cleanNick,
              session_token: this.sessionToken,
              is_organizer: Boolean(this.currentUser.isOrganizer),
            })
            .select('id')
            .maybeSingle();

          if (insertedPart?.id) {
            this.participantDbId = insertedPart.id;
          }
        }

        if (this.participantDbId) {
          localStorage.setItem(`karaoke_participant_db_id_${this.roomCode}`, this.participantDbId);
        }
      }
    } catch (err) {
      console.warn('[Realtime] Erro na sincronização inicial com PostgreSQL:', err);
    }
  }

  /**
   * Recarrega a fila de músicas persistida no PostgreSQL
   */
  public async reloadQueueFromDatabase(): Promise<void> {
    if (!isSupabaseConfigured || !this.roomId) return;

    try {
      // Buscar itens da fila
      const { data: dbItems, error } = await supabase
        .from('queue_items')
        .select('id, youtube_video_id, title, channel_title, duration_seconds, singer_id, duet_singer_id, status, order_index, is_priority, created_at')
        .eq('room_id', this.roomId)
        .in('status', ['pending', 'current'])
        .order('is_priority', { ascending: false })
        .order('order_index', { ascending: true });

      if (error || !dbItems || dbItems.length === 0) {
        if (dbItems && dbItems.length === 0 && this.currentQueue.length > 0) {
          // Não limpa imediatamente se o broadcast tiver dados em memória local
          return;
        }
        return;
      }

      // Buscar nicknames dos participantes para resolver nomes dos cantores
      const { data: participants } = await supabase
        .from('participants')
        .select('id, nickname')
        .eq('room_id', this.roomId);

      const nickMap = new Map<string, string>();
      if (participants) {
        participants.forEach((p) => nickMap.set(p.id, p.nickname));
      }

      const formatted: QueueItemSync[] = dbItems.map((item) => {
        const singerNick = nickMap.get(item.singer_id) || 'Cantor da Festa';
        const duetNick = item.duet_singer_id ? nickMap.get(item.duet_singer_id) || null : null;
        return {
          id: item.id,
          title: item.title,
          artist: item.channel_title || 'Karaokê',
          singer: duetNick ? `${singerNick} & ${duetNick}` : singerNick,
          duet: duetNick,
          duration: item.duration_seconds
            ? `${Math.floor(item.duration_seconds / 60).toString().padStart(2, '0')}:${(item.duration_seconds % 60).toString().padStart(2, '0')}`
            : '04:00',
          youtubeVideoId: item.youtube_video_id,
          isPriority: Boolean(item.is_priority),
          addedAt: item.created_at,
        };
      });

      this.currentQueue = formatted;
      this.callbacks.onQueueChange?.(formatted);

      if (formatted.length > 0 && !this.currentSong) {
        this.currentSong = formatted[0];
        this.callbacks.onCurrentSongChange?.(formatted[0]);
      }
    } catch (err) {
      console.warn('[Realtime] Erro ao recarregar fila do banco:', err);
    }
  }

  /**
   * Recarrega a lista de participantes persistida no PostgreSQL
   */
  public async reloadParticipantsFromDatabase(): Promise<void> {
    if (!isSupabaseConfigured || !this.roomId) return;

    try {
      const { data: dbParts } = await supabase
        .from('participants')
        .select('id, nickname, is_organizer, joined_at')
        .eq('room_id', this.roomId)
        .order('joined_at', { ascending: true });

      if (dbParts && dbParts.length > 0) {
        const list: RoomParticipantSync[] = dbParts.map((p) => ({
          id: p.id,
          name: p.nickname,
          isOrganizer: Boolean(p.is_organizer),
          isSinging: false,
          joined: p.joined_at ? new Date(p.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora',
        }));

        this.callbacks.onParticipantsChange?.(list);
      }
    } catch (err) {
      console.warn('[Realtime] Erro ao recarregar participantes do banco:', err);
    }
  }

  /**
   * Adiciona música à fila com transmissão imediata e persistência
   */
  public async addSongToQueue(item: QueueItemSync): Promise<void> {
    const updated = [...this.currentQueue, item];
    this.currentQueue = updated;

    // Transmissão broadcast em tempo real para latência zero
    this.channel?.send({
      type: 'broadcast',
      event: 'queue_add_item',
      payload: { item },
    });

    this.callbacks.onQueueChange?.(updated);
    await this.persistQueueItem(item, updated.length);
  }

  /**
   * Atualiza a fila inteira (reordenação ou remoção)
   */
  public async updateQueue(newQueue: QueueItemSync[]): Promise<void> {
    this.currentQueue = newQueue;

    this.channel?.send({
      type: 'broadcast',
      event: 'queue_update',
      payload: { queue: newQueue },
    });

    this.callbacks.onQueueChange?.(newQueue);
    localStorage.setItem(`karaoke_queue_${this.roomCode}`, JSON.stringify(newQueue));
  }

  /**
   * Altera a música do palco
   */
  public setCurrentSong(song: QueueItemSync | null): void {
    this.currentSong = song;

    this.channel?.send({
      type: 'broadcast',
      event: 'stage_change',
      payload: { currentSong: song },
    });

    this.callbacks.onCurrentSongChange?.(song);
  }

  /**
   * Alterna a votação
   */
  public async toggleVoting(open: boolean): Promise<void> {
    this.votingOpen = open;

    this.channel?.send({
      type: 'broadcast',
      event: 'voting_toggle',
      payload: { votingOpen: open },
    });

    this.callbacks.onVotingChange?.(open);

    if (isSupabaseConfigured && this.roomId) {
      await supabase.from('rooms').update({ voting_open: open }).eq('id', this.roomId);
    }
  }

  /**
   * Envia comando de controle de reprodução (Play, Pause, Reiniciar, Pular) para todos os Telões TV
   */
  public sendPlaybackCommand(action: 'play' | 'pause' | 'restart' | 'skip'): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'playback_command',
      payload: { action, timestamp: Date.now() },
    });
  }

  /**
   * Envia status da contagem regressiva de avaliação para Telão, Organizador e Participantes
   */
  public sendVotingCountdown(payload: VotingCountdownPayload): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'voting_countdown',
      payload,
    });
    this.callbacks.onVotingCountdown?.(payload);
  }

  /**
   * Envia uma avaliação de performance (1 a 5 estrelas)
   */
  public async submitRating(stars: number): Promise<{ success: boolean; message?: string }> {
    const singer = this.currentSong?.singer || 'Cantor';

    // Broadcast imediato para animação nos outros dispositivos
    this.channel?.send({
      type: 'broadcast',
      event: 'rating_submit',
      payload: { singer, stars, participant: this.currentUser.name },
    });
    this.callbacks.onRatingSubmit?.({ singer, score: stars });

    if (isSupabaseConfigured && this.roomId && this.currentSong?.id) {
      try {
        const participantId =
          this.participantDbId ||
          localStorage.getItem(`karaoke_participant_db_id_${this.roomCode}`);
        if (participantId) {
          // Tentar RPC oficial primeiro
          const { error: rpcErr } = await supabase.rpc('rpc_submit_rating', {
            p_room_id: this.roomId,
            p_queue_item_id: this.currentSong.id,
            p_voter_participant_id: participantId,
            p_stars: stars,
          });

          if (!rpcErr) return { success: true };

          // Fallback para inserção direta se RPC falhar
          const { error: insertErr } = await supabase.from('ratings').insert({
            room_id: this.roomId,
            queue_item_id: this.currentSong.id,
            voter_participant_id: participantId,
            stars,
          });

          if (!insertErr) return { success: true };
          return { success: false, message: insertErr.message };
        }
      } catch (err: any) {
        console.warn('[Realtime] Erro ao salvar nota:', err);
        return { success: false, message: err?.message };
      }
    }

    return { success: true };
  }

  /**
   * Avança atomicamente para a próxima música da fila
   */
  public async advanceToNextSong(): Promise<QueueItemSync | null> {
    if (this.currentQueue.length === 0) {
      this.setCurrentSong(null);
      return null;
    }

    const finishedSong = this.currentQueue[0];
    const nextQueue = this.currentQueue.slice(1);
    this.currentQueue = nextQueue;
    const nextSong = nextQueue[0] || null;
    this.currentSong = nextSong;

    // Transmite via broadcast para latência zero em todos os dispositivos
    this.channel?.send({
      type: 'broadcast',
      event: 'queue_update',
      payload: { queue: nextQueue },
    });

    this.channel?.send({
      type: 'broadcast',
      event: 'stage_change',
      payload: { currentSong: nextSong },
    });

    this.callbacks.onQueueChange?.(nextQueue);
    this.callbacks.onCurrentSongChange?.(nextSong);
    localStorage.setItem(`karaoke_queue_${this.roomCode}`, JSON.stringify(nextQueue));

    // Atualiza persistência no PostgreSQL
    if (isSupabaseConfigured && this.roomId) {
      try {
        if (finishedSong?.id) {
          await supabase
            .from('queue_items')
            .update({ status: 'completed' })
            .eq('id', finishedSong.id);
        }
        await supabase
          .from('rooms')
          .update({
            current_queue_id: nextSong ? nextSong.id : null,
            voting_open: false,
          })
          .eq('id', this.roomId);
      } catch (err) {
        console.warn('[Realtime] Erro ao avançar música no banco:', err);
      }
    }

    return nextSong;
  }

  /**
   * Envia reação em tempo real
   */
  public sendReaction(emoji: string, xOffset?: number): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, xOffset },
    });
  }

  /**
   * Compartilha o estado com novos clientes
   */
  public broadcastState(): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'sync_state',
      payload: {
        queue: this.currentQueue,
        currentSong: this.currentSong,
        votingOpen: this.votingOpen,
      },
    });
  }

  /**
   * Desconecta o canal e remove presença
   */
  public disconnect(): void {
    if (this.channel) {
      this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Persiste um item individual de fila no PostgreSQL
   */
  private async persistQueueItem(item: QueueItemSync, position: number): Promise<void> {
    try {
      localStorage.setItem(`karaoke_queue_${this.roomCode}`, JSON.stringify(this.currentQueue));

      if (!isSupabaseConfigured) return;

      if (!this.roomId) {
        await this.ensureRoomAndParticipantInDatabase();
      }

      if (!this.roomId) return;

      // Garantir ID de participante para FK singer_id
      let singerId = this.participantDbId;
      if (!singerId) {
        singerId = localStorage.getItem(`karaoke_participant_db_id_${this.roomCode}`);
      }

      if (!singerId) {
        // Obter ou criar participante temporário
        const { data: part } = await supabase
          .from('participants')
          .select('id')
          .eq('room_id', this.roomId)
          .maybeSingle();

        if (part?.id) {
          singerId = part.id;
          this.participantDbId = part.id;
        } else {
          const { data: newPart } = await supabase
            .from('participants')
            .insert({
              room_id: this.roomId,
              nickname: item.singer || this.currentUser.name || 'Cantor',
              session_token: this.sessionToken,
              is_organizer: Boolean(this.currentUser.isOrganizer),
            })
            .select('id')
            .maybeSingle();
          if (newPart?.id) {
            singerId = newPart.id;
            this.participantDbId = newPart.id;
          }
        }
      }

      if (singerId) {
        // Tentar via rpc_add_to_queue primeiro
        try {
          const { error: rpcErr } = await supabase.rpc('rpc_add_to_queue', {
            p_room_id: this.roomId,
            p_participant_id: singerId,
            p_youtube_video_id: item.youtubeVideoId || '',
            p_title: item.title,
            p_channel: item.artist || 'Karaokê',
            p_thumb: null,
            p_duration: 240,
            p_duet_singer_id: null,
          });

          if (!rpcErr) return;
        } catch {
          // Segue para fallback de inserção direta
        }

        // Fallback: Inserção direta respeitando estritamente o schema
        await supabase.from('queue_items').insert({
          room_id: this.roomId,
          singer_id: singerId,
          title: item.title,
          channel_title: item.artist || 'Karaokê',
          youtube_video_id: item.youtubeVideoId || '',
          order_index: position,
          status: 'pending',
          is_priority: Boolean(item.isPriority),
          duration_seconds: 240,
        });
      }
    } catch (err) {
      console.warn('[Realtime] Erro ao persistir música na fila:', err);
    }
  }

  /**
   * Carrega estado do localStorage se a fila estiver vazia
   */
  private fetchInitialStateFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem(`karaoke_queue_${this.roomCode}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && this.currentQueue.length === 0) {
          this.currentQueue = parsed;
          this.callbacks.onQueueChange?.(parsed);
        }
      }
    } catch {
      // Ignora erro
    }
  }
}
