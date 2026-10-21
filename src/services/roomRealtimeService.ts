/**
 * Serviço central de sincronização em tempo real (Supabase Realtime & PostgreSQL)
 * Conecta Celulares, Telão (TV) e Painel do Organizador via Presence, Broadcast e Persistência
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

export interface RoomSyncCallbacks {
  onParticipantsChange?: (participants: RoomParticipantSync[]) => void;
  onQueueChange?: (queue: QueueItemSync[]) => void;
  onCurrentSongChange?: (song: QueueItemSync | null) => void;
  onVotingChange?: (votingOpen: boolean) => void;
  onReaction?: (reaction: FloatingReactionSync) => void;
  onRatingSubmit?: (rating: { singer: string; score: number }) => void;
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

  constructor(
    roomCode: string,
    currentUser: RoomParticipantSync,
    callbacks: RoomSyncCallbacks = {}
  ) {
    this.roomCode = roomCode.toUpperCase();
    this.currentUser = currentUser;
    this.callbacks = callbacks;
  }

  /**
   * Conecta à sala do Supabase Realtime e registra listeners
   */
  public async connect(): Promise<void> {
    // 1. Garantir sala e participante no PostgreSQL se o Supabase estiver configurado
    if (isSupabaseConfigured) {
      try {
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('id, code')
          .eq('code', this.roomCode)
          .maybeSingle();

        if (existingRoom?.id) {
          this.roomId = existingRoom.id;
        } else {
          const { data: newRoom } = await supabase
            .from('rooms')
            .insert({ code: this.roomCode, status: 'open' })
            .select('id, code')
            .maybeSingle();

          if (newRoom?.id) {
            this.roomId = newRoom.id;
          }
        }

        // Registrar participante no banco
        if (this.roomId && this.currentUser.name && this.currentUser.name !== 'Convidado' && this.currentUser.name !== 'Telão TV') {
          await supabase.from('participants').insert({
            room_id: this.roomId,
            nickname: this.currentUser.name,
            role: this.currentUser.isOrganizer ? 'organizer' : 'participant',
          });
        }

        // Carregar fila persistente do PostgreSQL
        if (this.roomId) {
          const { data: dbItems } = await supabase
            .from('queue_items')
            .select('*')
            .eq('room_id', this.roomId)
            .in('status', ['pending', 'singing'])
            .order('position', { ascending: true });

          if (dbItems && dbItems.length > 0) {
            const loadedQueue: QueueItemSync[] = dbItems.map((item) => ({
              id: item.id,
              title: item.song_title,
              artist: item.artist,
              singer: 'Cantor da Festa',
              duet: null,
              duration: '04:00',
              youtubeVideoId: item.youtube_video_id,
              isPriority: item.is_priority,
              addedAt: item.created_at,
            }));
            this.currentQueue = loadedQueue;
            this.callbacks.onQueueChange?.(loadedQueue);
          }
        }
      } catch (err) {
        console.warn('[Realtime] Banco de dados em sincronização inicial:', err);
      }
    }

    // 2. Canal Supabase Realtime (Presence & Broadcast)
    const channelName = `karaoke_room_${this.roomCode}`;
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: true },
        presence: { key: this.currentUser.id },
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
            if (p && p.name && !participantList.some((item) => item.id === p.id)) {
              participantList.push({
                id: p.id,
                name: p.name,
                isOrganizer: p.isOrganizer,
                isSinging: p.isSinging,
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

    // Iniciar inscrição no canal
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.channel) {
        await this.channel.track(this.currentUser);

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
   * Adiciona música à fila com transmissão imediata e persistência
   */
  public addSongToQueue(item: QueueItemSync): void {
    const updated = [...this.currentQueue, item];
    this.currentQueue = updated;

    this.channel?.send({
      type: 'broadcast',
      event: 'queue_add_item',
      payload: { item },
    });

    this.callbacks.onQueueChange?.(updated);
    this.persistQueue(updated, item);
  }

  /**
   * Atualiza a fila inteira (reordenação ou remoção)
   */
  public updateQueue(newQueue: QueueItemSync[]): void {
    this.currentQueue = newQueue;

    this.channel?.send({
      type: 'broadcast',
      event: 'queue_update',
      payload: { queue: newQueue },
    });

    this.callbacks.onQueueChange?.(newQueue);
    this.persistQueue(newQueue);
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
  public toggleVoting(open: boolean): void {
    this.votingOpen = open;

    this.channel?.send({
      type: 'broadcast',
      event: 'voting_toggle',
      payload: { votingOpen: open },
    });

    this.callbacks.onVotingChange?.(open);
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
   * Persiste a fila no banco de dados e localmente
   */
  private async persistQueue(queue: QueueItemSync[], newItem?: QueueItemSync): Promise<void> {
    try {
      localStorage.setItem(`karaoke_queue_${this.roomCode}`, JSON.stringify(queue));

      if (isSupabaseConfigured && this.roomId && newItem) {
        await supabase.from('queue_items').insert({
          room_id: this.roomId,
          song_title: newItem.title,
          artist: newItem.artist,
          youtube_video_id: newItem.youtubeVideoId || '',
          position: queue.length,
          status: 'pending',
          is_priority: Boolean(newItem.isPriority),
          duration_seconds: 240,
        });
      }
    } catch {
      // Ignora erro para não travar a aplicação
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
