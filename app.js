// Variables de estado
let FLOWS_DATA = null;
let currentCategory = 'internet';
let currentActiveFlow = null;
let currentStepKey = null;
let stepHistory = [];

window.addEventListener('DOMContentLoaded', async () => {
  initSearch();
  await loadFlowsData();
});

// Carga asíncrona con fetch y manejo de errores
async function loadFlowsData() {
  const grid = document.getElementById('flowsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-slate-500">
        <div class="w-8 h-8 border-4 border-claro border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-xs font-semibold">Cargando base de datos de flujogramas...</p>
      </div>
    `;
  }

  try {
    const response = await fetch('data/flows.json');
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} al cargar flows.json`);
    }
    FLOWS_DATA = await response.json();
    renderFlowsList();
  } catch (error) {
    console.error('Error al cargar flows.json:', error);
    if (grid) {
      grid.innerHTML = `
        <div class="col-span-full p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-800">
          <p class="font-bold text-sm">Error al cargar los flujos técnicos</p>
          <p class="text-xs mt-1">Asegúrate de estar ejecutando la app a través de un servidor local (Live Server / Node / Nginx) para permitir la lectura del archivo JSON.</p>
          <button onclick="loadFlowsData()" class="mt-3 px-4 py-2 bg-claro text-white text-xs font-bold rounded-xl hover:bg-red-700 transition">
            Reintentar Carga
          </button>
        </div>
      `;
    }
  }
}

function selectCategory(categoryKey) {
  currentCategory = categoryKey;

  ['internet', 'telefonia', 'tv', 'ott'].forEach(cat => {
    const btn = document.getElementById(`catBtn-${cat}`);
    if (btn) {
      if (cat === categoryKey) {
        btn.classList.add('border-claro', 'bg-red-50/20');
        btn.classList.remove('border-transparent');
      } else {
        btn.classList.remove('border-claro', 'bg-red-50/20');
        btn.classList.add('border-transparent');
      }
    }
  });

  const catConfig = {
    internet: { name: 'Internet', title: 'Flujogramas de Soporte Internet HFC & FTTH' },
    telefonia: { name: 'Telefonía', title: 'Flujogramas de Soporte Telefonía Fija' },
    tv: { name: 'Televisión', title: 'Flujogramas de Soporte Televisión & TVBox' },
    ott: { name: 'Plataformas OTT', title: 'Flujogramas de Soporte Streaming OTT' }
  };

  const flows = FLOWS_DATA ? (FLOWS_DATA[categoryKey] || []) : [];
  if (catConfig[categoryKey]) {
    document.getElementById('categoryBadge').innerText = `${catConfig[categoryKey].name} (${flows.length} Flujos)`;
    document.getElementById('categoryTitle').innerText = catConfig[categoryKey].title;
  }

  renderFlowsList();

  const speechMap = {
    internet: '¡Excelente! En Internet tenemos los flujos listos para descartar cable módem, fibra ONT, PING y WiFi.',
    telefonia: 'Para Telefonía contamos con validaciones de IP VoIP, Ringing y las derivaciones con cobro de $31.000.',
    tv: 'En Televisión tienes árboles para decos DVB, decos en bucle, bloqueados, pixelación y errores de tarjeta.',
    ott: 'En OTT cubrimos Netflix Bundle vs Stand Alone, Amazon Prime, Claro Video y Mi Asistencia 360.'
  };
  setEngineerSpeech(speechMap[categoryKey]);
}

function renderFlowsList() {
  if (!FLOWS_DATA) return;
  const flows = FLOWS_DATA[currentCategory] || [];
  const grid = document.getElementById('flowsGrid');
  const counter = document.getElementById('flowCounter');
  if (counter) counter.innerText = flows.length;
  if (!grid) return;

  grid.innerHTML = '';

  flows.forEach(flow => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-2xl border border-slate-200 hover:border-claro bg-slate-50/50 hover:bg-white hover:shadow-card cursor-pointer transition-all duration-200 flex flex-col justify-between group";
    card.onclick = () => startFlow(flow.id);

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono font-bold text-slate-400 group-hover:text-claro transition">${flow.code}</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <h4 class="text-sm font-bold text-slate-900 group-hover:text-claro leading-snug transition">${flow.title}</h4>
        <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${flow.summary}</p>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-claro">
        <span>Iniciar diagnóstico</span>
        <span class="w-6 h-6 rounded-full bg-red-50 text-claro flex items-center justify-center group-hover:bg-claro group-hover:text-white transition">→</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function startFlow(flowId) {
  if (!FLOWS_DATA) return;
  let selectedFlow = null;
  for (const cat in FLOWS_DATA) {
    const f = FLOWS_DATA[cat].find(item => item.id === flowId);
    if (f) {
      selectedFlow = f;
      break;
    }
  }

  if (!selectedFlow) return;

  currentActiveFlow = selectedFlow;
  currentStepKey = selectedFlow.initialStep;
  stepHistory = [currentStepKey];

  document.getElementById('arenaFlowCode').innerText = selectedFlow.code;
  document.getElementById('arenaFlowTitle').innerText = selectedFlow.title;
  document.getElementById('arenaCategoryTag').innerText = selectedFlow.category.toUpperCase();

  const icons = {
    internet: '🌐',
    telefonia: '☎️',
    tv: '📺',
    ott: '▶️'
  };
  document.getElementById('arenaServiceIcon').innerText = icons[selectedFlow.category] || '⚙️';

  const arena = document.getElementById('flowActiveArena');
  arena.classList.remove('hidden');
  arena.scrollIntoView({ behavior: 'smooth', block: 'start' });

  setEngineerSpeech(`Has iniciado el flujo "${selectedFlow.title}". Sigue las instrucciones y haz clic en la respuesta.`);

  renderCurrentStep();
  renderVisualNodeTree();
}

function renderCurrentStep() {
  if (!currentActiveFlow || !currentStepKey) return;
  const step = currentActiveFlow.steps[currentStepKey];
  if (!step) return;

  renderBreadcrumbs();

  const typeBadge = document.getElementById('stepTypeBadge');
  const counterBadge = document.getElementById('stepCounterBadge');
  const instructionTitle = document.getElementById('stepInstructionTitle');
  const detailsList = document.getElementById('stepDetailsList');
  const engineerTip = document.getElementById('stepEngineerTip');
  const actionsGrid = document.getElementById('stepActionsGrid');
  const commandBox = document.getElementById('stepCommandBox');
  const terminalBanner = document.getElementById('terminalResultBanner');

  counterBadge.innerText = `Paso ${stepHistory.length} / ${Object.keys(currentActiveFlow.steps).length}`;

  if (step.type === 'terminal') {
    terminalBanner.classList.remove('hidden');
    document.getElementById('finalResultBadge').innerText = step.badge || 'Resultado Final';
    document.getElementById('finalResultBadge').className = `px-3 py-1 text-white text-xs font-black rounded-full uppercase tracking-wider ${step.badgeColor || 'bg-claro'}`;
    document.getElementById('finalResultTitle').innerText = step.title;
    document.getElementById('finalResultDesc').innerHTML = step.desc;
    document.getElementById('tipificationText').innerText = step.tipification || 'DIAGNÓSTICO FINALIZADO CON ÉXITO';

    instructionTitle.innerText = "Flujograma Completado";
    detailsList.innerHTML = `<span class="text-slate-500">Se ha alcanzado la resolución técnica oficial recomendada. Revisa los detalles de cierre a continuación.</span>`;
    actionsGrid.innerHTML = `
      <button onclick="restartCurrentFlow()" class="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition">
        Volver a empezar este árbol
      </button>
      <button onclick="closeActiveFlow()" class="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition">
        Elegir otro síntoma
      </button>
    `;
    typeBadge.innerText = "Resolución Final";
    typeBadge.className = "px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-red-100 text-claro border border-red-200";
    setEngineerSpeech('¡Flujo concluido! Puedes copiar la plantilla de tipificación para dejar constancia en el CRM.');
    updateVisualNodeHighlight();
    return;
  }

  terminalBanner.classList.add('hidden');
  instructionTitle.innerHTML = step.title;
  detailsList.innerHTML = step.desc || '';
  engineerTip.innerHTML = step.tip || 'Asegúrate de corroborar con el cliente cada acción antes de marcar la opción.';

  if (step.command) {
    commandBox.classList.remove('hidden');
    document.getElementById('stepCommandText').innerText = step.command;
  } else {
    commandBox.classList.add('hidden');
  }

  if (step.type === 'decision') {
    typeBadge.innerText = 'Pregunta de Decisión';
    typeBadge.className = 'px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-200';
  } else {
    typeBadge.innerText = 'Acción de Soporte Técnico';
    typeBadge.className = 'px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-blue-100 text-blue-800 border border-blue-200';
  }

  actionsGrid.innerHTML = '';
  (step.actions || []).forEach(act => {
    const btn = document.createElement('button');
    let colorClasses = "bg-claro hover:bg-red-700 text-white shadow-md shadow-claro/20";
    if (act.style === 'secondary') {
      colorClasses = "bg-slate-800 hover:bg-slate-900 text-white";
    } else if (act.style === 'danger') {
      colorClasses = "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20";
    } else if (act.style === 'success') {
      colorClasses = "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20";
    }

    btn.className = `p-4 rounded-xl font-bold text-xs sm:text-sm text-center transition transform active:scale-95 flex items-center justify-center gap-2 ${colorClasses}`;
    btn.innerHTML = `<span>${act.label}</span> <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
    btn.onclick = () => goToStep(act.nextStep);
    actionsGrid.appendChild(btn);
  });

  updateVisualNodeHighlight();
}

function goToStep(nextStepKey) {
  if (!currentActiveFlow || !currentActiveFlow.steps[nextStepKey]) return;
  currentStepKey = nextStepKey;
  stepHistory.push(nextStepKey);
  renderCurrentStep();
}

function renderBreadcrumbs() {
  const container = document.getElementById('breadcrumbsList');
  if (!container) return;
  container.innerHTML = '';

  stepHistory.forEach((stepKey, idx) => {
    const step = currentActiveFlow.steps[stepKey];
    const span = document.createElement('span');
    span.className = `cursor-pointer hover:text-claro transition ${idx === stepHistory.length - 1 ? 'font-bold text-claro' : 'text-slate-500'}`;
    span.innerText = `${idx + 1}. ${(step?.title || stepKey).substring(0, 24)}...`;
    span.onclick = () => {
      currentStepKey = stepKey;
      stepHistory = stepHistory.slice(0, idx + 1);
      renderCurrentStep();
    };

    container.appendChild(span);

    if (idx < stepHistory.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'text-slate-300';
      arrow.innerText = '→';
      container.appendChild(arrow);
    }
  });
}

function renderVisualNodeTree() {
  const container = document.getElementById('flowchartNodesTree');
  if (!container || !currentActiveFlow) return;
  container.innerHTML = '';

  const stepsKeys = Object.keys(currentActiveFlow.steps);
  stepsKeys.forEach((key, index) => {
    const step = currentActiveFlow.steps[key];
    const nodeDiv = document.createElement('div');
    nodeDiv.id = `map-node-${key}`;
    nodeDiv.className = "p-3 rounded-xl border border-slate-200 text-xs bg-white transition-all duration-200 flex items-start gap-2.5 cursor-pointer";

    let icon = '🔹';
    if (step.type === 'decision') icon = '🔶';
    if (step.type === 'terminal') icon = '🏁';

    nodeDiv.innerHTML = `
      <span class="text-sm mt-0.5">${icon}</span>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-800 text-[11px] leading-tight">${step.title}</span>
          <span class="text-[9px] font-mono text-slate-400">#${index + 1}</span>
        </div>
        <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1">${step.desc ? step.desc.replace(/<[^>]*>/g, '') : ''}</p>
      </div>
    `;
    nodeDiv.onclick = () => {
      currentStepKey = key;
      stepHistory.push(key);
      renderCurrentStep();
    };
    container.appendChild(nodeDiv);
  });

  updateVisualNodeHighlight();
}

function updateVisualNodeHighlight() {
  if (!currentActiveFlow) return;
  Object.keys(currentActiveFlow.steps).forEach(key => {
    const nodeEl = document.getElementById(`map-node-${key}`);
    if (!nodeEl) return;
    nodeEl.classList.remove('flow-node-active', 'flow-node-visited');

    if (key === currentStepKey) {
      nodeEl.classList.add('flow-node-active');
      nodeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (stepHistory.includes(key)) {
      nodeEl.classList.add('flow-node-visited');
    }
  });
}

function restartCurrentFlow() {
  if (!currentActiveFlow) return;
  startFlow(currentActiveFlow.id);
}

function closeActiveFlow() {
  document.getElementById('flowActiveArena').classList.add('hidden');
  document.getElementById('flowSelectionSection').scrollIntoView({ behavior: 'smooth' });
  setEngineerSpeech('Selecciona otro flujo cuando estés listo para un nuevo caso.');
}

function resetToHome() {
  closeActiveFlow();
  selectCategory('internet');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initSearch() {
  const input = document.getElementById('flowSearchInput');
  if (input) input.addEventListener('input', filterFlows);
}

function filterFlows() {
  if (!FLOWS_DATA) return;
  const query = document.getElementById('flowSearchInput').value.toLowerCase().trim();
  const grid = document.getElementById('flowsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let matched = [];
  if (query === '') {
    renderFlowsList();
    return;
  }

  for (const cat in FLOWS_DATA) {
    FLOWS_DATA[cat].forEach(f => {
      if (f.title.toLowerCase().includes(query) || 
          f.summary.toLowerCase().includes(query) || 
          f.code.toLowerCase().includes(query)) {
        matched.push(f);
      }
    });
  }

  document.getElementById('flowCounter').innerText = matched.length;

  if (matched.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400">
        <p class="text-sm font-semibold">No se encontraron flujogramas para "${query}".</p>
        <p class="text-xs mt-1">Prueba con palabras como "WiFi", "Llamadas", "Señal", "Netflix" o "LOS".</p>
      </div>
    `;
    return;
  }

  matched.forEach(flow => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-2xl border border-slate-200 hover:border-claro bg-slate-50/50 hover:bg-white hover:shadow-card cursor-pointer transition-all duration-200 flex flex-col justify-between group";
    card.onclick = () => startFlow(flow.id);

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono font-bold text-claro uppercase">${flow.category} • ${flow.code}</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <h4 class="text-sm font-bold text-slate-900 group-hover:text-claro leading-snug transition">${flow.title}</h4>
        <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${flow.summary}</p>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-claro">
        <span>Iniciar diagnóstico</span>
        <span class="w-6 h-6 rounded-full bg-red-50 text-claro flex items-center justify-center group-hover:bg-claro group-hover:text-white transition">→</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function clearSearch() {
  const input = document.getElementById('flowSearchInput');
  if (input) input.value = '';
  renderFlowsList();
}

function setEngineerSpeech(text) {
  const el = document.getElementById('speechText');
  if (el) el.innerText = text;
}

function copyTipification() {
  const tipText = document.getElementById('tipificationText').innerText;
  copyToClipboard(tipText, '¡Tipificación copiada con éxito al portapapeles!');
}

function copyCommand() {
  const cmdText = document.getElementById('stepCommandText').innerText;
  copyToClipboard(cmdText, 'Comando copiado al portapapeles');
}

function copyToClipboard(text, message) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
  }).catch(() => {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand("copy");
      showToast(message);
    } catch (err) {
      showToast("Error al copiar texto");
    }
    document.body.removeChild(tempInput);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  document.getElementById('toastMessage').innerText = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3000);
}

function openTipsModal() {
  document.getElementById('tipsModal').classList.remove('hidden');
}

function closeTipsModal() {
  document.getElementById('tipsModal').classList.add('hidden');
}