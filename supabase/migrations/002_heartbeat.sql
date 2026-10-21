-- Migration 002: Keep-alive Heartbeat
-- Tabela e função RPC para manter o banco ativo e evitar a pausa por inatividade do Supabase Free Tier

CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
    ping_count BIGINT NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{"source": "keep-alive-cron"}'::jsonb
);

-- Habilitar Row Level Security
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança permissivas para operações de heartbeat
DROP POLICY IF EXISTS "Allow public read on system_heartbeat" ON public.system_heartbeat;
CREATE POLICY "Allow public read on system_heartbeat"
    ON public.system_heartbeat FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow public upsert on system_heartbeat" ON public.system_heartbeat;
CREATE POLICY "Allow public upsert on system_heartbeat"
    ON public.system_heartbeat FOR ALL
    USING (true)
    WITH CHECK (true);

-- Inserir registro inicial caso não exista
INSERT INTO public.system_heartbeat (id, last_ping, ping_count, metadata)
VALUES ('primary', now(), 1, '{"source": "initial_seed"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Função RPC autoritativa para atualizar o heartbeat
CREATE OR REPLACE FUNCTION public.rpc_heartbeat()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record public.system_heartbeat%ROWTYPE;
BEGIN
    INSERT INTO public.system_heartbeat (id, last_ping, ping_count, metadata)
    VALUES ('primary', now(), 1, jsonb_build_object('source', 'rpc_heartbeat', 'updated_at', now()))
    ON CONFLICT (id) DO UPDATE
    SET last_ping = now(),
        ping_count = public.system_heartbeat.ping_count + 1,
        metadata = jsonb_build_object('source', 'rpc_heartbeat', 'updated_at', now())
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Supabase database is alive and active',
        'last_ping', v_record.last_ping,
        'ping_count', v_record.ping_count
    );
END;
$$;

-- Permissões de execução pública para a função RPC
GRANT EXECUTE ON FUNCTION public.rpc_heartbeat() TO anon, authenticated, service_role;
