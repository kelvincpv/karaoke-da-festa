/**
 * Protocolo de Comunicação Tipado — Karaokê Bridge
 * Sincronização entre Karaokê da Festa, Service Worker e Content Scripts do YouTube.
 */

export type BridgeMessageType =
  | 'BRIDGE_PING'
  | 'BRIDGE_PONG'
  | 'VIDEO_OPEN_REQUEST'
  | 'VIDEO_OPENED'
  | 'VIDEO_PLAYING'
  | 'VIDEO_PAUSED'
  | 'VIDEO_ENDED'
  | 'VIDEO_ERROR'
  | 'VIDEO_CLOSE_REQUEST'
  | 'VIDEO_CLOSE_CONFIRMED'
  | 'VIDEO_WINDOW_CLOSED';

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VideoOpenPayload {
  videoId: string;
  title: string;
  singer: string;
  sessionId: string;
  performanceId: string;
  playbackAttemptId: string;
  bounds?: WindowBounds;
}

export interface VideoStatusPayload {
  videoId: string;
  sessionId: string;
  performanceId: string;
  playbackAttemptId: string;
  currentTime?: number;
  duration?: number;
  error?: string;
  timestamp: number;
}

export interface BridgeMessage<T = any> {
  source: 'KARAOKE_APP' | 'KARAOKE_BRIDGE_EXTENSION' | 'YOUTUBE_OBSERVER';
  type: BridgeMessageType;
  payload?: T;
  timestamp: number;
}
