let TWITCH_CHANNEL = "mrfalll";
let API_LIMIT = 50;
const LOCAL_PROXY_BASE = 'http://localhost:3000';

function getApiUrl(channel = TWITCH_CHANNEL, limit = API_LIMIT) {
  return `https://lumosbot.app/api/twitch/streaks/${encodeURIComponent(channel)}?limit=${encodeURIComponent(limit)}`;
}

function getApiProxyUrl() {
  const apiUrl = getApiUrl();
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return `${LOCAL_PROXY_BASE}/proxy/streaks/${encodeURIComponent(TWITCH_CHANNEL)}?limit=${encodeURIComponent(API_LIMIT)}`;
  }
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
}

function getTwitchChannelUrl() {
  return `https://www.twitch.tv/${TWITCH_CHANNEL}`;
}
const rankingList = document.getElementById("rankingList");
const statusBar = document.getElementById("statusBar");
const refreshButton = document.getElementById("refreshButton");
const channelLink = document.getElementById("channelLink");
const settingsModal = document.getElementById('settingsModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const settingsForm = document.getElementById('settingsForm');
const channelInput = document.getElementById('channelInput');
const limitInput = document.getElementById('limitInput');
const cancelSettings = document.getElementById('cancelSettings');

let lastQueryTimestamp = null;

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
    .slice(0, 10);
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

function openSettingsModal() {
  if (!settingsModal) return fetchStreaks();
  channelInput.value = sessionStorage.getItem('streak_channel') || TWITCH_CHANNEL;
  limitInput.value = sessionStorage.getItem('streak_limit') || API_LIMIT;
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.setAttribute('aria-hidden', 'true');
}

function applySettingsAndFetch(channelVal, limitVal) {
  const channel = (channelVal || '').toString().trim() || TWITCH_CHANNEL;
  const limit = Number(limitVal) || API_LIMIT;
  TWITCH_CHANNEL = channel;
  API_LIMIT = limit;
  try {
    sessionStorage.setItem('streak_channel', TWITCH_CHANNEL);
    sessionStorage.setItem('streak_limit', String(API_LIMIT));
  } catch (e) {}
  if (channelLink) {
    channelLink.href = getTwitchChannelUrl();
    channelLink.textContent = `@${TWITCH_CHANNEL}`;
  }
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
      <div class="updated-cell">${item.updatedAt || "Sem data disponível"}</div>
    `;

    rankingList.appendChild(row);
  });
}

async function fetchStreaks() {
  setLoadingState(true);
  setStatus("Carregando ranking...", "loading");

  try {
    const response = await fetch(getApiProxyUrl());

    if (!response.ok) {
      renderEmptyState("Não foi possível carregar o ranking agora.");
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      renderEmptyState("A resposta da API não está em JSON válido.");
      throw new Error("Resposta inválida da API.");
    }

    const data = await response.json();

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
