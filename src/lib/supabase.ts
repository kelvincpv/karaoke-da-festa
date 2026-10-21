import { createClient } from '@supabase/supabase-js';

// Obtenção de variáveis de ambiente do Vite (suporta prefixo VITE_ e SUPABASE_ da Vercel)
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://placeholder-mock-project.supabase.co';

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'placeholder-anon-key-offline-mode';

// Verificação se há credenciais válidas configuradas
export const isSupabaseConfigured = Boolean(
  (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL) &&
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY) &&
  !supabaseUrl.includes('placeholder-mock-project')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [Supabase] Variáveis de ambiente VITE_SUPABASE_URL/SUPABASE_URL ou VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY não encontradas. O cliente está operando em Modo Local / Mock.'
  );
}

// Criação do cliente Supabase seguro
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface SupabaseHealthResult {
  connected: boolean;
  latencyMs: number;
  url: string;
  error?: string;
  source?: string;
}

/**
 * Realiza uma checagem de saúde leve da conexão com o Supabase.
 * Tenta chamar rpc_heartbeat() -> system_heartbeat -> rooms.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      latencyMs: 0,
      url: supabaseUrl,
      error: 'Variáveis de ambiente do Supabase não configuradas (Modo Demo / Local).',
    };
  }

  const startTime = performance.now();

  try {
    // 1. Tentativa via RPC de heartbeat dedicado
    const { error: rpcError } = await supabase.rpc('rpc_heartbeat');
    if (!rpcError) {
      return {
        connected: true,
        latencyMs: Math.round(performance.now() - startTime),
        url: supabaseUrl,
        source: 'rpc_heartbeat',
      };
    }

    // 2. Fallback: Consulta direta na tabela de heartbeat
    const { error: heartbeatTableError } = await supabase
      .from('system_heartbeat')
      .select('last_ping')
      .limit(1);

    if (!heartbeatTableError) {
      return {
        connected: true,
        latencyMs: Math.round(performance.now() - startTime),
        url: supabaseUrl,
        source: 'system_heartbeat',
      };
    }

    // 3. Fallback: Consulta direta na tabela de salas
    const { error: roomsTableError } = await supabase
      .from('rooms')
      .select('id')
      .limit(1);

    if (!roomsTableError) {
      return {
        connected: true,
        latencyMs: Math.round(performance.now() - startTime),
        url: supabaseUrl,
        source: 'rooms',
      };
    }

    // Caso todas tenham falhado
    const finalError =
      rpcError?.message || heartbeatTableError?.message || roomsTableError?.message || 'Falha de comunicação';

    return {
      connected: false,
      latencyMs: Math.round(performance.now() - startTime),
      url: supabaseUrl,
      error: finalError,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro inesperado na conexão';
    return {
      connected: false,
      latencyMs: Math.round(performance.now() - startTime),
      url: supabaseUrl,
      error: message,
    };
  }
}
