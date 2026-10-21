-- ==============================================================================
-- KARAOKÊ DA FESTA — MIGRATION 003: PERSISTÊNCIA COMPLETA EM BANCO & AUTO-CLEANUP
-- Suporte a códigos longos de sala, auto-criação no banco e exclusão automática
-- quando não houver mais nenhum participante ativo na sala (Supabase PostgreSQL)
-- ==============================================================================

-- 1. AJUSTE DE TAMANHO DE CÓDIGO DA SALA (SUPORTA ATÉ 32 CARACTERES)
ALTER TABLE public.rooms ALTER COLUMN code TYPE VARCHAR(32);
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS check_room_code_len;
ALTER TABLE public.rooms ADD CONSTRAINT check_room_code_len CHECK (char_length(code) >= 3 AND char_length(code) <= 32);

-- 2. POLÍTICAS RLS PERMISSIVAS PARA OPERAÇÕES DA SALA
DROP POLICY IF EXISTS "rooms_delete_all" ON public.rooms;
CREATE POLICY "rooms_delete_all" ON public.rooms FOR DELETE USING (true);

DROP POLICY IF EXISTS "rooms_update_all" ON public.rooms;
CREATE POLICY "rooms_update_all" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_insert_all" ON public.rooms;
CREATE POLICY "rooms_insert_all" ON public.rooms FOR INSERT WITH CHECK (true);

-- 3. ATUALIZAÇÃO DO RPC `rpc_join_room`: AUTO-CRIAÇÃO DA SALA NO BANCO DE DADOS
-- Se a sala com o código solicitado não existir, ela é criada atomicamente no PostgreSQL.
CREATE OR REPLACE FUNCTION public.rpc_join_room(
  p_room_code VARCHAR,
  p_nickname VARCHAR,
  p_session_token UUID,
  p_avatar_url TEXT DEFAULT NULL,
  p_is_organizer BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_participant participants%ROWTYPE;
  v_clean_code VARCHAR;
  v_clean_nick VARCHAR;
BEGIN
  v_clean_code := UPPER(TRIM(p_room_code));
  v_clean_nick := TRIM(p_nickname);

  IF v_clean_code IS NULL OR v_clean_code = '' THEN
    RAISE EXCEPTION 'Código da sala não informado.' USING ERRCODE = 'P0001';
  END IF;

  IF v_clean_nick IS NULL OR v_clean_nick = '' THEN
    RAISE EXCEPTION 'Apelido não informado.' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Buscar a sala pelo código
  SELECT * INTO v_room
  FROM rooms
  WHERE UPPER(code) = v_clean_code;

  -- Se a sala não existir no banco, cria automaticamente!
  IF NOT FOUND THEN
    INSERT INTO rooms (
      code,
      name,
      status,
      voting_open,
      created_at
    ) VALUES (
      v_clean_code,
      'Sala ' || v_clean_code,
      'active',
      FALSE,
      NOW()
    )
    RETURNING * INTO v_room;
  END IF;

  IF v_room.status = 'closed' THEN
    -- Reativa a sala se alguém estiver reconectando/recriando
    UPDATE rooms SET status = 'active' WHERE id = v_room.id RETURNING * INTO v_room;
  END IF;

  -- 2. Verificar se o participante já existe nesta sala pelo session_token (Reconexão)
  SELECT * INTO v_participant
  FROM participants
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF FOUND THEN
    IF v_participant.nickname <> v_clean_nick THEN
      IF NOT EXISTS (
        SELECT 1 FROM participants 
        WHERE room_id = v_room.id 
          AND LOWER(nickname) = LOWER(v_clean_nick) 
          AND id <> v_participant.id
      ) THEN
        v_participant.nickname := v_clean_nick;
      END IF;
    END IF;

    UPDATE participants
    SET 
      nickname = v_participant.nickname,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      last_active_at = NOW(),
      is_organizer = CASE WHEN p_is_organizer THEN TRUE ELSE is_organizer END
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;

    RETURN jsonb_build_object(
      'reconnected', TRUE,
      'participant', to_jsonb(v_participant),
      'room', to_jsonb(v_room)
    );
  END IF;

  -- 3. Novo participante: verificar se o apelido já está em uso na sala por outro participante
  IF EXISTS (
    SELECT 1 FROM participants 
    WHERE room_id = v_room.id AND LOWER(nickname) = LOWER(v_clean_nick)
  ) THEN
    -- Se apelido colidir, adiciona um sufixo numérico aleatório em vez de erro para não travar a festa
    v_clean_nick := v_clean_nick || ' ' || floor(random() * 90 + 10)::TEXT;
  END IF;

  -- 4. Inserir novo participante
  INSERT INTO participants (
    room_id,
    nickname,
    session_token,
    avatar_url,
    is_organizer,
    joined_at,
    last_active_at
  ) VALUES (
    v_room.id,
    v_clean_nick,
    p_session_token,
    p_avatar_url,
    p_is_organizer,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'reconnected', FALSE,
    'participant', to_jsonb(v_participant),
    'room', to_jsonb(v_room)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_join_room(VARCHAR, VARCHAR, UUID, TEXT, BOOLEAN) TO anon, authenticated, service_role;

-- 4. RPC `rpc_leave_and_cleanup_room`
-- Executado quando um participante desconecta ou sai.
-- Se não restar mais nenhum participante na sala, a sala é excluída atomicamente do Supabase (com CASCADE em fila, notas e pódio).
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
  v_deleted BOOLEAN := FALSE;
BEGIN
  -- 1. Remove o participante especificado
  IF p_participant_id IS NOT NULL THEN
    DELETE FROM public.participants
    WHERE id = p_participant_id AND room_id = p_room_id;
  END IF;

  -- 2. Conta quantos participantes restaram na sala
  SELECT COUNT(*) INTO v_remaining
  FROM public.participants
  WHERE room_id = p_room_id;

  -- 3. Se não houver mais ninguém (0 participantes restantes), exclui a sala do banco de dados!
  IF v_remaining = 0 THEN
    DELETE FROM public.rooms WHERE id = p_room_id;
    v_deleted := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'remaining_participants', v_remaining,
    'room_deleted', v_deleted
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_leave_and_cleanup_room(UUID, UUID) TO anon, authenticated, service_role;

-- 5. RPC `rpc_delete_room`
-- Permite que o organizador encerre e exclua a sala deliberadamente do Supabase.
CREATE OR REPLACE FUNCTION public.rpc_delete_room(
  p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rooms WHERE id = p_room_id;
  RETURN jsonb_build_object('success', TRUE, 'message', 'Sala excluída com sucesso do banco de dados');
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_delete_room(UUID) TO anon, authenticated, service_role;

-- 6. RPC `rpc_cleanup_empty_rooms`
-- Rotina de limpeza periódica ou disparada por heartbeat para expirar salas abandonadas
CREATE OR REPLACE FUNCTION public.rpc_cleanup_empty_rooms()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INT := 0;
BEGIN
  -- 1. Remove participantes inativos há mais de 10 minutos
  DELETE FROM public.participants
  WHERE last_active_at < NOW() - INTERVAL '10 minutes';

  -- 2. Exclui salas que ficaram vazias (sem participantes) e foram criadas há mais de 2 minutos
  WITH deleted_rooms AS (
    DELETE FROM public.rooms r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.participants p WHERE p.room_id = r.id
    )
    AND r.created_at < NOW() - INTERVAL '2 minutes'
    RETURNING r.id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_rooms;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_rooms_count', v_deleted_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_cleanup_empty_rooms() TO anon, authenticated, service_role;
