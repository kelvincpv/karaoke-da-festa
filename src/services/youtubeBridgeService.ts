/**
 * Serviço de Integração com o Karaokê Bridge (Extensão Chrome)
 * Comunicação cliente via postMessage com validação de tentativas, bounds de janela e detecção do evento ended.
 */

export type BridgeStatus =
  | 'not_installed'
  | 'connected'
  | 'opening'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface BridgeState {
  status: BridgeStatus;
  version: string | null;
  activeVideoId: string | null;
  activeAttemptId: string | null;
  isExternalPlaying: boolean;
  lastError: string | null;
}

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type StateListener = (state: BridgeState) => void;
type VideoEndedListener = (payload: any) => void;

class YouTubeBridgeService {
  private state: BridgeState = {
    status: 'not_installed',
    version: null,
    activeVideoId: null,
    activeAttemptId: null,
    isExternalPlaying: false,
    lastError: null,
  };

  private stateListeners = new Set<StateListener>();
  private videoEndedListeners = new Set<VideoEndedListener>();
  private pingInterval: any = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Escuta respostas e eventos da extensão
    window.addEventListener('message', this.handleWindowMessage.bind(this));

    // 2. Verifica se a extensão já marcou o DOM
    const isInstalled = document.documentElement.getAttribute('data-karaoke-bridge-installed') === 'true';
    const version = document.documentElement.getAttribute('data-karaoke-bridge-version');
    if (isInstalled) {
      this.updateState({
        status: 'connected',
        version: version || '1.0.0',
      });
    }

    // 3. Envia Ping inicial e mantém verificação ativa a cada 3s
    this.ping();
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 3000);
  }

  public destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleWindowMessage.bind(this));
    }
    this.stateListeners.clear();
    this.videoEndedListeners.clear();
    this.initialized = false;
  }

  public ping() {
    if (typeof window === 'undefined') return;
    window.postMessage(
      {
        source: 'KARAOKE_APP',
        type: 'BRIDGE_PING',
        timestamp: Date.now(),
      },
      '*'
    );
  }

  private handleWindowMessage(event: MessageEvent) {
    if (event.source !== window || !event.data || event.data.source !== 'KARAOKE_BRIDGE_EXTENSION') {
      return;
    }

    const { type, payload } = event.data;

    switch (type) {
      case 'BRIDGE_PONG': {
        const isNewConnection = this.state.status === 'not_installed';
        this.updateState({
          status: this.state.isExternalPlaying ? this.state.status : 'connected',
          version: payload?.version || '1.0.0',
        });
        if (isNewConnection) {
          console.log(`[Karaokê Bridge] Extensão detectada e conectada (v${payload?.version}).`);
        }
        break;
      }

      case 'VIDEO_OPENED': {
        this.updateState({
          status: 'playing',
          activeVideoId: payload?.videoId || null,
          activeAttemptId: payload?.playbackAttemptId || null,
          isExternalPlaying: true,
          lastError: null,
        });
        console.log(`[Karaokê Bridge] Vídeo aberto na janela externa: ${payload?.videoId}`);
        break;
      }

      case 'VIDEO_PLAYING': {
        this.updateState({
          status: 'playing',
          isExternalPlaying: true,
        });
        break;
      }

      case 'VIDEO_PAUSED': {
        this.updateState({
          status: 'paused',
        });
        break;
      }

      case 'VIDEO_ENDED': {
        console.log(`[Karaokê Bridge] Evento VIDEO_ENDED recebido da extensão:`, payload);
        this.updateState({
          status: 'ended',
          isExternalPlaying: false,
          activeVideoId: null,
          activeAttemptId: null,
        });
        // Notifica os ouvintes (ex: TvModePage para iniciar os 10s de votação)
        this.videoEndedListeners.forEach((listener) => listener(payload));
        break;
      }

      case 'VIDEO_WINDOW_CLOSED': {
        console.log(`[Karaokê Bridge] Janela externa fechada manualmente:`, payload);
        this.updateState({
          status: 'connected',
          isExternalPlaying: false,
          activeVideoId: null,
          activeAttemptId: null,
        });
        break;
      }

      case 'VIDEO_CLOSE_CONFIRMED': {
        this.updateState({
          status: 'connected',
          isExternalPlaying: false,
          activeVideoId: null,
          activeAttemptId: null,
        });
        break;
      }
    }
  }

  /**
   * Solicita abertura de um vídeo bloqueado na janela popup do YouTube Premium
   */
  public async openExternalVideo(params: {
    videoId: string;
    title: string;
    singer: string;
    sessionId: string;
    performanceId: string;
    bounds?: WindowBounds;
  }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const attemptId = `${params.performanceId}_${Date.now()}`;

    this.updateState({
      status: 'opening',
      activeVideoId: params.videoId,
      activeAttemptId: attemptId,
      isExternalPlaying: true,
      lastError: null,
    });

    window.postMessage(
      {
        source: 'KARAOKE_APP',
        type: 'VIDEO_OPEN_REQUEST',
        payload: {
          videoId: params.videoId,
          title: params.title,
          singer: params.singer,
          sessionId: params.sessionId,
          performanceId: params.performanceId,
          playbackAttemptId: attemptId,
          bounds: params.bounds,
        },
        timestamp: Date.now(),
      },
      '*'
    );

    return true;
  }

  /**
   * Solicita fechamento da janela externa
   */
  public async closeExternalVideo(): Promise<void> {
    if (typeof window === 'undefined') return;

    window.postMessage(
      {
        source: 'KARAOKE_APP',
        type: 'VIDEO_CLOSE_REQUEST',
        timestamp: Date.now(),
      },
      '*'
    );
  }

  public getState(): BridgeState {
    return { ...this.state };
  }

  public isAvailable(): boolean {
    return this.state.status !== 'not_installed';
  }

  public isPlayingExternally(): boolean {
    return this.state.isExternalPlaying;
  }

  private updateState(partial: Partial<BridgeState>) {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach((l) => l(this.state));
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onVideoEnded(listener: VideoEndedListener): () => void {
    this.videoEndedListeners.add(listener);
    return () => {
      this.videoEndedListeners.delete(listener);
    };
  }
}

export const youtubeBridgeService = new YouTubeBridgeService();
