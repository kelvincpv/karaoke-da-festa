import React, { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { checkSupabaseHealth, isSupabaseConfigured, type SupabaseHealthResult } from '../lib/supabase';

interface SupabaseStatusBadgeProps {
  className?: string;
  compact?: boolean;
}

export const SupabaseStatusBadge: React.FC<SupabaseStatusBadgeProps> = ({
  className = '',
  compact = false,
}) => {
  const [status, setStatus] = useState<SupabaseHealthResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const testConnection = useCallback(async () => {
    setLoading(true);
    try {
      const result = await checkSupabaseHealth();
      setStatus(result);
    } catch {
      setStatus({
        connected: false,
        latencyMs: 0,
        url: '',
        error: 'Falha crítica ao tentar checar conexão',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  const isConnected = status?.connected ?? false;

  return (
    <>
      {/* Botão / Badge Discreto */}
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title="Clique para inspecionar o status do Supabase"
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition-all border shadow-sm ${
            loading
              ? 'bg-dark-surface/80 border-dark-border text-text-muted hover:border-brand-purple/40'
              : isConnected
              ? 'bg-status-success/10 border-status-success/30 text-status-success hover:bg-status-success/20 hover:border-status-success/60 shadow-status-success/10'
              : 'bg-status-warning/10 border-status-warning/30 text-status-warning hover:bg-status-warning/20 hover:border-status-warning/60 shadow-status-warning/10'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin text-text-muted" />
          ) : isConnected ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-status-warning" />
          )}

          <span className="flex items-center gap-1">
            <Database className="w-3 h-3 opacity-80" />
            {loading ? (
              <span>Checando Supabase...</span>
            ) : isConnected ? (
              <span>Supabase Conectado {!compact && status?.latencyMs ? `(${status.latencyMs}ms)` : ''}</span>
            ) : (
              <span>Modo Local / Demo</span>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            testConnection();
          }}
          disabled={loading}
          className="p-1.5 rounded-full text-text-muted hover:text-white hover:bg-dark-elevated transition-colors border border-transparent hover:border-dark-border disabled:opacity-40"
          title="Re-testar conexão agora"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Modal / Diálogo de Auditoria de Conexão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-dark-border bg-dark-surface p-6 shadow-glass relative text-left">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`p-2 rounded-xl border ${
                  isConnected
                    ? 'bg-status-success/15 border-status-success/30 text-status-success'
                    : 'bg-status-warning/15 border-status-warning/30 text-status-warning'
                }`}
              >
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Auditoria de Conexão Supabase
                </h3>
                <p className="text-xs text-text-muted">
                  Status em tempo real das variáveis de ambiente e banco
                </p>
              </div>
            </div>

            {/* Card com Detalhes */}
            <div className="space-y-3 rounded-xl border border-dark-border bg-dark-base/80 p-4 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-dark-border/50">
                <span className="text-text-secondary">Estado da Conexão:</span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    isConnected ? 'text-status-success' : 'text-status-warning'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Ativa & Respondendo
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" /> Desconectado / Local
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-1 pb-2 border-b border-dark-border/50">
                <span className="text-text-secondary">URL Detectada:</span>
                <span className="text-text-primary break-all font-sans bg-dark-elevated p-1.5 rounded border border-dark-border/40">
                  {status?.url || 'Nenhuma URL configurada'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-dark-border/50">
                <span className="text-text-secondary">Latência de Ping:</span>
                <span className="text-brand-cyan-light font-bold">
                  {status?.latencyMs ? `${status.latencyMs} ms` : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-dark-border/50">
                <span className="text-text-secondary">Variáveis Vercel / Vite:</span>
                <span
                  className={`font-bold ${
                    isSupabaseConfigured ? 'text-status-success' : 'text-status-warning'
                  }`}
                >
                  {isSupabaseConfigured ? 'Configuradas (Vercel/Vite)' : 'Ausentes (Fallback Ativo)'}
                </span>
              </div>

              {status?.source && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Canal de Validação:</span>
                  <span className="text-brand-purple-light font-semibold">
                    {status.source}
                  </span>
                </div>
              )}

              {status?.error && (
                <div className="mt-2 p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-[11px] font-sans">
                  <strong>Diagnóstico:</strong> {status.error}
                </div>
              )}
            </div>

            {/* Explicação Amigável */}
            <div className="mt-4 text-xs text-text-secondary space-y-1.5">
              {isConnected ? (
                <p className="text-status-success flex items-center gap-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" /> Seu banco de dados Supabase na Vercel está 100% operacional e pronto para a cantoria!
                </p>
              ) : (
                <p className="text-text-muted">
                  Caso queira conectar ao Supabase em produção na Vercel, certifique-se de que a integração injetou <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> (ou <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>).
                </p>
              )}
            </div>

            {/* Ações do Modal */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => testConnection()}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold shadow-neon-purple hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Testando...' : 'Testar Novamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
