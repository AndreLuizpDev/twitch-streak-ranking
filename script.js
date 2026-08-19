let TWITCH_CHANNEL = "mrfalll";
let API_LIMIT = 50;
let API_MAX_LIMIT = null;
const LOCAL_PROXY_BASE = 'http://localhost:3000';
// When developing on localhost use the local proxy. In production you can
// set `DEPLOYED_PROXY` to a Cloudflare Worker or serverless function URL
// that forwards requests to the lumosbot API and adds CORS headers.
// Example: const DEPLOYED_PROXY = 'https://your-worker-name.workers.dev';
const DEPLOYED_PROXY = 'https://twitch-streak-ranking.andreldsantosp.workers.dev';

function getApiUrl(channel = TWITCH_CHANNEL, limit = API_LIMIT) {
  return `https://lumosbot.app/api/twitch/streaks/${encodeURIComponent(channel)}?limit=${encodeURIComponent(limit)}`;
}

function getApiProxyUrl() {
  // Prefer local proxy when developing on localhost
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return `${LOCAL_PROXY_BASE}/proxy/streaks/${encodeURIComponent(TWITCH_CHANNEL)}?limit=${encodeURIComponent(API_LIMIT)}`;
  }

  // If a deployed proxy is configured, use it (expects channel & limit as query params)
  if (DEPLOYED_PROXY && DEPLOYED_PROXY.length) {
    return `${DEPLOYED_PROXY}?channel=${encodeURIComponent(TWITCH_CHANNEL)}&limit=${encodeURIComponent(API_LIMIT)}`;
  }

  // Otherwise call the API directly (may fail due to CORS).
  return getApiUrl(TWITCH_CHANNEL, API_LIMIT);
}

function getTwitchChannelUrl() {
  return `https://www.twitch.tv/${TWITCH_CHANNEL}`;
}
const rankingList = document.getElementById("rankingList");
const statusBar = document.getElementById("statusBar");
const refreshButton = document.getElementById("refreshButton");
const channelLink = document.getElementById("channelLink");
const topSubtitle = document.getElementById("topSubtitle");
const settingsModal = document.getElementById('settingsModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const settingsForm = document.getElementById('settingsForm');
const channelInput = document.getElementById('channelInput');
const limitInput = document.getElementById('limitInput');
const cancelSettings = document.getElementById('cancelSettings');

let lastQueryTimestamp = null;
const PROJECT_VERSION = '1.0.6';

function setStatus(message, type = "") {
  statusBar.textContent = message;
  statusBar.className = "status-bar";

  if (type) {
    statusBar.classList.add(type);
  }
}

function setLoadingState(isLoading) {
  refreshButton.disabled = isLoading;
  refreshButton.querySelector(".button-icon").style.animation = isLoading ? "spin 1s linear infinite" : "none";
}

function formatLastQueryDate(date) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);

  return formatted;
}

function normalizeStreak(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getMedal(position) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `${position}º`;
}

function processRanking(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return [...data]
    .map((item) => ({
      ...item,
      streak: normalizeStreak(item.streak),
    }))
    .sort((first, second) => second.streak - first.streak)
    .slice(0, API_LIMIT);
}

function loadSettingsFromSession() {
  try {
    const ch = sessionStorage.getItem('streak_channel');
    const lim = sessionStorage.getItem('streak_limit');
    if (ch) TWITCH_CHANNEL = ch;
    if (lim && !Number.isNaN(Number(lim))) API_LIMIT = Number(lim);
  } catch (e) {
    // ignore
  }
}

function saveSettingsToSession() {
  try {
    sessionStorage.setItem('streak_channel', TWITCH_CHANNEL);
    sessionStorage.setItem('streak_limit', String(API_LIMIT));
  } catch (e) {}
}

function updateLimitInputConstraints() {
  if (!limitInput) return;

  if (API_MAX_LIMIT) {
    limitInput.max = String(API_MAX_LIMIT);
    limitInput.title = `A API permite no máximo ${API_MAX_LIMIT} registros.`;
  } else {
    limitInput.removeAttribute('max');
    limitInput.removeAttribute('title');
  }
}

function extractApiMaximum(data) {
  if (!data || typeof data.detail !== 'string') return null;

  try {
    const details = JSON.parse(data.detail);
    const maximum = details.find((detail) => detail?.maximum)?.maximum;
    return Number.isFinite(Number(maximum)) ? Number(maximum) : null;
  } catch (error) {
    const match = data.detail.match(/maximum[^\d]*(\d+)/i);
    return match ? Number(match[1]) : null;
  }
}

function applyDiscoveredMaximum(maximum) {
  if (!Number.isInteger(maximum) || maximum < 1) return false;

  API_MAX_LIMIT = maximum;
  if (API_LIMIT > API_MAX_LIMIT) {
    API_LIMIT = API_MAX_LIMIT;
    saveSettingsToSession();
    updateTopSubtitle();
  }
  updateLimitInputConstraints();
  return true;
}

function openSettingsModal() {
  if (!settingsModal) return fetchStreaks();
  channelInput.value = sessionStorage.getItem('streak_channel') || TWITCH_CHANNEL;
  limitInput.value = sessionStorage.getItem('streak_limit') || API_LIMIT;
  updateLimitInputConstraints();
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.setAttribute('aria-hidden', 'true');
}

function applySettingsAndFetch(channelVal, limitVal) {
  const channel = (channelVal || '').toString().trim() || TWITCH_CHANNEL;
  const requestedLimit = Number(limitVal);
  const limit = Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : API_LIMIT);
  TWITCH_CHANNEL = channel;
  API_LIMIT = API_MAX_LIMIT ? Math.min(limit, API_MAX_LIMIT) : limit;
  saveSettingsToSession();
  if (channelLink) {
    channelLink.href = getTwitchChannelUrl();
    channelLink.textContent = `@${TWITCH_CHANNEL}`;
  }

  updateTopSubtitle();
  updateLimitInputConstraints();
  populateFooter();
  fetchStreaks();
}

function getUserInitials(userName) {
  const trimmed = String(userName || "?").trim();

  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function renderEmptyState(message = "Nenhum streak encontrado.") {
  rankingList.innerHTML = `<div class="empty-state">${message}</div>`;
}

function populateFooter() {
  const verEl = document.getElementById('projectVersion');
  const apiRepo = document.getElementById('apiRepoLink');
  const siteRepo = document.getElementById('siteRepoLink');
  if (verEl) verEl.textContent = `v${PROJECT_VERSION}`;
  if (apiRepo) apiRepo.href = 'https://github.com/TomGoulart';
  if (siteRepo) siteRepo.href = 'https://github.com/AndreLuizpDev';
}

function updateTopSubtitle() {
  if (!topSubtitle) return;
  topSubtitle.textContent = `Top ${API_LIMIT} maiores streaks`;
}

function renderRanking(items, emptyMessage = "Nenhum streak encontrado.") {
  rankingList.innerHTML = "";

  if (!items.length) {
    renderEmptyState(emptyMessage);
    return;
  }

  items.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = `ranking-item ${index < 3 ? "top-3" : ""}`;

    const position = index + 1;
    const positionText = getMedal(position);

    row.innerHTML = `
      <div class="position-cell ${position === 1 ? "pos-1" : position === 2 ? "pos-2" : position === 3 ? "pos-3" : ""}">
        <span class="position-badge">${positionText}</span>
      </div>
      <div class="user-cell">
        <span class="user-avatar">${getUserInitials(item.userName)}</span>
        <span>${item.userName || "Usuário desconhecido"}</span>
      </div>
      <div class="streak-cell">
        <span class="streak-number">${item.streak}</span>
        <span class="streak-label">streaks</span>
      </div>
      <div class="updated-cell">${convertToLocalTime(item.updatedAt)}</div>
    `;

    rankingList.appendChild(row);
  });
}

function convertToLocalTime(utcDateString) {
  if (!utcDateString) return "Sem data disponível";

  // Converte "17/08/2026, 13:24:42" para partes
  const match = utcDateString.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) return utcDateString;

  const [, day, month, year, hour, minute, second] = match;

  // Cria a data explicitamente como UTC
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));

  // Converte automaticamente para o fuso do usuário
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

async function fetchStreaks({ retryOnLimit = true } = {}) {
  setLoadingState(true);
  setStatus("Carregando ranking...", "loading");

  try {
    const response = await fetch(getApiProxyUrl());

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      renderEmptyState("A resposta da API não está em JSON válido.");
      throw new Error("Resposta inválida da API.");
    }

    const discoveredMaximum = extractApiMaximum(data);
    if (discoveredMaximum && retryOnLimit && applyDiscoveredMaximum(discoveredMaximum)) {
      setStatus(`A API permite no máximo ${discoveredMaximum}. Ajustando consulta...`, "loading");
      return fetchStreaks({ retryOnLimit: false });
    }

    if (!response.ok) {
      renderEmptyState("Não foi possível carregar o ranking agora.");
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    if (!data || data.success === false) {
      renderEmptyState("A API retornou uma resposta inválida.");
      throw new Error("A API retornou uma resposta inválida.");
    }

    const ranking = processRanking(data.data);
    lastQueryTimestamp = new Date();
    renderRanking(ranking);

    if (!ranking.length) {
      renderEmptyState("Nenhum streak encontrado.");
      setStatus("Nenhum streak encontrado.", "success");
      return;
    }

    setStatus(`Última consulta: ${formatLastQueryDate(lastQueryTimestamp)}`, "success");
  } catch (error) {
    const fallbackMessage =
      error instanceof TypeError
        ? "Erro de rede: não foi possível acessar a API."
        : error.message || "Erro ao carregar o ranking.";

    renderEmptyState("Não foi possível carregar o ranking no momento.");
    setStatus(fallbackMessage, "error");
  } finally {
    setLoadingState(false);
  }
}

// Open modal on refresh; modal will trigger fetch when submitted
refreshButton.addEventListener("click", openSettingsModal);

if (modalBackdrop) {
  modalBackdrop.addEventListener('click', closeSettingsModal);
}

if (cancelSettings) {
  cancelSettings.addEventListener('click', (e) => {
    e.preventDefault();
    closeSettingsModal();
  });
}

if (settingsForm) {
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ch = channelInput.value;
    const lim = limitInput.value;
    closeSettingsModal();
    applySettingsAndFetch(ch, lim);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadSettingsFromSession();

  if (channelLink) {
    channelLink.href = getTwitchChannelUrl();
    channelLink.textContent = `@${TWITCH_CHANNEL}`;
  }

  updateTopSubtitle();
  updateLimitInputConstraints();
  // ensure footer shows current project version on initial load
  populateFooter();

  // initial fetch with defaults or previously saved settings
  fetchStreaks();
});

const styles = document.createElement("style");
styles.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styles);
