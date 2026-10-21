document.getElementById('testBridgeBtn')?.addEventListener('click', async () => {
  const resultDiv = document.getElementById('testResult');
  if (!resultDiv) return;

  resultDiv.style.display = 'block';
  resultDiv.textContent = 'Enviando ping para o Service Worker...';

  try {
    const response = await chrome.runtime.sendMessage({
      source: 'KARAOKE_APP',
      type: 'BRIDGE_PING',
      timestamp: Date.now(),
    });

    if (response?.type === 'BRIDGE_PONG') {
      resultDiv.textContent = `✅ Service Worker respondendo (v${response.payload?.version})!`;
      resultDiv.style.color = '#4ade80';
    } else {
      resultDiv.textContent = '⚠️ Resposta inesperada do Service Worker.';
      resultDiv.style.color = '#f59e0b';
    }
  } catch (err: any) {
    resultDiv.textContent = `❌ Erro: ${err.message}`;
    resultDiv.style.color = '#ef4444';
  }
});
