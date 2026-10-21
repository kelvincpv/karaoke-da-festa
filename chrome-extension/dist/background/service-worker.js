/**
 * Background Service Worker — Karaokê Bridge
 * Gerenciamento seguro de janelas popup do YouTube, validação de sessões e protocolo de comunicação.
 */
let activePlayback = null;
let connectedKaraokeTabs = new Set();
console.log('[Karaokê Bridge] Service Worker inicializado.');
// Registrar abas conectadas do Karaokê da Festa
function registerKaraokeTab(tabId) {
    connectedKaraokeTabs.add(tabId);
}
// Despacha mensagem para todas as abas abertas do Karaokê da Festa
async function broadcastToKaraokeTabs(message) {
    const tabs = Array.from(connectedKaraokeTabs);
    for (const tabId of tabs) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
        }
        catch {
            // Aba pode ter sido fechada ou recarregada
            connectedKaraokeTabs.delete(tabId);
        }
    }
}
// Listener principal de mensagens internas da extensão
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab?.id) {
        registerKaraokeTab(sender.tab.id);
    }
    switch (message.type) {
        case 'BRIDGE_PING': {
            sendResponse({
                source: 'KARAOKE_BRIDGE_EXTENSION',
                type: 'BRIDGE_PONG',
                payload: {
                    version: chrome.runtime.getManifest().version,
                    activePlayback: activePlayback ? {
                        videoId: activePlayback.videoId,
                        performanceId: activePlayback.performanceId,
                        sessionId: activePlayback.sessionId,
                    } : null,
                },
                timestamp: Date.now(),
            });
            return true;
        }
        case 'VIDEO_OPEN_REQUEST': {
            const payload = message.payload;
            if (!payload?.videoId || !payload.playbackAttemptId) {
                sendResponse({ error: 'Payload inválido para abertura de vídeo.' });
                return true;
            }
            handleOpenVideoRequest(payload)
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ error: err.message }));
            return true; // resposta assíncrona
        }
        case 'VIDEO_PLAYING':
        case 'VIDEO_PAUSED': {
            // Repassa eventos de reprodução em tempo real para o Karaokê
            broadcastToKaraokeTabs(message);
            sendResponse({ received: true });
            return true;
        }
        case 'VIDEO_ENDED': {
            const payload = message.payload;
            handleVideoEnded(payload)
                .then((result) => sendResponse(result))
                .catch((err) => sendResponse({ error: err.message }));
            return true;
        }
        case 'VIDEO_CLOSE_REQUEST': {
            closeActiveWindow()
                .then(() => {
                sendResponse({
                    source: 'KARAOKE_BRIDGE_EXTENSION',
                    type: 'VIDEO_CLOSE_CONFIRMED',
                    timestamp: Date.now(),
                });
            })
                .catch((err) => sendResponse({ error: err.message }));
            return true;
        }
    }
    return false;
});
// Abertura da Janela Dedicada do YouTube Premium
async function handleOpenVideoRequest(payload) {
    // 1. Se já houver janela aberta de música anterior, fecha primeiro
    if (activePlayback?.windowId) {
        await closeActiveWindow();
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${payload.videoId}&autoplay=1`;
    // Calcula bounds da janela respeitando a posição informada do player
    const createData = {
        url: youtubeUrl,
        type: 'popup',
        focused: true,
    };
    if (payload.bounds && payload.bounds.width > 200 && payload.bounds.height > 150) {
        createData.left = Math.round(payload.bounds.left);
        createData.top = Math.round(payload.bounds.top);
        createData.width = Math.round(payload.bounds.width);
        createData.height = Math.round(payload.bounds.height);
    }
    const newWindow = await chrome.windows.create(createData);
    const tab = newWindow?.tabs?.[0];
    activePlayback = {
        windowId: newWindow?.id ?? null,
        tabId: tab?.id ?? null,
        sessionId: payload.sessionId,
        performanceId: payload.performanceId,
        playbackAttemptId: payload.playbackAttemptId,
        videoId: payload.videoId,
        endedSent: false,
        openedAt: Date.now(),
    };
    // Armazena no storage para que o content-script do YouTube associe os IDs
    await chrome.storage.local.set({
        currentBridgePlayback: {
            videoId: payload.videoId,
            sessionId: payload.sessionId,
            performanceId: payload.performanceId,
            playbackAttemptId: payload.playbackAttemptId,
        },
    });
    const responseMsg = {
        source: 'KARAOKE_BRIDGE_EXTENSION',
        type: 'VIDEO_OPENED',
        payload: {
            videoId: payload.videoId,
            windowId: newWindow?.id,
            tabId: tab?.id,
            playbackAttemptId: payload.playbackAttemptId,
        },
        timestamp: Date.now(),
    };
    await broadcastToKaraokeTabs(responseMsg);
    return responseMsg;
}
// Tratamento de finalização de vídeo com garantia de idempotência
async function handleVideoEnded(payload) {
    if (!activePlayback) {
        return { ignored: 'Nenhum vídeo ativo registrado.' };
    }
    // Validação estrita: confere se a tentativa de reprodução corresponde à atual
    if (activePlayback.playbackAttemptId !== payload.playbackAttemptId) {
        console.warn('[Karaokê Bridge] Evento ended ignorado: attemptId não coincide.');
        return { ignored: 'Attempt ID não coincide.' };
    }
    // Idempotência: impede disparar duas vezes para a mesma apresentação
    if (activePlayback.endedSent) {
        return { ignored: 'Evento ended já foi processado anteriormente.' };
    }
    activePlayback.endedSent = true;
    console.log(`[Karaokê Bridge] Música finalizada com sucesso: ${payload.videoId}`);
    // 1. Notifica o Karaokê da Festa imediatamente para disparar a rotina de avaliação
    const endMessage = {
        source: 'KARAOKE_BRIDGE_EXTENSION',
        type: 'VIDEO_ENDED',
        payload,
        timestamp: Date.now(),
    };
    await broadcastToKaraokeTabs(endMessage);
    // 2. Fecha a janela do YouTube após um pequeno delay para transição limpa
    setTimeout(async () => {
        await closeActiveWindow();
    }, 600);
    return { success: true };
}
// Fecha a janela popup ativa
async function closeActiveWindow() {
    if (activePlayback?.windowId) {
        try {
            await chrome.windows.remove(activePlayback.windowId);
        }
        catch {
            // Janela já pode ter sido fechada pelo usuário
        }
    }
    activePlayback = null;
    await chrome.storage.local.remove('currentBridgePlayback');
}
// Observa fechamento manual de janelas
chrome.windows.onRemoved.addListener((closedWindowId) => {
    if (activePlayback && activePlayback.windowId === closedWindowId) {
        // Se fechou antes do término oficial, avisa o Karaokê
        if (!activePlayback.endedSent) {
            console.log('[Karaokê Bridge] Janela do YouTube foi fechada manualmente antes do término.');
            broadcastToKaraokeTabs({
                source: 'KARAOKE_BRIDGE_EXTENSION',
                type: 'VIDEO_WINDOW_CLOSED',
                payload: {
                    videoId: activePlayback.videoId,
                    sessionId: activePlayback.sessionId,
                    performanceId: activePlayback.performanceId,
                    playbackAttemptId: activePlayback.playbackAttemptId,
                    timestamp: Date.now(),
                },
                timestamp: Date.now(),
            });
        }
        activePlayback = null;
        chrome.storage.local.remove('currentBridgePlayback');
    }
});
export {};
