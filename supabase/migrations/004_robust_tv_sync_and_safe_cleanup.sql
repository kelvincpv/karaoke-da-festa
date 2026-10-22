-- ==============================================================================
-- KARAOKÊ DA FESTA — MIGRATION 004: SINCRONIZAÇÃO EM TEMPO REAL DO TELÃO & SAFE CLEANUP
-- 1. Previne exclusão acidental da sala quando ainda houver músicas na fila ou TV ativa
-- 2. Suporta persistência e sincronização de progresso do vídeo (currentTime) entre múltiplos telões
-- ==============================================================================

-- 1. CORREÇÃO DA RPC `rpc_leave_and_cleanup_room`
-- NUNCA exclui a sala se ainda houver músicas ativas na fila ou se for sala recente.
CREATE OR REPLACE FUNCTION public.rpc_leave_and_cleanup_room(
  p_room_id UUID,
  p_participant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INT;
  v_queue_remaining INT;
  v_deleted BOOLEAN := FALSE;
BEGIN
  -- 1. Remove o participante especificado se informado
  IF p_participant_id IS NOT NULL THEN
    DELETE FROM public.participants
    WHERE id = p_participant_id AND room_id = p_room_id;
  END IF;

  -- 2. Conta participantes restantes
  SELECT COUNT(*) INTO v_remaining
  FROM public.participants
  WHERE room_id = p_room_id;

  -- 3. Conta músicas restantes na fila (pendentes ou em reprodução)
  SELECT COUNT(*) INTO v_queue_remaining
  FROM public.queue_items
  WHERE room_id = p_room_id AND status IN ('pending', 'current');

  -- 4. SEGURANÇA TOTAL:
  -- Só exclui a sala se NÃO houver nenhum participante E NÃO houver nenhuma música na fila
  -- E a sala tiver sido criada há mais de 10 minutos (evita apagar sala recém-aberta)
  IF v_remaining = 0 AND v_queue_remaining = 0 THEN
    DELETE FROM public.rooms
    WHERE id = p_room_id
      AND created_at < NOW() - INTERVAL '10 minutes';

    IF FOUND THEN
      v_deleted := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'remaining_participants', v_remaining,
    'queue_remaining', v_queue_remaining,
    'room_deleted', v_deleted
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_leave_and_cleanup_room(UUID, UUID) TO anon, authenticated, service_role;

-- 2. RPC `rpc_update_playback_state`
-- Salva a posição exata de reprodução (currentTime, isPlaying, songId) no banco para sincronizar novos telões
CREATE OR REPLACE FUNCTION public.rpc_update_playback_state(
  p_room_id UUID,
  p_playback JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{playback_state}',
    p_playback,
    true
  )
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_update_playback_state(UUID, JSONB) TO anon, authenticated, service_role;

-- 3. RPC `rpc_get_playback_state`
-- Recupera o estado atual de reprodução salvo no banco
CREATE OR REPLACE FUNCTION public.rpc_get_playback_state(
  p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_playback JSONB;
BEGIN
  SELECT settings->'playback_state' INTO v_playback
  FROM public.rooms
  WHERE id = p_room_id;

  RETURN COALESCE(v_playback, 'null'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_get_playback_state(UUID) TO anon, authenticated, service_role;
