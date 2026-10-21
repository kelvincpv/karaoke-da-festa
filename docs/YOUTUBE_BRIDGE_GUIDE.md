# Guia de Instalação e Uso — Karaokê Bridge (Extensão Chrome)

> **Karaokê da Festa**  
> Solução Híbrida de Reprodução para Músicas com Restrição de Incorporação (Erro 150 / 101)  
> Integração Oficial com **YouTube Premium** sem anúncios.

---

## 1. Por que o Karaokê Bridge é Necessário?

Determinadas faixas e canais parceiros de gravadoras (ex.: Sing King, Universal Music, Sony Music, Vevo) bloqueiam a incorporação de seus vídeos em sites de terceiros via `<iframe>` comum, retornando os erros:
- **Erro 150:** *Playback on other websites has been disabled by the video owner.*
- **Erro 101:** *Embedding disabled by request.*

O **Karaokê Bridge** é uma extensão Manifest V3 para Google Chrome que viabiliza a reprodução dessas músicas na página oficial do YouTube (`https://www.youtube.com/watch?v=...`) em uma janela popup limpa e perfeitamente posicionada sobre a TV/Projetor, utilizando a sua conta **YouTube Premium** autenticada para garantir uma festa sem comerciais e com sincronização total de fila, lower third e avaliação dos convidados.

---

## 2. Passo a Passo de Instalação no Chrome (Notebook do Organizador)

> [!NOTE]
> A extensão precisa ser instalada **apenas no notebook do organizador**.  
> Os participantes no celular ou na TV não precisam instalar nada!

1. Abra o **Google Chrome** no notebook do organizador.
2. Certifique-se de estar conectado com sua **conta Google assinante do YouTube Premium** no Chrome.
3. Digite na barra de endereços:
   ```text
   chrome://extensions
   ```
4. No canto superior direito, ative a chave seletora **Modo do desenvolvedor** (*Developer Mode*).
5. No canto superior esquerdo, clique no botão **Carregar sem compactação** (*Load unpacked*).
6. Na janela de seleção de pastas, selecione o diretório:
   ```text
   C:\Users\conta\karaoke-da-festa\chrome-extension
   ```
7. Pronto! A extensão **Karaokê Bridge — Karaokê da Festa** (v1.0.0) será listada e ativada imediatamente.

---

## 3. Configuração do Cenário com Projetor Magcubic HY320 (HDMI)

Para a melhor experiência visual e de controle:

1. Conecte o cabo HDMI do projetor **Magcubic HY320** ao notebook.
2. No Windows, pressione as teclas `Windows + P` e selecione **Estender** (*Extend*).
3. Abra duas abas no Chrome:
   - **Monitor 1 (Tela do Notebook):**  
     Acesse o Painel do Organizador:
     ```text
     https://karaoke.kelvinmoreira.com.br/organizador/FESTA48
     ```
   - **Monitor 2 (Projetor Magcubic HY320):**  
     Arraste a janela para o projetor e acesse o Modo TV em tela cheia (`F11`):
     ```text
     https://karaoke.kelvinmoreira.com.br/tv/FESTA48
     ```

4. Quando uma música com bloqueio for reproduzida:
   - O Karaokê Bridge calcula as coordenadas exatas da tela do projetor (`screenX + rect.left`, `screenY + rect.top`) e abre a janela do YouTube sobre o telão.
   - O lower third com o nome de quem está cantando e a próxima música continua visível.
   - Os emojis enviados pelos convidados continuam flutuando na TV.

---

## 4. Ciclo de Reprodução e Finalização Automática

1. **Início do Show:** A música inicia no YouTube Premium sem anúncios. O Karaokê Bridge desativa o botão de autoplay ("Próximo vídeo") do YouTube.
2. **Monitoramento:** O content script escuta o elemento nativo `<video>` do YouTube via evento `ended` e contagem regressiva de segurança.
3. **Fim da Apresentação:**
   - O vídeo é pausado imediatamente.
   - O evento `VIDEO_ENDED` é despachado para o Karaokê da Festa.
   - A janela popup do YouTube fecha suavemente.
   - O telão abre a contagem regressiva de **10 segundos de avaliação com barra de progresso**.
   - Os celulares dos convidados vibram com a tela de votação (1 a 5 estrelas).
   - Ao término dos 10 segundos, a próxima música da fila assume o palco automaticamente.

---

## 5. Controles de Contingência (Painel do Organizador)

No painel `/organizer/:code`:
- **Badge de Status:**
  - 🟢 **Bridge Pronta:** Extensão ativa e comunicando com o sistema.
  - 🟡 **Bridge Ativa:** Vídeo atualmente em reprodução na janela do YouTube.
  - ⚪ **Bridge Offline:** Extensão desativada ou não carregada no navegador.
- **Botão "Reproduzir via Karaokê Bridge":** Permite forçar a abertura de qualquer vídeo via Bridge caso a incorporação falhe.
- **Botão "Fechar Janela do Karaokê Bridge":** Fecha a janela popup a qualquer momento caso queira retomar o controle manual.
- **Botão "Pular Música":** Avança para a próxima música e fecha janelas ativas instantaneamente.
