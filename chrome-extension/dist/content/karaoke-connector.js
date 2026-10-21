"use strict";
/**
 * Content Script para Karaokê da Festa — Karaokê Bridge
 * Ponte bidirecional entre a aplicação web (React) e a Extensão Chrome via postMessage e chrome.runtime.
 */
console.log('[Karaokê Bridge] Conector injetado no Karaokê da Festa.');
// Indica no DOM que a extensão está instalada
document.documentElement.setAttribute('data-karaoke-bridge-installed', 'true');
document.documentElement.setAttribute('data-karaoke-bridge-version', chrome.runtime.getManifest().version);
// 1. Escuta mensagens enviadas pela aplicação React (KARAOKE_APP)
window.addEventListener('message', async (event) => {
    // Ignora mensagens que não sejam da aplicação Karaokê
    if (event.source !== window || !event.data || event.data.source !== 'KARAOKE_APP') {
        return;
    }
    const { type, payload } = event.data;
    if (type === 'BRIDGE_PING') {
        window.postMessage({
            source: 'KARAOKE_BRIDGE_EXTENSION',
            type: 'BRIDGE_PONG',
            payload: {
                version: chrome.runtime.getManifest().version,
                installed: true,
            },
            timestamp: Date.now(),
        }, '*');
        return;
    }
    // Encaminha requisições da página para o Service Worker da extensão
    try {
        const response = await chrome.runtime.sendMessage({
            source: 'KARAOKE_APP',
            type,
            payload,
            timestamp: Date.now(),
        });
        if (response) {
            window.postMessage(response, '*');
        }
    }
    catch (err) {
        console.warn('[Karaokê Bridge] Falha ao comunicar com Service Worker:', err);
    }
});
// 2. Escuta mensagens recebidas do Service Worker (ex: VIDEO_ENDED, VIDEO_OPENED, VIDEO_WINDOW_CLOSED)
chrome.runtime.onMessage.addListener((message) => {
    if (message && (message.source === 'KARAOKE_BRIDGE_EXTENSION' || message.source === 'YOUTUBE_OBSERVER')) {
        // Encaminha para a janela do Karaokê da Festa
        window.postMessage({
            ...message,
            source: 'KARAOKE_BRIDGE_EXTENSION',
        }, '*');
    }
});
// Notifica a página imediatamente ao carregar
window.postMessage({
    source: 'KARAOKE_BRIDGE_EXTENSION',
    type: 'BRIDGE_PONG',
    payload: {
        version: chrome.runtime.getManifest().version,
        installed: true,
    },
    timestamp: Date.now(),
}, '*');
