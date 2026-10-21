import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './pages/HomePage';
import { RoomParticipantPage } from './pages/RoomParticipantPage';
import { OrganizerPage } from './pages/OrganizerPage';
import { TvModePage } from './pages/TvModePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* '/' -> Home / Entrada da Sala (código ou criar sala) */}
          <Route path="/" element={<HomePage />} />

          {/* '/room/:code' -> Participante Mobile (Fila, Busca YouTube, Duetos, Votação, Reações, Ranking) */}
          <Route path="/room/:code" element={<RoomParticipantPage />} />

          {/* '/organizer/:code' -> Painel do Organizador (Controle da fila, player e moderação) */}
          <Route path="/organizer/:code" element={<OrganizerPage />} />

          {/* '/tv/:code' -> Telão / TV Mode (Player YouTube, QR code, reações flutuantes, votação) */}
          <Route path="/tv/:code" element={<TvModePage />} />

          {/* Fallback para rotas desconhecidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
