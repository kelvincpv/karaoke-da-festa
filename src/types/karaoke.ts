// Karaokê da Festa — Contratos de Dados e Tipos TypeScript Compartilhados
// Baseado em docs/CONTRACTS.md

export type RoomStatus = 'active' | 'paused' | 'closed';
export type QueueItemStatus = 'pending' | 'current' | 'completed' | 'skipped';

export type ReactionEmoji = '❤️' | '🔥' | '👏' | '🎉' | '⭐' | '🎤';

export const REACTION_EMOJIS: readonly ReactionEmoji[] = [
  '❤️',
  '🔥',
  '👏',
  '🎉',
  '⭐',
  '🎤',
] as const;

export interface RoomSettings {
  max_songs_per_user: number;
  allow_duets: boolean;
  vote_duration_seconds: number;
  auto_play: boolean;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  organizer_id?: string;
  status: RoomStatus;
  current_queue_id?: string | null;
  voting_open: boolean;
  settings: RoomSettings;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  session_token: string;
  avatar_url?: string;
  is_organizer: boolean;
  joined_at: string;
  last_active_at: string;
}

export interface QueueItem {
  id: string;
  room_id: string;
  youtube_video_id: string;
  title: string;
  channel_title?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  singer_id: string;
  duet_singer_id?: string | null;
  status: QueueItemStatus;
  order_index: number;
  is_priority: boolean;
  created_at: string;
  // Joins
  singer?: Participant;
  duet_singer?: Participant | null;
}

export interface Rating {
  id: string;
  room_id: string;
  queue_item_id: string;
  voter_participant_id: string;
  stars: number; // 1 to 5
  created_at: string;
}

export interface PerformanceResult {
  id: string;
  room_id: string;
  queue_item_id: string;
  singer_id: string;
  duet_singer_id?: string | null;
  song_title: string;
  average_stars: number;
  total_votes: number;
  score_points: number;
  completed_at: string;
  singer?: Participant;
  duet_singer?: Participant;
}

export interface ParticipantRanking {
  participant_id: string;
  nickname: string;
  total_points: number;
  songs_sung: number;
  average_stars: number;
}

export interface DuetRanking {
  duet_key: string; // ex: id1:id2 ordenado
  singer1: Participant;
  singer2: Participant;
  total_points: number;
  songs_sung: number;
  average_stars: number;
}

export interface RealtimeReaction {
  id: string;
  room_id: string;
  sender_nickname: string;
  emoji: ReactionEmoji | string;
  timestamp: number;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

export interface PlaybackCommandPayload {
  command: 'play' | 'pause' | 'skip' | 'restart';
  videoId?: string;
}
