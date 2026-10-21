/**
 * Utilitários e serviços de integração com o YouTube Data API v3
 * Suporta busca ao vivo de karaokê, detecção de URLs diretas, thumbnails e YouTube Premium
 */

export interface YouTubeSearchResultItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: string;
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchResultItem[];
  error?: string;
  hasApiKey: boolean;
}

/**
 * Obtém a chave da YouTube Data API v3 de variáveis de ambiente ou localStorage
 */
export function getYouTubeApiKey(): string {
  return (
    import.meta.env.VITE_YOUTUBE_API_KEY ||
    import.meta.env.YOUTUBE_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('karaoke_youtube_api_key') : '') ||
    ''
  );
}

/**
 * Salva a chave da YouTube Data API v3 no navegador para uso imediato
 */
export function setYouTubeApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('karaoke_youtube_api_key', key.trim());
    } else {
      localStorage.removeItem('karaoke_youtube_api_key');
    }
  }
}

/**
 * Extrai o ID de 11 caracteres de qualquer formato de link do YouTube ou ID direto
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Caso seja diretamente o ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex para links comuns do YouTube (watch?v=, youtu.be, embed, shorts)
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Retorna a URL da imagem de capa (thumbnail) de um vídeo do YouTube
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * URL direta de autenticação Google para o Organizador logar no YouTube Premium
 */
export const YOUTUBE_PREMIUM_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com';

/**
 * Busca músicas de karaokê via YouTube Data API v3 com suporte a fallback de link direto
 */
export async function searchYouTubeKaraoke(
  query: string,
  customApiKey?: string
): Promise<YouTubeSearchResponse> {
  const effectiveKey = (customApiKey || getYouTubeApiKey()).trim();

  // 1. Se o usuário colou um link direto do YouTube, extrai imediatamente sem gastar cota
  const directId = extractYouTubeVideoId(query);
  if (directId) {
    return {
      hasApiKey: Boolean(effectiveKey),
      items: [
        {
          id: directId,
          title: 'Música do YouTube (Link Direto)',
          channelTitle: 'Vídeo Adicionado por Link',
          thumbnailUrl: getYouTubeThumbnail(directId),
        },
      ],
    };
  }

  // 2. Se não houver chave de API configurada
  if (!effectiveKey) {
    return {
      hasApiKey: false,
      items: [],
      error: 'Nenhuma chave da YouTube Data API configurada. Cole o link direto do YouTube ou adicione a API Key.',
    };
  }

  // 3. Busca ao vivo na YouTube Data API v3
  try {
    const searchQuery = encodeURIComponent(`${query.trim()} karaoke`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&q=${searchQuery}&type=video&key=${effectiveKey}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => null);

    if (response.ok && data?.items) {
      const items: YouTubeSearchResultItem[] = data.items
        .filter((item: any) => item.id?.videoId)
        .map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet?.title || 'Música de Karaokê',
          channelTitle: item.snippet?.channelTitle || 'Canal do YouTube',
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            getYouTubeThumbnail(item.id.videoId),
        }));

      return {
        hasApiKey: true,
        items,
      };
    } else {
      const googleError = data?.error?.message || `Erro ${response.status}: ${response.statusText}`;
      console.warn('⚠️ [YouTube API Error]:', googleError);
      return {
        hasApiKey: true,
        items: [],
        error: googleError,
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Falha na requisição à API do YouTube';
    console.error('⚠️ [YouTube Network Error]:', errorMsg);
    return {
      hasApiKey: true,
      items: [],
      error: errorMsg,
    };
  }
}
