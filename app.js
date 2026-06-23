"use strict";

const config = window.BESTOF_AMIS_CONFIG || {};
const defaultApiBase = String(config.apiBase || "").replace(/\/+$/, "");
const queryApiBase = String(new URLSearchParams(location.search).get("apiBase") || "").replace(/\/+$/, "");

const state = {
  token: localStorage.getItem("bestof_amis_token") || "",
  role: localStorage.getItem("bestof_amis_role") || "",
  label: localStorage.getItem("bestof_amis_label") || "",
  apiBase: queryApiBase || localStorage.getItem("bestof_amis_api") || defaultApiBase,
  sort: "popular",
  allVideos: [],
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

siteTitle.textContent = config.siteName || "Best Of Amis";
apiBaseInput.value = state.apiBase;
if (queryApiBase) localStorage.setItem("bestof_amis_api", queryApiBase);
if (defaultApiBase) apiBaseRow.classList.add("compact");

function apiBase() {
  return String(apiBaseInput.value || state.apiBase || "").replace(/\/+$/, "");
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const base = apiBase();
  if (!base && location.protocol !== "http:" && location.protocol !== "https:") {
    throw new Error("URL du serveur privé requise.");
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Serveur privé indisponible.");
  return data;
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
  localStorage.removeItem("bestof_amis_token");
  localStorage.removeItem("bestof_amis_role");
  localStorage.removeItem("bestof_amis_label");
  state.token = "";
  state.role = "";
  state.label = "";
  app.hidden = true;
  login.hidden = false;
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    state.sort = button.dataset.sort;
    state.visibleLimit = state.pageSize;
    document.querySelectorAll("[data-sort]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    loadVideos();
  });
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
  loadVideos();
}

async function loadVideos() {
  videos.textContent = "Chargement…";
  try {
    const data = await api(`/api/videos?sort=${encodeURIComponent(state.sort)}`);
    state.allVideos = data.videos;
    renderVideos(state.allVideos, data.role);
  } catch (error) {
    videos.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    if (error.message.includes("Code requis") || error.message.includes("indisponible")) {
      localStorage.removeItem("bestof_amis_token");
      state.token = "";
    }
  }
}

function renderVideos(items, role) {
  videos.textContent = "";
  if (!items.length) {
    videos.innerHTML = "<p>Aucun clip disponible.</p>";
    return;
  }
  const visible = items.slice(0, state.visibleLimit);
  const summary = document.createElement("div");
  summary.className = "list-summary";
  summary.textContent = `${items.length} clip(s) disponible(s) · ${visible.length} affiché(s)`;
  videos.appendChild(summary);
  for (const video of visible) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector("article");
    const player = node.querySelector("video");
    const title = node.querySelector("h2");
    const meta = node.querySelector(".meta");
    const score = node.querySelector(".score");
    const up = node.querySelector(".up");
    const down = node.querySelector(".down");
    const creatorActions = node.querySelector(".creator-actions");
    const like = node.querySelector(".like");
    const remove = node.querySelector(".delete");

    player.src = mediaSrc(video.mediaUrl);
    title.textContent = video.title;
    meta.textContent = `${formatDuration(video.duration)} · ${formatBytes(video.size)}`;
    score.textContent = `Score ${video.score} (${video.upvotes} / ${video.downvotes})`;
    up.textContent = video.userVote === 1 ? "▲ Upvoté" : "▲ Upvote";
    down.textContent = video.userVote === -1 ? "▼ Downvoté" : "▼ Downvote";

    up.addEventListener("click", () => sendVote(video.id, 1));
    down.addEventListener("click", () => sendVote(video.id, -1));
    if (role === "creator" || role === "admin") {
      creatorActions.hidden = false;
      like.addEventListener("click", () => creatorAction(video.id, "like", article));
      remove.addEventListener("click", () => creatorAction(video.id, "delete", article));
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

async function creatorAction(id, action, article) {
  const text =
    action === "delete"
      ? "Supprimer définitivement ce clip côté serveur privé ?"
      : "Déplacer ce clip dans LIKE côté serveur privé ?";
  if (!confirm(text)) return;
  await api(`/api/creator/videos/${id}/${action}`, { method: "POST", body: "{}" });
  article.remove();
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

if (state.token) showApp();
