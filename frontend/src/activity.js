/**
 * activity.js — Central de Atividades (notifications + radar + influence level)
 */

import { apiFetch, isLoggedIn, getCurrentUser } from "./auth.js";

const API_BASE = "/api";

// XP thresholds per level
const LEVEL_TIERS = [
  { level: 1, name: "Explorador", xpMax: 500 },
  { level: 2, name: "Descobridor", xpMax: 1200 },
  { level: 3, name: "Habitué", xpMax: 2200 },
  { level: 4, name: "Explorador Urbano", xpMax: 3500 },
  { level: 5, name: "Destaque Local", xpMax: 5500 },
  { level: 6, name: "Influenciador", xpMax: 8000 },
  { level: 7, name: "Explorador Noturno", xpMax: 11000 },
  { level: 8, name: "Visionário", xpMax: 15000 },
  { level: 9, name: "Lenda Urbana", xpMax: 20000 },
  { level: 10, name: "Pulso da Cidade", xpMax: Infinity },
];

function getTierInfo(xp) {
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    const tier = LEVEL_TIERS[i];
    if (xp < tier.xpMax) {
      const prevXp = i === 0 ? 0 : LEVEL_TIERS[i - 1].xpMax;
      return {
        level: tier.level,
        name: tier.name,
        nextName: LEVEL_TIERS[i + 1]?.name ?? "Máximo",
        xpCurrent: xp,
        xpMax: tier.xpMax,
        progress: ((xp - prevXp) / (tier.xpMax - prevXp)) * 100,
      };
    }
  }
  const last = LEVEL_TIERS[LEVEL_TIERS.length - 1];
  return {
    level: last.level,
    name: last.name,
    nextName: "Máximo",
    xpCurrent: xp,
    xpMax: xp,
    progress: 100,
  };
}

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------
export async function initActivityView() {
  document
    .getElementById("btn-mark-all-read")
    ?.addEventListener("click", _markAllRead);
}

export async function loadActivityView() {
  await Promise.all([_loadRadar(), _loadInfluence(), _loadFeed()]);
}

// ----------------------------------------------------------------
// Radar — uses public events endpoint to count active events
// ----------------------------------------------------------------
async function _loadRadar() {
  const activeEl = document.getElementById("radar-active");
  const nearbyEl = document.getElementById("radar-nearby");
  const trendEl = document.getElementById("radar-trend");

  try {
    const resp = await fetch(`${API_BASE}/events/`);
    if (resp.ok) {
      const geo = await resp.json();
      const total = geo.features?.length ?? 0;
      if (activeEl) activeEl.textContent = total;

      // Neighborhood frequency → trend
      const neighborhoods = {};
      for (const f of geo.features || []) {
        const n = f.properties?.neighborhood || "Centro";
        neighborhoods[n] = (neighborhoods[n] || 0) + 1;
      }
      const topNeighborhood = Object.entries(neighborhoods).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];
      if (trendEl && topNeighborhood) trendEl.textContent = topNeighborhood;
    }
  } catch (e) {
    console.warn("radar load error", e);
  }

  // Nearby — requires geolocation
  if (!navigator.geolocation) {
    if (nearbyEl) nearbyEl.textContent = "—";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const resp = await fetch(
          `${API_BASE}/events/nearby/?lat=${latitude}&lng=${longitude}&radius_km=2`
        );
        if (resp.ok) {
          const geo = await resp.json();
          if (nearbyEl)
            nearbyEl.textContent = geo.features?.length ?? 0;
        }
      } catch (e) {
        if (nearbyEl) nearbyEl.textContent = "—";
      }
    },
    () => {
      if (nearbyEl) nearbyEl.textContent = "—";
    },
    { timeout: 5000 }
  );
}

// ----------------------------------------------------------------
// Influence level — derived from created events + interactions
// ----------------------------------------------------------------
async function _loadInfluence() {
  if (!isLoggedIn()) {
    _renderInfluence(0);
    return;
  }
  try {
    // XP: 50 per event created, 10 per saved interaction received
    const resp = await apiFetch(`${API_BASE}/events/mine/`);
    let xp = 0;
    if (resp.ok) {
      const geo = await resp.json();
      const count = geo.features?.length ?? 0;
      xp += count * 50;
      // Add interactions received
      for (const f of geo.features || []) {
        const counts = f.properties?.interaction_counts;
        if (counts && typeof counts === "object") {
          xp += (counts.GOING || 0) * 5;
          xp += (counts.INTERESTED || 0) * 3;
          xp += (counts.SAVED || 0) * 2;
        }
      }
    }
    _renderInfluence(xp);
  } catch (e) {
    _renderInfluence(0);
  }
}

function _renderInfluence(xp) {
  const info = getTierInfo(xp);
  const levelEl = document.getElementById("influence-level");
  const tierEl = document.getElementById("influence-tier");
  const nextEl = document.getElementById("influence-next");
  const barEl = document.getElementById("xp-bar");
  const currentEl = document.getElementById("xp-current");
  const nextXpEl = document.getElementById("xp-next");

  if (levelEl) levelEl.innerHTML = `LV.<br>${String(info.level).padStart(2, "0")}`;
  if (tierEl) tierEl.textContent = info.name;
  if (nextEl) nextEl.textContent = `Próximo nível: ${info.nextName}`;
  if (barEl) barEl.style.width = `${Math.min(info.progress, 100)}%`;
  if (currentEl) currentEl.textContent = `${info.xpCurrent} XP`;
  if (nextXpEl)
    nextXpEl.textContent =
      info.xpMax === Infinity ? "Máximo" : `${info.xpMax} XP`;
}

// ----------------------------------------------------------------
// Activity feed — local notifications stored in localStorage
// ----------------------------------------------------------------
const FEED_KEY = "bora_activity_feed";

function _getStoredFeed() {
  try {
    return JSON.parse(localStorage.getItem(FEED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushActivityItem(item) {
  const feed = _getStoredFeed();
  feed.unshift({ ...item, id: Date.now(), timestamp: Date.now(), read: false });
  // Keep last 50 items
  if (feed.length > 50) feed.length = 50;
  localStorage.setItem(FEED_KEY, JSON.stringify(feed));
  _renderFeed(feed);
  _updateNotifBadge();
}

function _markAllRead() {
  const feed = _getStoredFeed().map((item) => ({ ...item, read: true }));
  localStorage.setItem(FEED_KEY, JSON.stringify(feed));
  _renderFeed(feed);
  _updateNotifBadge();
}

export function _updateNotifBadge() {
  const unread = _getStoredFeed().filter((i) => !i.read).length;
  const btn = document.querySelector(
    '.side-nav-item[data-view="notifications"]'
  );
  if (!btn) return;
  btn.querySelector(".notif-badge")?.remove();
  if (unread > 0) {
    const badge = document.createElement("span");
    badge.className = "notif-badge";
    badge.textContent = unread > 9 ? "9+" : unread;
    btn.appendChild(badge);
  }
}

async function _loadFeed() {
  const feed = _getStoredFeed();

  // If empty and user is logged in, seed with some events
  if (feed.length === 0 && isLoggedIn()) {
    await _seedFeedFromSavedEvents();
    return;
  }

  _renderFeed(feed);
  _updateNotifBadge();
}

async function _seedFeedFromSavedEvents() {
  try {
    const resp = await apiFetch(`${API_BASE}/events/saved/`);
    if (resp.ok) {
      const geo = await resp.json();
      for (const f of (geo.features || []).slice(0, 5)) {
        const title = f.properties?.title || "Evento";
        pushActivityItem({
          type: "saved",
          icon: "bookmark",
          title: "Evento Salvo",
          body: `"${title}" está na sua lista.`,
        });
      }
    }
  } catch (e) {
    _renderFeed([]);
  }
}

function _renderFeed(feed) {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  if (feed.length === 0) {
    container.innerHTML = `
      <div class="activity-feed-loading">
        <span class="material-symbols-outlined" style="font-size:36px;opacity:0.2">notifications</span>
        <p style="color:var(--on-surface-variant);font-size:14px">Nenhuma atividade ainda.</p>
      </div>`;
    return;
  }

  container.innerHTML = feed
    .map(
      (item) => `
    <div class="activity-item ${item.read ? "" : "unread"}">
      <div class="activity-item-icon">
        <span class="material-symbols-outlined">${item.icon || "notifications"}</span>
      </div>
      <div class="activity-item-body">
        <p class="activity-item-title">${item.title || ""}</p>
        <p class="activity-item-text">${item.body || ""}</p>
      </div>
      <span class="activity-item-time">${_timeAgo(item.timestamp)}</span>
    </div>`
    )
    .join("");
}

function _timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}
