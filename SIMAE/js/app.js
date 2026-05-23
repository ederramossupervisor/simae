let supervisorEmail = '';
let escolaSelecionada = null;
let itensGlobais = [];
let visitaAtual = { id: null, resultados: [], sincronizado: false };
let escolasSupervisor = []; // array global de escolas do supervisor logado
let dadosCarregados = false; // flag para evitar ações antes do carregamento

// ================= LOGIN =================
document.getElementById('btnLogin').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  if (!email || !email.includes('@')) {
    alert('Digite um e-mail institucional válido.');
    return;
  }
  supervisorEmail = email;
  await openDB();
  await buscarRecomendacoes();
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('nomeSupervisor').innerText = email.split('@')[0];
  await carregarEscolas(supervisorEmail);
};

document.getElementById('btnSair').onclick = () => {
  localStorage.clear();
  location.reload();
};

// ================= CARREGAR ESCOLAS DO SUPERVISOR =================
async function carregarEscolas(email) {
  try {
    const escolas = await listarEscolasPorSupervisor(email);
    escolasSupervisor = escolas; // armazena globalmente
    const select = document.getElementById('selectEscola');
    select.innerHTML = '<option value="">-- Selecione uma escola --</option>';
    for (let esc of escolas) {
      const opt = document.createElement('option');
      opt.value = esc.id;
      opt.textContent = `${esc.nome} (${esc.municipio})`;
      select.appendChild(opt);
    }

    select.onchange = () => {
      if (select.value) {
        escolaSelecionada = escolas.find(e => e.id == select.value);
        carregarItens();
      } else {
        document.getElementById('checklist-area').innerHTML = '';
        document.getElementById('botoes-finalizacao').style.display = 'none';
        document.getElementById('ice-area').innerHTML = '';
        escolaSelecionada = null;
      }
    };
    dadosCarregados = true;
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar escolas. Verifique sua conexão ou o backend.');
  }
}

// ================= CARREGAR CHECKLIST =================
async function carregarItens() {
  itensGlobais = await listarItens('todos');
  const area = document.getElementById('checklist-area');
  area.innerHTML = '';
  const modulos = [...new Set(itensGlobais.map(i => i.modulo))].sort();
  for (let mod of modulos) {
    const modDiv = document.createElement('div');
    modDiv.className = 'modulo';
    modDiv.innerHTML = `<h3>Módulo ${mod}</h3>`;
    const itensMod = itensGlobais.filter(i => i.modulo === mod);
    for (let item of itensMod) {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.itemId = item.id;
      card.innerHTML = `
        <strong>${item.id}</strong> - ${item.descricao_normativa}<br>
        <small>📚 ${item.referencia_legal} | ⚠️ Risco: ${item.risco} | Impacto: ${item.impacto}</small>
        <select class="status-select">
          <option value="conforme">✅ Conforme</option>
          <option value="parcial">⚠️ Parcial</option>
          <option value="nao_conforme">❌ Não conforme</option>
          <option value="nao_aplicavel">⭕ Não se aplica</option>
        </select>
        <div class="evidencias">
          <label>📎 Evidências (foto/PDF):</label>
          <input type="file" class="evidence-file" multiple accept="image/*,application/pdf">
        </div>
        <textarea class="obs" rows="2" placeholder="Observações específicas..."></textarea>
      `;
      modDiv.appendChild(card);
    }
    area.appendChild(modDiv);
  }
  document.getElementById('botoes-finalizacao').style.display = 'flex';

  // Listeners para ICE e recomendações
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', () => {
      const resultados = coletarResultados();
      atualizarExibicaoICE(resultados, itensGlobais);
      const card = select.closest('.item-card');
      const itemId = card.dataset.itemId;
      let recDiv = card.querySelector('.recomendacao');
      if (select.value === 'nao_conforme') {
        if (!recDiv) {
          recDiv = document.createElement('div');
          recDiv.className = 'recomendacao';
          card.appendChild(recDiv);
        }
        recDiv.innerHTML = exibirRecomendacao(itemId);
      } else {
        if (recDiv) recDiv.remove();
      }
    });
  });
}

function coletarResultados() {
  const cards = document.querySelectorAll('.item-card');
  const resultados = [];
  for (let card of cards) {
    const itemId = card.dataset.itemId;
    const statusSelect = card.querySelector('.status-select');
    const status = statusSelect ? statusSelect.value : 'nao_conforme';
    const obs = card.querySelector('.obs')?.value || '';
    resultados.push({ item_id: itemId, status, observacao: obs, evidencias: [] });
  }
  return resultados;
}

// ================= NOVA VISITA =================
document.getElementById('btnNovaVisita').onclick = () => {
  if (!dadosCarregados || escolasSupervisor.length === 0) {
    alert('Aguarde o carregamento das escolas ou recarregue a página.');
    return;
  }
  visitaAtual = { id: null, resultados: [] };
  const selectEscola = document.getElementById('selectEscola');
  if (selectEscola.value) {
    selectEscola.dispatchEvent(new Event('change'));
  } else {
    alert('Selecione uma escola antes de iniciar uma nova visita.');
  }
};

// ================= SALVAR RASCUNHO (OFFLINE) =================
document.getElementById('btnSalvarLocal').onclick = async () => {
  if (!escolaSelecionada) {
    alert('Selecione uma escola primeiro.');
    return;
  }
  const resultados = coletarResultados();
  const novaVisita = {
    id: visitaAtual.id || generateUUID(),
    data_visita: getTodayISO(),
    sre: 'Afonso Cláudio',
    supervisor_email: supervisorEmail,
    escola_id: escolaSelecionada.id,
    tipo_monitoramento: document.getElementById('selectTipoVisita').value,
    status: 'rascunho',
    resultados,
    sync: false
  };
  await salvarVisitaOffline(novaVisita);
  alert('Rascunho salvo localmente. Sincronize quando estiver online.');
  visitaAtual.id = novaVisita.id;
};

// ================= SINCRONIZAR =================
document.getElementById('btnSincronizar').onclick = async () => {
  if (!escolaSelecionada) {
    alert('Selecione uma escola.');
    return;
  }
  const resultados = coletarResultados();
  const visita = {
    visita_id: visitaAtual.id || generateUUID(),
    data_visita: getTodayISO(),
    sre: 'Afonso Cláudio',
    supervisor_email: supervisorEmail,
    escola_id: escolaSelecionada.id,
    tipo_monitoramento: document.getElementById('selectTipoVisita').value,
    status: 'finalizada',
    resultados
  };
  try {
    const resp = await salvarVisitaRemoto(visita);
    if (resp.success) {
      alert(`Visita sincronizada! ID: ${resp.visita_id}\nRelatório PDF será gerado.`);
      if (visitaAtual.id) await excluirVisitaOffline(visitaAtual.id);
      window.location.reload();
    } else {
      alert('Erro ao sincronizar. Tente novamente.');
    }
  } catch (err) {
    console.error(err);
    alert('Falha de rede. Salve o rascunho e sincronize depois.');
  }
};

// ================= CARREGAR RASCUNHO =================
document.getElementById('btnCarregarVisita').onclick = async () => {
  if (!dadosCarregados) {
    alert('Aguarde o carregamento das escolas.');
    return;
  }
  const visitasOff = await getVisitasOffline();
  if (visitasOff.length === 0) {
    alert('Nenhum rascunho encontrado.');
    return;
  }
  const pendente = visitasOff[0];
  visitaAtual = pendente;

  // Buscar a escola correspondente no array global
  const escola = escolasSupervisor.find(e => e.id == pendente.escola_id);
  if (!escola) {
    alert('Escola do rascunho não encontrada na lista do supervisor. Pode ter sido removida ou alterada.');
    return;
  }
  escolaSelecionada = escola;
  const selectEscola = document.getElementById('selectEscola');
  // Verifica se a opção existe; se não, adiciona
  let optionExists = false;
  for (let i = 0; i < selectEscola.options.length; i++) {
    if (selectEscola.options[i].value == escola.id) {
      selectEscola.selectedIndex = i;
      optionExists = true;
      break;
    }
  }
  if (!optionExists) {
    const newOption = document.createElement('option');
    newOption.value = escola.id;
    newOption.textContent = `${escola.nome} (${escola.municipio})`;
    selectEscola.appendChild(newOption);
    selectEscola.value = escola.id;
  }
  // Força o change para carregar o checklist
  selectEscola.dispatchEvent(new Event('change'));

  setTimeout(() => {
    preencherResultadosSalvos(pendente.resultados);
    const resultadosAtuais = coletarResultados();
    atualizarExibicaoICE(resultadosAtuais, itensGlobais);
  }, 500);
};

function preencherResultadosSalvos(resultadosSalvos) {
  const cards = document.querySelectorAll('.item-card');
  for (let card of cards) {
    const itemId = card.dataset.itemId;
    const salvo = resultadosSalvos.find(r => r.item_id === itemId);
    if (salvo) {
      const select = card.querySelector('.status-select');
      if (select) select.value = salvo.status;
      const obs = card.querySelector('.obs');
      if (obs) obs.value = salvo.observacao || '';
      if (salvo.evidencias && salvo.evidencias.length) {
        const divEv = card.querySelector('.evidencias');
        const info = document.createElement('div');
        info.className = 'evidencias-info';
        info.innerHTML = `<small>📎 ${salvo.evidencias.length} evidência(s) anexada(s) anteriormente</small>`;
        divEv.appendChild(info);
      }
      if (salvo.status === 'nao_conforme') {
        const evt = new Event('change');
        select.dispatchEvent(evt);
      }
    }
  }
}

// ================= ICE E RECOMENDAÇÕES =================
function calcularICECompleto(resultados, itens) {
  const modulos = {};
  let somaPonderadaTotal = 0, pesoTotal = 0;
  for (let res of resultados) {
    if (res.status === 'nao_aplicavel') continue;
    const item = itens.find(i => i.id === res.item_id);
    if (!item) continue;
    const peso = item.peso || 1;
    const modulo = item.modulo;
    if (!modulos[modulo]) modulos[modulo] = { soma: 0, pesoTotal: 0 };
    let pontuacao = res.status === 'conforme' ? 2 : (res.status === 'parcial' ? 1 : 0);
    modulos[modulo].soma += pontuacao * peso;
    modulos[modulo].pesoTotal += peso;
    somaPonderadaTotal += pontuacao * peso;
    pesoTotal += peso;
  }
  const icePorModulo = {};
  for (let m in modulos) {
    icePorModulo[m] = (modulos[m].soma / (2 * modulos[m].pesoTotal)) * 100;
  }
  const iceTotal = pesoTotal === 0 ? null : (somaPonderadaTotal / (2 * pesoTotal)) * 100;
  return { iceTotal, icePorModulo };
}

function atualizarExibicaoICE(resultados, itens) {
  const { iceTotal, icePorModulo } = calcularICECompleto(resultados, itens);
  let html = '<div class="ice-card">';
  if (iceTotal !== null) {
    let cor = iceTotal >= 80 ? '#27ae60' : (iceTotal >= 50 ? '#e67e22' : '#c0392b');
    html += `<h3>📊 ICE Geral: <span style="color:${cor}">${iceTotal.toFixed(1)}%</span></h3>`;
    html += '<div class="ice-modulos">';
    for (let modulo in icePorModulo) {
      let corMod = icePorModulo[modulo] >= 80 ? '#27ae60' : (icePorModulo[modulo] >= 50 ? '#e67e22' : '#c0392b');
      html += `<span>Módulo ${modulo}: <strong style="color:${corMod}">${icePorModulo[modulo].toFixed(1)}%</strong></span> `;
    }
    html += '</div>';
  } else {
    html += '<p>Preencha os itens para calcular o ICE.</p>';
  }
  html += '</div>';
  const areaICE = document.getElementById('ice-area');
  if (areaICE) areaICE.innerHTML = html;
}

async function buscarRecomendacoes() {
  try {
    const data = await listarRecomendacoes();
    window.recomendacoesMap = {};
    for (let rec of data) window.recomendacoesMap[rec.item_id] = rec.texto_recomendacao;
  } catch (e) {
    console.warn('Fallback local para recomendações');
    window.recomendacoesMap = {
      'A.1': 'Solicitar renovação do credenciamento ao CEE/ES. Prazo: 30 dias.',
      'A.2': 'Instruir processo de aprovação/renovação dos cursos. Prazo: 60 dias.',
      'A.7': 'Regularizar alvará e vistoria do bombeiros. Prazo: 90 dias.',
      'B.4': 'Contatar família e acionar AEE. Prazo: 15 dias.',
      'B.8': 'Notificar pais e Conselho Tutelar. Prazo: 10 dias.',
      'C.3': 'Enviar Atas de Resultados Finais e Lista de Concluintes imediatamente.',
      'F.1': 'Implantar Sala de Recursos ou contratar professor especializado. Prazo: 60 dias.'
    };
  }
}

function exibirRecomendacao(itemId) {
  if (window.recomendacoesMap && window.recomendacoesMap[itemId]) {
    return `<div class="recomendacao">💡 Recomendação: ${window.recomendacoesMap[itemId]}</div>`;
  }
  return '';
}