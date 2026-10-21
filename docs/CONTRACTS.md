# Karaokê da Festa — Contratos de Dados e API

## 1. Esquema de Entidades (PostgreSQL / Supabase)

### 1.1 `rooms`
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL, -- ex: "FESTA1"
  name VARCHAR(100) NOT NULL,
  organizer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  current_queue_id UUID, -- aponta para queue_items.id atual
  voting_open BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{
    "max_songs_per_user": 3,
    "allow_duets": true,
    "vote_duration_seconds": 30,
    "auto_play": false
  }'::jsonb
);
```

### 1.2 `participants`
```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  session_token UUID NOT NULL, -- gerado no browser e persistido no localStorage
  avatar_url TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_nick_per_room UNIQUE (room_id, nickname)
);
```

### 1.3 `queue_items`
```sql
CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  youtube_video_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  channel_title VARCHAR(150),
  thumbnail_url TEXT,
  duration_seconds INT DEFAULT 0,
  singer_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  duet_singer_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'current', 'completed', 'skipped')),
  order_index INT NOT NULL DEFAULT 0,
  is_priority BOOLEAN DEFAULT FALSE, -- organizador pode dar prioridade
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.4 `ratings`
```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  voter_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_vote_per_participant UNIQUE (queue_item_id, voter_participant_id)
);
```

### 1.5 `performances` (Resultados Consolidados)
```sql
CREATE TABLE performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  singer_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  duet_singer_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  song_title VARCHAR(255) NOT NULL,
  average_stars NUMERIC(3,2) DEFAULT 0.00,
  total_votes INT DEFAULT 0,
  score_points INT DEFAULT 0, -- ex: stars * 100 + total_votes * 10
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Tipos TypeScript Compartilhados (`src/types/karaoke.ts`)

```typescript
export type RoomStatus = 'active' | 'paused' | 'closed';
export type QueueItemStatus = 'pending' | 'current' | 'completed' | 'skipped';

export interface RoomSettings {
  max_songs_per_user: number;
  allow_duets: boolean;
  vote_duration_seconds: number;
  auto_play: boolean;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  organizer_id?: string;
  status: RoomStatus;
  current_queue_id?: string | null;
  voting_open: boolean;
  settings: RoomSettings;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  nickname: string;
  session_token: string;
  avatar_url?: string;
  is_organizer: boolean;
  joined_at: string;
  last_active_at: string;
}

export interface QueueItem {
  id: string;
  room_id: string;
  youtube_video_id: string;
  title: string;
  channel_title?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  singer_id: string;
  duet_singer_id?: string | null;
  status: QueueItemStatus;
  order_index: number;
  is_priority: boolean;
  created_at: string;
  // Joins
  singer?: Participant;
  duet_singer?: Participant | null;
}

export interface Rating {
  id: string;
  room_id: string;
  queue_item_id: string;
  voter_participant_id: string;
  stars: number; // 1 to 5
  created_at: string;
}

export interface PerformanceResult {
  id: string;
  room_id: string;
  queue_item_id: string;
  singer_id: string;
  duet_singer_id?: string | null;
  song_title: string;
  average_stars: number;
  total_votes: number;
  score_points: number;
  completed_at: string;
  singer?: Participant;
  duet_singer?: Participant;
}

export interface ParticipantRanking {
  participant_id: string;
  nickname: string;
  total_points: number;
  songs_sung: number;
  average_stars: number;
}

export interface DuetRanking {
  duet_key: string; // e.g. sorted "id1:id2"
  singer1: Participant;
  singer2: Participant;
  total_points: number;
  songs_sung: number;
  average_stars: number;
}

export interface RealtimeReaction {
  id: string;
  room_id: string;
  sender_nickname: string;
  emoji: string; // '❤️' | '🔥' | '👏' | '🎉' | '⭐' | '🎤'
  timestamp: number;
}
```

---

## 3. RPCs Críticas (PostgreSQL / Supabase)

1. `rpc_join_room(p_room_code, p_nickname, p_session_token)`
   - Retorna o `participant` e a `room`.
   - Se já existir sessão ativa com o mesmo `session_token`, reconecta.
   - Garante apelido único por sala.

2. `rpc_add_to_queue(p_room_id, p_participant_id, p_youtube_video_id, p_title, p_channel, p_thumb, p_duration, p_duet_singer_id)`
   - Valida limite de músicas por participante nas configurações.
   - Calcula o próximo `order_index`.
   - Cria o item com status 'pending'.

3. `rpc_submit_rating(p_room_id, p_queue_item_id, p_voter_participant_id, p_stars)`
   - Valida que a votação está aberta (`rooms.voting_open = true`).
   - Valida que `voter_participant_id` NÃO é o `singer_id` nem o `duet_singer_id`.
   - Valida que `voter_participant_id` ainda não votou nesta música.
   - Insere a nota (1 a 5 estrelas).

4. `rpc_finish_performance(p_room_id, p_queue_item_id)`
   - Encerra a votação.
   - Calcula a média de estrelas e pontos (ex: média * 100 + votos * 10).
   - Insere em `performances`.
   - Atribui integralmente os pontos tanto ao cantor quanto ao integrante de dueto.
   - Atualiza `queue_items.status = 'completed'`.
   - Avança a fila para a próxima música caso configurado.

---

## 4. Supabase Realtime Channels
- **Canal da Sala:** `room:${roomId}`
  - Broadcast de reações: `{ event: 'reaction', payload: RealtimeReaction }`
  - Broadcast de controle: `{ event: 'playback_command', payload: { command: 'play'|'pause'|'skip', videoId?: string } }`
  - Postgres Changes:
    - `rooms` (status, current_queue_id, voting_open)
    - `queue_items` (insert, update, delete)
    - `ratings` (insert)
    - `participants` (insert)
