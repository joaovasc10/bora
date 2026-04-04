/**
 * profile.js — User profile view logic
 */

import { apiFetch, isLoggedIn, getCurrentUser, logout, showToast } from "./auth.js";

const API_BASE = "/api";

export function initProfileView() {
  document
    .getElementById("profile-btn-logout")
    ?.addEventListener("click", async () => {
      await logout();
      // Navigate back to map
      window.dispatchEvent(new CustomEvent("nav:goto", { detail: "map" }));
    });

  document
    .getElementById("profile-btn-add-event")
    ?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("nav:goto", { detail: "add" }));
    });

  window.addEventListener("auth:login", loadProfileView);
  window.addEventListener("auth:logout", loadProfileView);
}

export async function loadProfileView() {
  const user = getCurrentUser();

  _renderProfileBase(user);

  if (!isLoggedIn() || !user) return;

  await Promise.all([_loadMyEvents(), _loadSavedCount(), _loadGoingCount()]);
}

function _renderProfileBase(user) {
  const avatarEl = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-name");
  const metaEl = document.getElementById("profile-meta");
  const levelEl = document.getElementById("profile-level-badge");
  const bioEl = document.getElementById("profile-bio");

  if (!user) {
    if (nameEl) nameEl.textContent = "Visitante";
    if (levelEl) levelEl.textContent = "NÃO LOGADO";
    return;
  }

  const name =
    (user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name) || user.email.split("@")[0];
  const avatar = user.profile?.avatar_url;
  const initial = name[0].toUpperCase();

  if (avatarEl) {
    avatarEl.innerHTML = avatar
      ? `<img src="${avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : `<span style="font-size:40px;font-weight:700;color:var(--on-surface)">${initial}</span>`;
  }
  if (nameEl) nameEl.textContent = name;
  if (metaEl) {
    const joined = user.date_joined
      ? new Date(user.date_joined).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      })
      : "";
    metaEl.textContent = `Porto Alegre, RS${joined ? " • Membro desde " + joined : ""}`;
  }
  if (bioEl) {
    bioEl.textContent =
      user.profile?.bio || "Explorando os melhores eventos de Porto Alegre.";
  }
}

async function _loadMyEvents() {
  const container = document.getElementById("profile-my-events");
  const countEl = document.getElementById("profile-events-count");

  try {
    const resp = await apiFetch(`${API_BASE}/events/mine/`);
    if (!resp.ok) return;
    const geo = await resp.json();
    const events = geo.features || [];

    if (countEl) countEl.textContent = events.length;

    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `<p style="color:var(--on-surface-variant);font-size:14px;padding:16px 0">Nenhum evento criado ainda.</p>`;
      return;
    }

    container.innerHTML = events
      .slice(0, 5)
      .map((f) => {
        const p = f.properties || {};
        const dateStr = p.start_datetime
          ? new Date(p.start_datetime).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
          : "";
        return `
        <div class="profile-event-row">
          <div>
            <p class="profile-event-title">${p.title || ""}</p>
            ${dateStr ? `<p class="profile-event-meta">${dateStr} · ${p.neighborhood || ""}</p>` : ""}
          </div>
          <span class="profile-event-status ${p.status === "PUBLISHED" ? "published" : "draft"}">
            ${p.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
          </span>
        </div>`;
      })
      .join("");
  } catch (e) {
    console.warn("profile events error", e);
  }
}

async function _loadSavedCount() {
  const el = document.getElementById("profile-saved-count");
  if (!el) return;
  try {
    const resp = await apiFetch(`${API_BASE}/events/saved/`);
    if (resp.ok) {
      const geo = await resp.json();
      el.textContent = geo.features?.length ?? 0;
    }
  } catch (e) { }
}

async function _loadGoingCount() {
  const el = document.getElementById("profile-going-count");
  if (!el) return;
  // No dedicated endpoint — approximate from cached user data
  el.textContent = "—";
}
