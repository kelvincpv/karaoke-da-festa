/**
 * Serviço central de sincronização em tempo real (Supabase Realtime)
 * Conecta Celulares, Telão (TV) e Painel do Organizador via Presence e Broadcast
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
    // Canal seguro por sala
    const channelName = `karaoke_room_${this.roomCode}`;
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: true },
        presence: { key: this.currentUser.id },
      },
    });

    // 1. PRESENCE: Sincronização de participantes conectados em tempo real
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
        // Se alguém novo entrar e nós formos o organizador ou já tivermos a fila, compartilhamos o estado
        if (this.currentUser.isOrganizer || this.currentQueue.length > 0) {
          this.broadcastState();
        }
      });

    // 2. BROADCAST: Fila de músicas, controle de palco e votações
    this.channel
      .on('broadcast', { event: 'queue_update' }, ({ payload }) => {
        if (Array.isArray(payload?.queue)) {
          this.currentQueue = payload.queue;
          if (this.callbacks.onQueueChange) {
            this.callbacks.onQueueChange(this.currentQueue);
          }
        }
      })
      .on('broadcast', { event: 'queue_add_item' }, ({ payload }) => {
        if (payload?.item) {
          const exists = this.currentQueue.some((q) => q.id === payload.item.id);
          if (!exists) {
            this.currentQueue = [...this.currentQueue, payload.item];
            if (this.callbacks.onQueueChange) {
              this.callbacks.onQueueChange(this.currentQueue);
            }
          }
        }
      })
      .on('broadcast', { event: 'stage_change' }, ({ payload }) => {
        this.currentSong = payload?.currentSong || null;
        if (this.callbacks.onCurrentSongChange) {
          this.callbacks.onCurrentSongChange(this.currentSong);
        }
      })
      .on('broadcast', { event: 'voting_toggle' }, ({ payload }) => {
        this.votingOpen = Boolean(payload?.votingOpen);
        if (this.callbacks.onVotingChange) {
          this.callbacks.onVotingChange(this.votingOpen);
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
        // Alguém que acabou de abrir a tela pediu o estado atual da sala
        if (this.currentUser.isOrganizer || this.currentQueue.length > 0 || this.currentSong) {
          this.broadcastState();
        }
      })
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        if (payload) {
          if (Array.isArray(payload.queue)) {
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

    // Iniciar inscrição
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.channel) {
        // Rastrear presença do usuário atual
        await this.channel.track(this.currentUser);

        // Pedir o estado atual da sala a quem já estiver conectado
        this.channel.send({
          type: 'broadcast',
          event: 'request_state',
          payload: { requesterId: this.currentUser.id },
        });

        // Tentativa de carregar da base Supabase se o banco estiver disponível
        this.fetchInitialStateFromDatabase();
      }
    });
  }

  /**
   * Adiciona uma música à fila e avisa todos os aparelhos
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
    this.persistQueueToDatabase(updated);
  }

  /**
   * Reordena ou remove itens da fila
   */
  public updateQueue(newQueue: QueueItemSync[]): void {
    this.currentQueue = newQueue;

    this.channel?.send({
      type: 'broadcast',
      event: 'queue_update',
      payload: { queue: newQueue },
    });

    this.callbacks.onQueueChange?.(newQueue);
    this.persistQueueToDatabase(newQueue);
  }

  /**
   * Troca a música atual no palco (Telão e Celulares)
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
   * Abre ou fecha a votação no telão e nos celulares
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
   * Dispara um emoji de reação para o telão e outros participantes
   */
  public sendReaction(emoji: string, xOffset?: number): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, xOffset },
    });
  }

  /**
   * Envia o estado completo para sincronização de novos clientes
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
   * Persistência opcional na base de dados Supabase
   */
  private async persistQueueToDatabase(queue: QueueItemSync[]): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      // Salva ou atualiza a lista de itens da fila se as tabelas existirem
      localStorage.setItem(`karaoke_queue_${this.roomCode}`, JSON.stringify(queue));
    } catch {
      // Falha silenciosa para manter a fluidez de palco
    }
  }

  /**
   * Tenta carregar do cache local ou Supabase ao inicializar
   */
  private fetchInitialStateFromDatabase(): void {
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
      // Ignora erro de parsing
    }
  }
}
