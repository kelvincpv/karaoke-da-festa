/**
 * Utilitários e serviços de integração com o YouTube
 * Suporta detecção de URLs, extração de IDs, thumbnails e suporte a YouTube Premium
 */

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: string;
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
 * Busca músicas de karaokê via YouTube Data API v3 ou fallback
 */
export async function searchYouTubeKaraoke(
  query: string,
  apiKey?: string
): Promise<YouTubeVideoItem[]> {
  const effectiveKey =
    apiKey ||
    import.meta.env.VITE_YOUTUBE_API_KEY ||
    localStorage.getItem('karaoke_youtube_api_key') ||
    '';

  // Se houver uma chave da YouTube API configurada, busca ao vivo
  if (effectiveKey && query.trim()) {
    try {
      const searchQuery = encodeURIComponent(`${query.trim()} karaoke`);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&q=${searchQuery}&type=video&key=${effectiveKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        return (data.items || []).map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        }));
      } else {
        console.warn('Erro ao consultar YouTube API:', response.statusText);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar YouTube API:', err);
    }
  }

  // Se o usuário colou um link do YouTube diretamente no campo de busca
  const directId = extractYouTubeVideoId(query);
  if (directId) {
    return [
      {
        id: directId,
        title: 'Música do YouTube (Link Direto)',
        channelTitle: 'Vídeo Adicionado por Link',
        thumbnailUrl: getYouTubeThumbnail(directId),
      },
    ];
  }

  return [];
}
