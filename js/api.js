const API_BASE = 'https://script.google.com/macros/s/AKfycbz4Jz4uemJ1CsgKCODbz8-8liWbtbsCMZXhkd0u28BlLVJGP1XE5P5wJtmRbijGg5ua/exec';

async function listarEscolasPorSupervisor(email) {
  const resp = await fetch(`${API_BASE}?acao=listarEscolasPorSupervisor&email=${encodeURIComponent(email)}`);
  if (!resp.ok) throw new Error('Erro ao listar escolas do supervisor');
  return resp.json();
}

async function listarItens(modulo = 'todos') {
  const resp = await fetch(`${API_BASE}?acao=listarItens&modulo=${modulo}`);
  return resp.json();
}

async function listarRecomendacoes() {
  const resp = await fetch(`${API_BASE}?acao=listarRecomendacoes`);
  if (!resp.ok) throw new Error('Erro ao buscar recomendações');
  return resp.json();
}

async function salvarVisitaRemoto(visita) {
  const payload = { acao: 'salvarVisita', ...visita };
  const resp = await fetch(API_BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  return resp.json(); // corrigido: retorna o resultado da requisição
}

async function anexarEvidencia(visitaId, itemId, arquivoBase64, nomeArquivo, mimeType) {
  const resp = await fetch(API_BASE, {
    method: 'POST',
    body: JSON.stringify({
      acao: 'anexarEvidencia',
      visita_id: visitaId,
      item_id: itemId,
      arquivo_base64: arquivoBase64,
      nome_arquivo: nomeArquivo,
      mimeType
    }),
    headers: { 'Content-Type': 'application/json' }
  });
  return resp.json();
}