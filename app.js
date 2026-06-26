"use strict";

const config = window.BESTOF_AMIS_CONFIG || {};
const API_TIMEOUT_MS = 15000;
const HEALTH_TIMEOUT_MS = 7000;
const defaultApiBase = String(config.apiBase || "").replace(/\/+$/, "");
const queryApiBase = String(new URLSearchParams(location.search).get("apiBase") || "").replace(/\/+$/, "");
const storedApiBase = String(localStorage.getItem("bestof_amis_api") || "").replace(/\/+$/, "");
const reusableStoredApiBase = !queryApiBase && isTryCloudflareUrl(storedApiBase) ? "" : storedApiBase;
if (storedApiBase && !reusableStoredApiBase) localStorage.removeItem("bestof_amis_api");

const state = {
  token: localStorage.getItem("bestof_amis_token") || "",
  role: localStorage.getItem("bestof_amis_role") || "",
  label: localStorage.getItem("bestof_amis_label") || "",
  apiBase: queryApiBase || reusableStoredApiBase || defaultApiBase,
  view: "videos",
  sort: "popular",
  filter: "all",
  allVideos: [],
  totalVideos: 0,
  votedVideos: 0,
  visibleLimit: 60,
  pageSize: 60,
};

const login = document.getElementById("login");
const app = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const apiBaseInput = document.getElementById("apiBaseInput");
const apiBaseRow = document.getElementById("apiBaseRow");
const codeInput = document.getElementById("codeInput");
const loginError = document.getElementById("loginError");
const videos = document.getElementById("videos");
const sessionInfo = document.getElementById("sessionInfo");
const template = document.getElementById("videoTemplate");
const logout = document.getElementById("logout");
const siteTitle = document.getElementById("siteTitle");
const leaderboardButton = document.getElementById("leaderboardButton");
const personalUnvotedButton = document.getElementById("personalUnvotedButton");

siteTitle.textContent = config.siteName || "Best Of Amis";
apiBaseInput.value = state.apiBase;
if (queryApiBase) localStorage.setItem("bestof_amis_api", queryApiBase);
if (defaultApiBase) apiBaseRow.classList.add("compact");

function apiBase() {
  return String(apiBaseInput.value || state.apiBase || "").trim().replace(/\/+$/, "");
}

function isTryCloudflareUrl(value) {
  return /^https:\/\/[^/]+\.trycloudflare\.com$/i.test(String(value || "").replace(/\/+$/, ""));
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function apiUrl(path) {
  const base = apiBase();
  if (!base) {
    if (location.protocol === "file:" || location.hostname.endsWith(".github.io")) {
      throw new Error(
        "URL du serveur prive requise. Lance Lancer_Public_BestOf_Tunnel.bat depuis BEAST OF DJCREEPER, puis utilise la page ouverte automatiquement.",
      );
    }
    return path;
  }
  if (location.protocol === "https:" && /^http:\/\//i.test(base)) {
    throw new Error(
      "Depuis GitHub Pages, l'URL du serveur doit commencer par https://. Lance Lancer_Public_BestOf_Tunnel.bat pour obtenir une URL trycloudflare en HTTPS.",
    );
  }
  return `${base}${path}`;
}

function connectionErrorMessage() {
  const base = apiBase();
  const suffix = base ? ` URL testee: ${base}/api/health` : "";
  if (/\.trycloudflare\.com$/i.test(base)) {
    return `Serveur prive injoignable. Le tunnel Cloudflare est probablement ferme ou expire : relance Lancer_Public_BestOf_Tunnel.bat et utilise le nouveau lien ouvert.${suffix}`;
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base)) {
    return `Serveur prive local injoignable. Lance Lancer_Public_BestOf_Tunnel.bat ou Lancer_Serveur_Prive_BestOf_Amis.bat, puis garde la fenetre ouverte.${suffix}`;
  }
  return `Serveur prive injoignable. Verifie que le serveur ou le tunnel est lance, puis reessaie.${suffix}`;
}

async function api(path, options = {}) {
  const {
    timeoutMs = API_TIMEOUT_MS,
    headers = {},
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(apiUrl(path), {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Serveur prive trop lent a repondre. ${connectionErrorMessage()}`);
    }
    if (error instanceof TypeError) throw new Error(connectionErrorMessage());
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Serveur prive indisponible.");
  return data;
}

function clearSession() {
  localStorage.removeItem("bestof_amis_token");
  localStorage.removeItem("bestof_amis_role");
  localStorage.removeItem("bestof_amis_label");
  state.token = "";
  state.role = "";
  state.label = "";
}

function showLogin(message = "") {
  app.hidden = true;
  login.hidden = false;
  loginError.textContent = message;
  state.apiBase = apiBase();
  apiBaseInput.value = state.apiBase;
}

function shouldResetSession(message) {
  return (
    message.includes("Code requis") ||
    message.includes("indisponible") ||
    message.includes("injoignable") ||
    message.includes("trop lent")
  );
}

async function checkServerHealth() {
  const data = await api("/api/health", { method: "GET", timeoutMs: HEALTH_TIMEOUT_MS });
  if (!data.ok) throw new Error("Serveur prive indisponible.");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  state.apiBase = apiBase();
  try {
    const data = await api("/api/access", {
      method: "POST",
      body: JSON.stringify({ code: codeInput.value }),
    });
    state.token = data.token;
    state.role = data.role;
    state.label = data.label;
    localStorage.setItem("bestof_amis_token", state.token);
    localStorage.setItem("bestof_amis_role", state.role);
    localStorage.setItem("bestof_amis_label", state.label);
    localStorage.setItem("bestof_amis_api", state.apiBase);
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logout.addEventListener("click", () => {
  clearSession();
  showLogin();
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = "videos";
    state.filter = "all";
    state.sort = button.dataset.sort;
    state.visibleLimit = state.pageSize;
    document.querySelectorAll("[data-sort]").forEach((item) => item.classList.remove("active"));
    personalUnvotedButton.classList.remove("active");
    leaderboardButton.classList.remove("active");
    button.classList.add("active");
    loadVideos();
  });
});

personalUnvotedButton.addEventListener("click", () => {
  state.view = "videos";
  state.filter = "personal-unvoted";
  state.visibleLimit = state.pageSize;
  document.querySelectorAll("[data-sort]").forEach((item) => item.classList.remove("active"));
  leaderboardButton.classList.remove("active");
  personalUnvotedButton.classList.add("active");
  loadVideos();
});

leaderboardButton.addEventListener("click", () => {
  state.view = "leaderboard";
  document.querySelectorAll("[data-sort]").forEach((item) => item.classList.remove("active"));
  personalUnvotedButton.classList.remove("active");
  leaderboardButton.classList.add("active");
  loadLeaderboard();
});

function showApp() {
  login.hidden = true;
  app.hidden = false;
  if (state.role === "admin") {
    sessionInfo.textContent = `Connecté en admin : ${state.label || "Admin"}`;
  } else if (state.role === "creator") {
    sessionInfo.textContent = `Connecté avec un code créateur : ${state.label}`;
  } else {
    sessionInfo.textContent = `Connecté avec un code ami : ${state.label}`;
  }
  if (state.view === "leaderboard") loadLeaderboard();
  else loadVideos();
}

async function loadVideos() {
  videos.className = "grid";
  videos.textContent = "Chargement…";
  try {
    const apiSort = state.filter === "personal-unvoted" ? "unvoted" : state.sort;
    const data = await api(`/api/videos?sort=${encodeURIComponent(apiSort)}`);
    state.totalVideos = data.videos.length;
    state.votedVideos = data.videos.filter(hasUserVoted).length;
    state.allVideos =
      state.filter === "personal-unvoted"
        ? data.videos.filter((video) => !hasUserVoted(video))
        : data.videos;
    renderVideos(state.allVideos, data.role);
  } catch (error) {
    videos.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    if (shouldResetSession(error.message)) {
      clearSession();
      showLogin(error.message);
    }
  }
}

async function loadLeaderboard() {
  videos.className = "leaderboard-view";
  videos.textContent = "Chargement...";
  try {
    const data = await api("/api/leaderboard");
    renderLeaderboard(data.voters || []);
  } catch (error) {
    videos.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    if (shouldResetSession(error.message)) {
      clearSession();
      showLogin(error.message);
    }
  }
}

function hasUserVoted(video) {
  return Number(video.userVote || 0) !== 0;
}

function renderLeaderboard(voters) {
  videos.textContent = "";

  const panel = document.createElement("section");
  panel.className = "leaderboard-panel";

  const header = document.createElement("div");
  header.className = "leaderboard-header";
  const title = document.createElement("h2");
  title.textContent = "Leaderboard";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Classement du plus grand nombre de votes au plus petit.";
  header.append(title, subtitle);
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "leaderboard-list";
  if (!voters.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aucun vote pour le moment.";
    list.appendChild(empty);
  }

  voters.forEach((voter, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    const rank = document.createElement("div");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;

    const identity = document.createElement("div");
    identity.className = "leaderboard-identity";
    const name = document.createElement("strong");
    name.textContent = voter.label || "Sans pseudo";
    const role = document.createElement("span");
    role.className = "muted";
    role.textContent = roleLabel(voter.role);
    identity.append(name, role);

    const counts = document.createElement("div");
    counts.className = "leaderboard-counts";
    counts.append(
      leaderboardStat("Votes", voter.total),
      leaderboardStat("Positifs", voter.upvotes, "up-count"),
      leaderboardStat("Negatifs", voter.downvotes, "down-count"),
    );

    row.append(rank, identity, counts);
    list.appendChild(row);
  });

  panel.appendChild(list);
  videos.appendChild(panel);
}

function leaderboardStat(label, value, className = "") {
  const item = document.createElement("span");
  item.className = `leaderboard-stat ${className}`.trim();
  const number = document.createElement("strong");
  number.textContent = String(Number(value || 0));
  const text = document.createElement("span");
  text.textContent = label;
  item.append(number, text);
  return item;
}

function renderVideos(items, role) {
  videos.textContent = "";
  if (!items.length) {
    videos.innerHTML =
      state.filter === "personal-unvoted" && state.totalVideos && state.votedVideos >= state.totalVideos
        ? "<p>Tous les clips disponibles ont deja ete votes par toi.</p>"
        : "<p>Aucun clip disponible.</p>";
    return;
  }
  const visible = items.slice(0, state.visibleLimit);
  const summary = document.createElement("div");
  summary.className = "list-summary";
  summary.textContent =
    `${items.length} clip(s)${state.filter === "personal-unvoted" ? " sans ton vote" : ""} - ${visible.length} affiche(s)` +
    (state.filter === "personal-unvoted" && state.votedVideos
      ? ` - ${state.votedVideos} deja vote(s) par toi masque(s)`
      : "");
  videos.appendChild(summary);
  for (const video of visible) {
    const node = template.content.cloneNode(true);
    const player = node.querySelector("video");
    const title = node.querySelector("h2");
    const meta = node.querySelector(".meta");
    const score = node.querySelector(".score");
    const up = node.querySelector(".up");
    const down = node.querySelector(".down");
    const creatorActions = node.querySelector(".creator-actions");
    const like = node.querySelector(".like");
    const remove = node.querySelector(".delete");

    player.preload = "metadata";
    player.src = mediaSrc(video.mediaUrl);
    player.load();
    title.textContent = video.title;
    {
      const metaParts = [];
      if (Number(video.duration || 0) > 0) metaParts.push(formatDuration(video.duration));
      if (Number(video.size || 0) > 0) metaParts.push(formatBytes(video.size));
      meta.textContent = metaParts.length ? metaParts.join(" · ") : "Clip prêt à lire";
    }
    score.textContent = `Score ${video.score} (${video.upvotes} / ${video.downvotes})`;
    up.textContent = video.userVote === 1 ? "▲ Upvoté" : "▲ Upvote";
    down.textContent = video.userVote === -1 ? "▼ Downvoté" : "▼ Downvote";

    up.addEventListener("click", () => sendVote(video.id, 1));
    down.addEventListener("click", () => sendVote(video.id, -1));
    creatorActions.hidden = true;
    if (role === "admin") {
      creatorActions.hidden = false;
      like.addEventListener("click", () => creatorAction(video.id, "like", player));
      remove.addEventListener("click", () => creatorAction(video.id, "delete", player));
    }
    videos.appendChild(node);
  }
  if (visible.length < items.length) {
    const more = document.createElement("div");
    more.className = "load-more-card";
    const button = document.createElement("button");
    button.textContent = `Afficher ${Math.min(state.pageSize, items.length - visible.length)} clip(s) de plus`;
    button.addEventListener("click", () => {
      state.visibleLimit += state.pageSize;
      renderVideos(state.allVideos, role);
    });
    more.appendChild(button);
    videos.appendChild(more);
  }
}

function mediaSrc(mediaUrl) {
  const url = `${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(state.token)}`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase()}${url}`;
}

async function sendVote(id, value) {
  await api(`/api/videos/${id}/vote`, { method: "POST", body: JSON.stringify({ value }) });
  await loadVideos();
}

async function creatorAction(id, action, player) {
  if (state.role !== "admin") {
    alert("Seul l'admin peut faire ca.");
    return;
  }
  const text =
    action === "delete"
      ? "Supprimer definitivement ce clip du dossier clips local ?"
      : "Deplacer ce clip dans le dossier LIKE local ?";
  if (!confirm(text)) return;
  releaseLoadedMedia(player);
  await wait(120);
  try {
    await api(`/api/creator/videos/${id}/${action}`, { method: "POST", body: "{}" });
    state.totalVideos = Math.max(0, state.totalVideos - 1);
    state.allVideos = state.allVideos.filter((video) => video.id !== id);
    renderVideos(state.allVideos, state.role);
  } catch (error) {
    alert(error.message || "Action impossible.");
    await loadVideos();
  }
}

function releaseLoadedMedia(preferredPlayer) {
  const players = Array.from(document.querySelectorAll("video"));
  if (preferredPlayer && !players.includes(preferredPlayer)) players.unshift(preferredPlayer);
  for (const player of players) {
    try {
      player.pause();
      player.removeAttribute("src");
      player.load();
    } catch (_) {
      // Ignorer: le serveur a aussi une protection anti-verrou.
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(value) {
  value = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return hours
    ? `${hours}h${String(minutes).padStart(2, "0")}m${String(seconds).padStart(2, "0")}s`
    : `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

function formatBytes(value) {
  const mb = Number(value || 0) / 1024 / 1024;
  return `${mb.toFixed(1)} Mo`;
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "creator") return "Createur";
  return "Ami";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

async function bootstrap() {
  if (state.token && state.apiBase) {
    login.hidden = true;
    app.hidden = false;
    videos.textContent = "Verification du serveur...";
    try {
      await checkServerHealth();
      showApp();
    } catch (error) {
      clearSession();
      showLogin(error.message);
    }
  } else if (state.token) {
    clearSession();
  }
}

bootstrap();
