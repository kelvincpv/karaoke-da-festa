"use strict";
/**
 * Content Script para YouTube — Karaokê Bridge
 * Observador do elemento HTML5 de vídeo do YouTube, detecção do evento 'ended' e prevenção de autoplay.
 */
console.log('[Karaokê Bridge] YouTube Observer injetado na página.');
function getVideoIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v');
}
async function initYouTubeObserver() {
    const currentVideoId = getVideoIdFromUrl();
    if (!currentVideoId)
        return;
    // Recupera a sessão ativa iniciada pelo Karaokê Bridge
    const data = await chrome.storage.local.get('currentBridgePlayback');
    const playback = data?.currentBridgePlayback;
    if (!playback || playback.videoId !== currentVideoId) {
        // Não é uma reprodução controlada pelo Karaokê Bridge; não interferir
        return;
    }
    console.log(`[Karaokê Bridge] Monitorando reprodução do vídeo: ${currentVideoId}`);
    // Localiza o elemento HTML5 de vídeo
    waitForVideoElement((video) => {
        attachVideoListeners(video, playback);
    });
}
function waitForVideoElement(callback) {
    const existing = document.querySelector('video.html5-main-video');
    if (existing) {
        callback(existing);
        return;
    }
    const observer = new MutationObserver((_, obs) => {
        const video = document.querySelector('video.html5-main-video');
        if (video) {
            obs.disconnect();
            callback(video);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Timeout de contingência de 15 segundos
    setTimeout(() => {
        observer.disconnect();
        const fallbackVideo = document.querySelector('video.html5-main-video');
        if (fallbackVideo)
            callback(fallbackVideo);
    }, 15000);
}
function attachVideoListeners(video, playback) {
    console.log('[Karaokê Bridge] Elemento de vídeo do YouTube conectado com sucesso.');
    let endedTriggered = false;
    // 1. Desativa a reprodução automática do YouTube (Up Next) para evitar que pule para vídeo aleatório
    const disableAutoplay = () => {
        const autonavToggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
        if (autonavToggle) {
            autonavToggle.click();
            console.log('[Karaokê Bridge] Autoplay do YouTube desativado.');
        }
    };
    setTimeout(disableAutoplay, 1500);
    // 2. Dispara a finalização uma única vez
    const dispatchEnded = () => {
        if (endedTriggered)
            return;
        endedTriggered = true;
        // Pausa imediatamente para impedir que o YouTube carregue próximo vídeo antes da janela fechar
        try {
            video.pause();
        }
        catch {
            // ignore
        }
        console.log('[Karaokê Bridge] Evento ENDED detectado no player do YouTube.');
        chrome.runtime.sendMessage({
            source: 'YOUTUBE_OBSERVER',
            type: 'VIDEO_ENDED',
            payload: {
                videoId: playback.videoId,
                sessionId: playback.sessionId,
                performanceId: playback.performanceId,
                playbackAttemptId: playback.playbackAttemptId,
                duration: video.duration || 0,
                currentTime: video.currentTime || 0,
                timestamp: Date.now(),
            },
        });
    };
    // 3. Ouvir evento nativo HTML5 'ended'
    video.addEventListener('ended', () => {
        dispatchEnded();
    });
    // 4. Verificação de proximidade do término como fallback de segurança (últimos 0.5s)
    const timeUpdateInterval = setInterval(() => {
        if (endedTriggered) {
            clearInterval(timeUpdateInterval);
            return;
        }
        if (typeof video.duration === 'number' &&
            typeof video.currentTime === 'number' &&
            video.duration > 8 &&
            video.currentTime >= video.duration - 0.5) {
            clearInterval(timeUpdateInterval);
            dispatchEnded();
        }
    }, 400);
    // 5. Notificar início e pausa
    video.addEventListener('play', () => {
        chrome.runtime.sendMessage({
            source: 'YOUTUBE_OBSERVER',
            type: 'VIDEO_PLAYING',
            payload: {
                videoId: playback.videoId,
                sessionId: playback.sessionId,
                performanceId: playback.performanceId,
                playbackAttemptId: playback.playbackAttemptId,
                timestamp: Date.now(),
            },
        });
    });
    video.addEventListener('pause', () => {
        // Apenas notifica pausa se não tiver finalizado (pause não é fim)
        if (!endedTriggered && video.currentTime < (video.duration || 9999) - 1) {
            chrome.runtime.sendMessage({
                source: 'YOUTUBE_OBSERVER',
                type: 'VIDEO_PAUSED',
                payload: {
                    videoId: playback.videoId,
                    sessionId: playback.sessionId,
                    performanceId: playback.performanceId,
                    playbackAttemptId: playback.playbackAttemptId,
                    currentTime: video.currentTime,
                    timestamp: Date.now(),
                },
            });
        }
    });
}
// Inicia observador ao carregar a página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initYouTubeObserver);
}
else {
    initYouTubeObserver();
}
// Suporta navegação SPA do YouTube (evento yt-navigate-finish)
window.addEventListener('yt-navigate-finish', () => {
    initYouTubeObserver();
});
