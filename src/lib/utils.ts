import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verifica se o participante atual é o cantor principal ou o parceiro de dueto da apresentação ativa.
 * Previne auto-avaliação (o cantor não pode votar na sua própria cantoria).
 */
export function isSelfSinger(
  singerName?: string | null,
  duetName?: string | null,
  participantName?: string | null
): boolean {
  if (!participantName || !participantName.trim()) return false;
  const user = participantName.trim().toLowerCase();

  const matches = (target?: string | null): boolean => {
    if (!target || !target.trim()) return false;
    const cleanTarget = target.trim().toLowerCase();
    if (cleanTarget === user) return true;
    // Divide por separadores comuns como espaço, +, &, /
    const parts = cleanTarget.split(/[\s+,&/]+/).filter(Boolean);
    if (parts.includes(user)) return true;
    // Substring bidirecional (ex: "Paulinho" em "Paulinho do Pagode")
    if (cleanTarget.includes(user) || user.includes(cleanTarget)) return true;
    return false;
  };

  return matches(singerName) || matches(duetName);
}

/**
 * Gera uma chave única e determinística para identificar a apresentação ativa (Performance)
 */
export function getPerformanceKey(
  songId?: string | null,
  singerName?: string | null,
  songTitle?: string | null
): string {
  if (songId && songId.trim()) {
    return songId.trim();
  }
  const s = (singerName || 'cantor').trim().toLowerCase();
  const t = (songTitle || 'musica').trim().toLowerCase();
  return `${s}___${t}`;
}
