-- ==============================================================================
-- KARAOKÊ DA FESTA — MIGRATION 001: INITIAL SCHEMA, RPCs & RLS POLICIES
-- Compatível com Supabase / PostgreSQL 14+
-- ==============================================================================

-- 0. EXTENSÕES & SETUP INICIAL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mock schema auth caso executado fora do ambiente Supabase padrão
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255)
    );
  END IF;
END $$;

-- ==============================================================================
-- 1. TABELAS PRINCIPAIS
-- ==============================================================================

-- 1.1 Tabela `rooms` (Salas de Karaokê)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  organizer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  current_queue_id UUID, -- Chave estrangeira adicionada após criação de queue_items
  voting_open BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{
    "max_songs_per_user": 3,
    "allow_duets": true,
    "vote_duration_seconds": 30,
    "auto_play": false
  }'::jsonb,
  CONSTRAINT check_room_code_len CHECK (char_length(code) >= 3 AND char_length(code) <= 6)
);

-- 1.2 Tabela `participants` (Participantes da Sala)
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  session_token UUID NOT NULL,
  avatar_url TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_nick_per_room UNIQUE (room_id, nickname),
  CONSTRAINT unique_session_per_room UNIQUE (room_id, session_token)
);

-- 1.3 Tabela `queue_items` (Fila de Apresentações de Músicas)
CREATE TABLE IF NOT EXISTS public.queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  youtube_video_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  channel_title VARCHAR(150),
  thumbnail_url TEXT,
  duration_seconds INT DEFAULT 0,
  singer_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  duet_singer_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'skipped')),
  order_index INT NOT NULL DEFAULT 0,
  is_priority BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_diff_duet_singer CHECK (duet_singer_id IS NULL OR duet_singer_id <> singer_id)
);

-- 1.4 Adição da constraint de FK circular em `rooms.current_queue_id`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_rooms_current_queue' AND table_name = 'rooms'
  ) THEN
    ALTER TABLE public.rooms 
      ADD CONSTRAINT fk_rooms_current_queue 
      FOREIGN KEY (current_queue_id) 
      REFERENCES public.queue_items(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- 1.5 Tabela `ratings` (Votos e Notas dos Participantes)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
  voter_participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_vote_per_participant UNIQUE (queue_item_id, voter_participant_id)
);

-- 1.6 Tabela `performances` (Resultados Consolidados de Apresentações)
CREATE TABLE IF NOT EXISTS public.performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
  singer_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  duet_singer_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  song_title VARCHAR(255) NOT NULL,
  average_stars NUMERIC(3,2) DEFAULT 0.00,
  total_votes INT DEFAULT 0,
  score_points INT DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_performance_per_queue_item UNIQUE (queue_item_id),
  CONSTRAINT check_diff_performance_duet CHECK (duet_singer_id IS NULL OR duet_singer_id <> singer_id)
);

-- ==============================================================================
-- 2. ÍNDICES DE PERFORMANCE E CONSULTAS FREQUENTES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_rooms_code_upper ON public.rooms (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON public.participants (room_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON public.participants (room_id, session_token);
CREATE INDEX IF NOT EXISTS idx_participants_active ON public.participants (room_id, last_active_at);

CREATE INDEX IF NOT EXISTS idx_queue_items_room_status_order ON public.queue_items (room_id, status, is_priority DESC, order_index ASC);
CREATE INDEX IF NOT EXISTS idx_queue_items_singer ON public.queue_items (singer_id);
CREATE INDEX IF NOT EXISTS idx_queue_items_duet ON public.queue_items (duet_singer_id);

CREATE INDEX IF NOT EXISTS idx_ratings_queue_item ON public.ratings (queue_item_id);
CREATE INDEX IF NOT EXISTS idx_ratings_room_voter ON public.ratings (room_id, voter_participant_id);

CREATE INDEX IF NOT EXISTS idx_performances_room ON public.performances (room_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_performances_singer ON public.performances (singer_id);
CREATE INDEX IF NOT EXISTS idx_performances_duet ON public.performances (duet_singer_id);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) & POLÍTICAS
-- ==============================================================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performances ENABLE ROW LEVEL SECURITY;

-- 3.1 Políticas para `rooms`
DROP POLICY IF EXISTS "rooms_select_all" ON public.rooms;
CREATE POLICY "rooms_select_all" ON public.rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "rooms_insert_all" ON public.rooms;
CREATE POLICY "rooms_insert_all" ON public.rooms
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_update_organizer" ON public.rooms;
CREATE POLICY "rooms_update_organizer" ON public.rooms
  FOR UPDATE USING (
    organizer_id IS NULL 
    OR organizer_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.participants p 
      WHERE p.room_id = rooms.id AND p.is_organizer = TRUE
    )
  ) WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_delete_organizer" ON public.rooms;
CREATE POLICY "rooms_delete_organizer" ON public.rooms
  FOR DELETE USING (
    organizer_id IS NOT NULL AND organizer_id = auth.uid()
  );

-- 3.2 Políticas para `participants`
DROP POLICY IF EXISTS "participants_select_all" ON public.participants;
CREATE POLICY "participants_select_all" ON public.participants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "participants_insert_all" ON public.participants;
CREATE POLICY "participants_insert_all" ON public.participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "participants_update_all" ON public.participants;
CREATE POLICY "participants_update_all" ON public.participants
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "participants_delete_all" ON public.participants;
CREATE POLICY "participants_delete_all" ON public.participants
  FOR DELETE USING (true);

-- 3.3 Políticas para `queue_items`
DROP POLICY IF EXISTS "queue_items_select_all" ON public.queue_items;
CREATE POLICY "queue_items_select_all" ON public.queue_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "queue_items_insert_all" ON public.queue_items;
CREATE POLICY "queue_items_insert_all" ON public.queue_items
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "queue_items_update_all" ON public.queue_items;
CREATE POLICY "queue_items_update_all" ON public.queue_items
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "queue_items_delete_all" ON public.queue_items;
CREATE POLICY "queue_items_delete_all" ON public.queue_items
  FOR DELETE USING (true);

-- 3.4 Políticas para `ratings`
DROP POLICY IF EXISTS "ratings_select_all" ON public.ratings;
CREATE POLICY "ratings_select_all" ON public.ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ratings_insert_all" ON public.ratings;
CREATE POLICY "ratings_insert_all" ON public.ratings
  FOR INSERT WITH CHECK (true);

-- 3.5 Políticas para `performances`
DROP POLICY IF EXISTS "performances_select_all" ON public.performances;
CREATE POLICY "performances_select_all" ON public.performances
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "performances_insert_all" ON public.performances;
CREATE POLICY "performances_insert_all" ON public.performances
  FOR INSERT WITH CHECK (true);

-- Concessão de permissões explícitas aos roles Supabase (anon e authenticated)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- ==============================================================================
-- 4. STORED PROCEDURES / RPCs EM PL/pgSQL
-- ==============================================================================

-- 4.1 `rpc_join_room`
-- Entrada de participante em uma sala existente ou reconexão por session_token.
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala com o código "%" não foi encontrada.', v_clean_code USING ERRCODE = 'P0002';
  END IF;

  IF v_room.status = 'closed' THEN
    RAISE EXCEPTION 'Esta sala já foi encerrada.' USING ERRCODE = 'P0003';
  END IF;

  -- 2. Verificar se o participante já existe nesta sala pelo session_token (Reconexão)
  SELECT * INTO v_participant
  FROM participants
  WHERE room_id = v_room.id AND session_token = p_session_token;

  IF FOUND THEN
    -- Atualiza último acesso e apelido/avatar se possível
    IF v_participant.nickname <> v_clean_nick THEN
      -- Se tentou mudar o apelido, valida se outro participante já não o possui
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

  -- 3. Novo participante: verificar se o apelido já está em uso na sala
  IF EXISTS (
    SELECT 1 FROM participants 
    WHERE room_id = v_room.id AND LOWER(nickname) = LOWER(v_clean_nick)
  ) THEN
    RAISE EXCEPTION 'O apelido "%" já está em uso nesta sala. Por favor, escolha outro.', v_clean_nick USING ERRCODE = '23505';
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

-- 4.2 `rpc_add_to_queue`
-- Adiciona uma música à fila da sala com cálculo sequencial de order_index.
CREATE OR REPLACE FUNCTION public.rpc_add_to_queue(
  p_room_id UUID,
  p_participant_id UUID,
  p_youtube_video_id VARCHAR,
  p_title VARCHAR,
  p_channel VARCHAR DEFAULT NULL,
  p_thumb TEXT DEFAULT NULL,
  p_duration INT DEFAULT 0,
  p_duet_singer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_singer participants%ROWTYPE;
  v_duet_singer participants%ROWTYPE;
  v_max_songs INT;
  v_allow_duets BOOLEAN;
  v_user_pending_count INT;
  v_next_order INT;
  v_new_item queue_items%ROWTYPE;
BEGIN
  -- 1. Validar existência da sala
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_room.status = 'closed' THEN
    RAISE EXCEPTION 'Esta sala já foi encerrada.' USING ERRCODE = 'P0003';
  END IF;

  -- 2. Validar cantor principal
  SELECT * INTO v_singer FROM participants WHERE id = p_participant_id AND room_id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participante cantor não encontrado nesta sala.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validar dueto (se informado)
  v_allow_duets := COALESCE((v_room.settings->>'allow_duets')::BOOLEAN, TRUE);
  IF p_duet_singer_id IS NOT NULL THEN
    IF NOT v_allow_duets THEN
      RAISE EXCEPTION 'Duetos não são permitidos nesta sala.' USING ERRCODE = 'P0004';
    END IF;

    IF p_duet_singer_id = p_participant_id THEN
      RAISE EXCEPTION 'O parceiro de dueto não pode ser você mesmo.' USING ERRCODE = 'P0005';
    END IF;

    SELECT * INTO v_duet_singer FROM participants WHERE id = p_duet_singer_id AND room_id = p_room_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participante para dueto não encontrado nesta sala.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 4. Validar limite de músicas ativas por usuário
  v_max_songs := COALESCE((v_room.settings->>'max_songs_per_user')::INT, 3);
  SELECT COUNT(*) INTO v_user_pending_count
  FROM queue_items
  WHERE room_id = p_room_id 
    AND (singer_id = p_participant_id OR duet_singer_id = p_participant_id)
    AND status IN ('pending', 'current');

  IF v_user_pending_count >= v_max_songs THEN
    RAISE EXCEPTION 'Você atingiu o limite de % música(s) na fila simultaneamente.', v_max_songs USING ERRCODE = 'P0006';
  END IF;

  -- 5. Calcular próximo order_index de maneira atômica e sequencial
  SELECT COALESCE(MAX(order_index), 0) + 1 INTO v_next_order
  FROM queue_items
  WHERE room_id = p_room_id;

  -- 6. Inserir item na fila
  INSERT INTO queue_items (
    room_id,
    youtube_video_id,
    title,
    channel_title,
    thumbnail_url,
    duration_seconds,
    singer_id,
    duet_singer_id,
    status,
    order_index,
    is_priority,
    created_at
  ) VALUES (
    p_room_id,
    TRIM(p_youtube_video_id),
    TRIM(p_title),
    TRIM(p_channel),
    p_thumb,
    COALESCE(p_duration, 0),
    p_participant_id,
    p_duet_singer_id,
    'pending',
    v_next_order,
    FALSE,
    NOW()
  )
  RETURNING * INTO v_new_item;

  RETURN jsonb_build_object(
    'queue_item', to_jsonb(v_new_item),
    'order_index', v_next_order,
    'singer_nickname', v_singer.nickname,
    'duet_nickname', v_duet_singer.nickname
  );
END;
$$;

-- 4.3 `rpc_submit_rating`
-- Submissão de avaliação de 1 a 5 estrelas com validações estritas de segurança.
CREATE OR REPLACE FUNCTION public.rpc_submit_rating(
  p_room_id UUID,
  p_queue_item_id UUID,
  p_voter_participant_id UUID,
  p_stars INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_item queue_items%ROWTYPE;
  v_voter participants%ROWTYPE;
  v_new_rating ratings%ROWTYPE;
  v_total_votes INT;
  v_avg_stars NUMERIC(3,2);
BEGIN
  -- 1. Validar nota entre 1 e 5 estrelas
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'A nota de avaliação deve ser de 1 a 5 estrelas.' USING ERRCODE = '22003';
  END IF;

  -- 2. Validar sala e estado de votação aberta
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_room.voting_open THEN
    RAISE EXCEPTION 'A votação para esta música não está aberta no momento.' USING ERRCODE = 'P0007';
  END IF;

  -- 3. Validar item da fila
  SELECT * INTO v_item FROM queue_items WHERE id = p_queue_item_id AND room_id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apresentação não encontrada nesta sala.' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Validar participante votante
  SELECT * INTO v_voter FROM participants WHERE id = p_voter_participant_id AND room_id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participante votante não pertence a esta sala.' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Impedir voto na própria apresentação (cantor ou par de dueto)
  IF p_voter_participant_id = v_item.singer_id THEN
    RAISE EXCEPTION 'O cantor não pode votar na sua própria apresentação.' USING ERRCODE = 'P0008';
  END IF;

  IF v_item.duet_singer_id IS NOT NULL AND p_voter_participant_id = v_item.duet_singer_id THEN
    RAISE EXCEPTION 'Membros do dueto não podem votar na própria apresentação.' USING ERRCODE = 'P0008';
  END IF;

  -- 6. Garantir voto único por participante
  IF EXISTS (
    SELECT 1 FROM ratings 
    WHERE queue_item_id = p_queue_item_id AND voter_participant_id = p_voter_participant_id
  ) THEN
    RAISE EXCEPTION 'Você já enviou seu voto para esta apresentação.' USING ERRCODE = '23505';
  END IF;

  -- 7. Registrar avaliação
  INSERT INTO ratings (
    room_id,
    queue_item_id,
    voter_participant_id,
    stars,
    created_at
  ) VALUES (
    p_room_id,
    p_queue_item_id,
    p_voter_participant_id,
    p_stars,
    NOW()
  )
  RETURNING * INTO v_new_rating;

  -- 8. Calcular parciais atualizadas
  SELECT 
    COUNT(*),
    COALESCE(ROUND(AVG(stars)::NUMERIC, 2), 0.00)
  INTO v_total_votes, v_avg_stars
  FROM ratings
  WHERE queue_item_id = p_queue_item_id;

  RETURN jsonb_build_object(
    'rating', to_jsonb(v_new_rating),
    'total_votes', v_total_votes,
    'average_stars', v_avg_stars
  );
END;
$$;

-- 4.4 `rpc_finish_performance`
-- Finaliza a apresentação, fecha a votação, consolida a pontuação integral para cantor e dueto,
-- e atualiza a fila para a próxima música.
CREATE OR REPLACE FUNCTION public.rpc_finish_performance(
  p_room_id UUID,
  p_queue_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item queue_items%ROWTYPE;
  v_existing_perf performances%ROWTYPE;
  v_perf performances%ROWTYPE;
  v_total_votes INT;
  v_avg_stars NUMERIC(3,2);
  v_score_points INT;
  v_next_item queue_items%ROWTYPE;
BEGIN
  -- 1. Travar o item da fila para garantir atomicidade
  SELECT * INTO v_item 
  FROM queue_items 
  WHERE id = p_queue_item_id AND room_id = p_room_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da fila não encontrado nesta sala.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Fechar a votação imediatamente na sala
  UPDATE rooms
  SET voting_open = FALSE
  WHERE id = p_room_id;

  -- 3. Idempotência: se a performance já foi consolidada anteriormente, retorna o registro
  SELECT * INTO v_existing_perf
  FROM performances
  WHERE queue_item_id = p_queue_item_id;

  IF FOUND THEN
    IF v_item.status <> 'completed' THEN
      UPDATE queue_items SET status = 'completed' WHERE id = p_queue_item_id;
    END IF;

    RETURN jsonb_build_object(
      'performance', to_jsonb(v_existing_perf),
      'already_finished', TRUE
    );
  END IF;

  -- 4. Calcular média e total de votos
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(ROUND(AVG(stars)::NUMERIC, 2), 0.00)
  INTO v_total_votes, v_avg_stars
  FROM ratings
  WHERE queue_item_id = p_queue_item_id;

  -- 5. Cálculo da pontuação do show: (média * 100) + (total de votos * 10)
  IF v_total_votes > 0 THEN
    v_score_points := ROUND(v_avg_stars * 100)::INT + (v_total_votes * 10);
  ELSE
    v_score_points := 0;
  END IF;

  -- 6. Gravar performance consolidada
  -- A pontuação integral é registrada aqui. Na consulta de rankings, tanto o cantor principal
  -- quanto o parceiro de dueto recebem essa pontuação integralmente sem duplicação de eventos.
  INSERT INTO performances (
    room_id,
    queue_item_id,
    singer_id,
    duet_singer_id,
    song_title,
    average_stars,
    total_votes,
    score_points,
    completed_at
  ) VALUES (
    p_room_id,
    p_queue_item_id,
    v_item.singer_id,
    v_item.duet_singer_id,
    v_item.title,
    v_avg_stars,
    v_total_votes,
    v_score_points,
    NOW()
  )
  RETURNING * INTO v_perf;

  -- 7. Atualizar status do item para 'completed'
  UPDATE queue_items
  SET status = 'completed'
  WHERE id = p_queue_item_id;

  -- 8. Localizar a próxima música pendente na fila (prioridade desc, order_index asc)
  SELECT * INTO v_next_item
  FROM queue_items
  WHERE room_id = p_room_id AND status = 'pending'
  ORDER BY is_priority DESC, order_index ASC
  LIMIT 1;

  -- 9. Atualizar sala com o próximo id da fila
  UPDATE rooms
  SET 
    current_queue_id = v_next_item.id,
    voting_open = FALSE
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'performance', to_jsonb(v_perf),
    'next_queue_id', v_next_item.id,
    'next_song_title', v_next_item.title,
    'already_finished', FALSE
  );
END;
$$;

-- 4.5 `rpc_get_rankings`
-- Retorna os rankings da sala: Individual (soma de solos e duetos) e de Duplas.
CREATE OR REPLACE FUNCTION public.rpc_get_rankings(
  p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_individual JSONB;
  v_duets JSONB;
BEGIN
  -- 1. Ranking Individual
  -- Cada performance pontua integralmente para o cantor principal e para o membro do dueto
  WITH combined_performances AS (
    -- Pontos como cantor principal
    SELECT 
      p.singer_id AS participant_id,
      p.score_points,
      p.average_stars
    FROM performances p
    WHERE p.room_id = p_room_id

    UNION ALL

    -- Pontos como parceiro de dueto (pontuação integral idêntica)
    SELECT 
      p.duet_singer_id AS participant_id,
      p.score_points,
      p.average_stars
    FROM performances p
    WHERE p.room_id = p_room_id AND p.duet_singer_id IS NOT NULL
  ),
  aggregated_individual AS (
    SELECT 
      cp.participant_id,
      part.nickname,
      part.avatar_url,
      COALESCE(SUM(cp.score_points), 0)::INT AS total_points,
      COUNT(*)::INT AS songs_sung,
      COALESCE(ROUND(AVG(cp.average_stars)::NUMERIC, 2), 0.00) AS average_stars
    FROM combined_performances cp
    JOIN participants part ON part.id = cp.participant_id
    GROUP BY cp.participant_id, part.nickname, part.avatar_url
    ORDER BY total_points DESC, average_stars DESC, songs_sung DESC
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(ai)), '[]'::jsonb)
  INTO v_individual
  FROM aggregated_individual ai;

  -- 2. Ranking de Duplas (Duetos)
  -- Normaliza a ordem dos dois IDs para agrupar a mesma dupla mesmo se inverterem quem escolheu
  WITH duet_performances AS (
    SELECT 
      p.id AS performance_id,
      p.score_points,
      p.average_stars,
      CASE 
        WHEN p.singer_id < p.duet_singer_id THEN p.singer_id 
        ELSE p.duet_singer_id 
      END AS first_id,
      CASE 
        WHEN p.singer_id < p.duet_singer_id THEN p.duet_singer_id 
        ELSE p.singer_id 
      END AS second_id
    FROM performances p
    WHERE p.room_id = p_room_id AND p.duet_singer_id IS NOT NULL
  ),
  aggregated_duets AS (
    SELECT 
      (dp.first_id::text || ':' || dp.second_id::text) AS duet_key,
      COALESCE(to_jsonb(p1), jsonb_build_object('id', dp.first_id, 'nickname', 'Participante')) AS singer1,
      COALESCE(to_jsonb(p2), jsonb_build_object('id', dp.second_id, 'nickname', 'Participante')) AS singer2,
      COALESCE(SUM(dp.score_points), 0)::INT AS total_points,
      COUNT(*)::INT AS songs_sung,
      COALESCE(ROUND(AVG(dp.average_stars)::NUMERIC, 2), 0.00) AS average_stars
    FROM duet_performances dp
    LEFT JOIN participants p1 ON p1.id = dp.first_id
    LEFT JOIN participants p2 ON p2.id = dp.second_id
    GROUP BY dp.first_id, dp.second_id, p1.id, p2.id
    ORDER BY total_points DESC, average_stars DESC, songs_sung DESC
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(ad)), '[]'::jsonb)
  INTO v_duets
  FROM aggregated_duets ad;

  RETURN jsonb_build_object(
    'individual', v_individual,
    'duets', v_duets
  );
END;
$$;

-- ==============================================================================
-- 4.6 RPCs AUXILIARES PARA PAINEL DO MODERADOR & DISPLAY TV
-- ==============================================================================

-- Definir a música atual e marcar na fila
CREATE OR REPLACE FUNCTION public.rpc_set_current_song(
  p_room_id UUID,
  p_queue_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reverter músicas que porventura estivessem como 'current' para 'completed' ou 'pending'
  UPDATE queue_items
  SET status = 'completed'
  WHERE room_id = p_room_id AND status = 'current' AND id <> p_queue_item_id;

  -- Ativar o item selecionado como 'current'
  UPDATE queue_items
  SET status = 'current'
  WHERE id = p_queue_item_id AND room_id = p_room_id;

  -- Atualizar a sala
  UPDATE rooms
  SET 
    current_queue_id = p_queue_item_id,
    voting_open = FALSE
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', TRUE, 'current_queue_id', p_queue_item_id);
END;
$$;

-- Alternar estado de votação (abrir / fechar)
CREATE OR REPLACE FUNCTION public.rpc_toggle_voting(
  p_room_id UUID,
  p_voting_open BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rooms
  SET voting_open = p_voting_open
  WHERE id = p_room_id;

  RETURN jsonb_build_object('success', TRUE, 'voting_open', p_voting_open);
END;
$$;

-- Reordenar fila pelo organizador
CREATE OR REPLACE FUNCTION public.rpc_reorder_queue(
  p_room_id UUID,
  p_queue_item_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_idx INT := 1;
BEGIN
  FOREACH v_id IN ARRAY p_queue_item_ids
  LOOP
    UPDATE queue_items
    SET order_index = v_idx
    WHERE id = v_id AND room_id = p_room_id;
    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'updated_count', v_idx - 1);
END;
$$;

-- ==============================================================================
-- 5. HABILITAÇÃO DO SUPABASE REALTIME
-- ==============================================================================

-- Configurar REPLICA IDENTITY FULL para broadcast de dados completos em UPDATEs
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.queue_items REPLICA IDENTITY FULL;
ALTER TABLE public.ratings REPLICA IDENTITY FULL;
ALTER TABLE public.performances REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação supabase_realtime de modo idempotente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'queue_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ratings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ratings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'performances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.performances;
  END IF;
END $$;
