const TWITCH_CHANNEL = "mrfalll";
const API_LIMIT = 50;
const API_URL = `https://lumosbot.app/api/twitch/streaks/${TWITCH_CHANNEL}?limit=${API_LIMIT}`;
const LOCAL_PROXY_BASE = 'http://localhost:3000';
const API_PROXY_URL = (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  ? `${LOCAL_PROXY_BASE}/proxy/streaks/${encodeURIComponent(TWITCH_CHANNEL)}?limit=${API_LIMIT}`
  : `https://api.allorigins.win/raw?url=${encodeURIComponent(API_URL)}`;
const TWITCH_CHANNEL_URL = `https://www.twitch.tv/${TWITCH_CHANNEL}`;
const rankingList = document.getElementById("rankingList");
const statusBar = document.getElementById("statusBar");
const refreshButton = document.getElementById("refreshButton");
const channelLink = document.getElementById("channelLink");

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
    const response = await fetch(API_PROXY_URL);

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

refreshButton.addEventListener("click", fetchStreaks);

window.addEventListener("DOMContentLoaded", () => {
  if (channelLink) {
    channelLink.href = TWITCH_CHANNEL_URL;
    channelLink.textContent = `@${TWITCH_CHANNEL}`;
  }

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
