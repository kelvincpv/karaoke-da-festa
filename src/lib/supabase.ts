import { createClient } from '@supabase/supabase-js';

// Obtenção de variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-mock-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key-offline-mode';

// Verificação de ambiente configurado
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder-mock-project')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [Supabase] Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas. O cliente está operando com fallback para desenvolvimento offline/mock.'
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
