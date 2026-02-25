/**
 * auth.js — JWT authentication (login / register / logout / profile)
 * Manages tokens in localStorage and exposes helpers to other modules.
 */

const API_BASE = "/api";

// ----------------------------------------------------------------
// Token helpers
// ----------------------------------------------------------------
export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

export function setTokens({ access, refresh }) {
  localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export function isLoggedIn() {
  return !!getAccessToken();
}

export function getCurrentUser() {
  const raw = localStorage.getItem("user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ----------------------------------------------------------------
// Authenticated fetch wrapper — auto-refreshes expired tokens
// ----------------------------------------------------------------
export async function apiFetch(url, options = {}) {
  const token = getAccessToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Don't set Content-Type for FormData (browser handles boundary)
  if (!(options.body instanceof FormData) && options.body) {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(url, { ...options, headers });

  // Token expired → try refreshing
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
      response = await fetch(url, { ...options, headers });
    } else {
      logout();
    }
  }

  return response;
}

// ----------------------------------------------------------------
// Refresh access token
// ----------------------------------------------------------------
async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const resp = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (resp.ok) {
      const data = await resp.json();
      setTokens({ access: data.access, refresh: data.refresh || refresh });
      return true;
    }
  } catch (err) {
    console.error("Token refresh failed:", err);
  }

  return false;
}

// ----------------------------------------------------------------
// Auth API calls
// ----------------------------------------------------------------
export async function login(email, password) {
  const resp = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await resp.json();

  if (resp.ok) {
    setTokens({ access: data.access, refresh: data.refresh });
    await loadCurrentUser();
    return { ok: true, data };
  }

  return { ok: false, errors: data };
}

export async function register(email, password1, password2) {
  const resp = await fetch(`${API_BASE}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password1, password2 }),
  });

  const data = await resp.json();

  if (resp.ok) {
    setTokens({ access: data.access, refresh: data.refresh });
    await loadCurrentUser();
    return { ok: true, data };
  }

  return { ok: false, errors: data };
}

export async function logout() {
  const refresh = getRefreshToken();
  if (refresh && isLoggedIn()) {
    await apiFetch(`${API_BASE}/auth/logout/`, {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }).catch(() => {});
  }
  clearTokens();
  renderAuthSection();
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

export async function loadCurrentUser() {
  const resp = await apiFetch(`${API_BASE}/auth/me/`);
  if (resp.ok) {
    const user = await resp.json();
    localStorage.setItem("user", JSON.stringify(user));
    renderAuthSection();
    return user;
  }
  return null;
}

// ----------------------------------------------------------------
// Render auth section in sidebar
// ----------------------------------------------------------------
function renderAuthSection() {
  const container = document.getElementById("auth-section");
  if (!container) return;

  const user = getCurrentUser();

  if (user) {
    const name = user.first_name || user.email.split("@")[0];
    const avatar = user.profile?.avatar_url;

    container.innerHTML = `
      <div class="flex items-center gap-2 mb-2">
        ${avatar
          ? `<img src="${avatar}" class="w-8 h-8 rounded-full object-cover" alt="Avatar" />`
          : `<div class="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-sm font-bold">${name[0].toUpperCase()}</div>`
        }
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">${name}</p>
          <p class="text-xs text-gray-400 truncate">${user.email}</p>
        </div>
      </div>
      <button id="btn-my-events"
        class="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition text-gray-300 flex items-center gap-2">
        🗓️ Meus eventos
      </button>
      <button id="btn-logout"
        class="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition text-gray-400 flex items-center gap-2">
        🚪 Sair
      </button>
    `;

    container.querySelector("#btn-logout")?.addEventListener("click", logout);
    container.querySelector("#btn-my-events")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("show:my-events"));
    });
  } else {
    container.innerHTML = `
      <button id="btn-open-login"
        class="w-full text-center text-sm px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-gray-300 flex items-center justify-center gap-2">
        🔑 Entrar / Cadastrar
      </button>
    `;
    container.querySelector("#btn-open-login")?.addEventListener("click", showAuthModal);
  }
}

// ----------------------------------------------------------------
// Simple auth modal (inline, no extra library)
// ----------------------------------------------------------------
function showAuthModal() {
  const existing = document.getElementById("auth-modal-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "auth-modal-overlay";
  overlay.className = "fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4";

  overlay.innerHTML = `
    <div class="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm shadow-2xl p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold" id="auth-modal-title">Entrar</h2>
        <button id="auth-modal-close" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
      </div>

      <div class="flex gap-2 mb-4">
        <button id="tab-login" class="flex-1 py-1.5 rounded-lg bg-brand text-white text-sm font-medium">Entrar</button>
        <button id="tab-register" class="flex-1 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition">Cadastrar</button>
      </div>

      <form id="auth-form" class="space-y-3">
        <input name="email" type="email" required placeholder="E-mail" class="form-input" />
        <input name="password" type="password" required placeholder="Senha" class="form-input" />
        <div id="password2-field" class="hidden">
          <input name="password2" type="password" placeholder="Confirme a senha" class="form-input" />
        </div>
        <div id="auth-error" class="hidden text-sm text-red-400 bg-red-900/40 rounded-lg px-3 py-2"></div>
        <button type="submit" class="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-lg transition">
          Entrar
        </button>
      </form>

      <div class="mt-4 pt-3 border-t border-gray-700">
        <a href="/api/auth/google/" class="flex items-center justify-center gap-2 w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition">
          <span>🔵</span> Continuar com Google
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let mode = "login";
  const form = overlay.querySelector("#auth-form");
  const errDiv = overlay.querySelector("#auth-error");
  const pw2Field = overlay.querySelector("#password2-field");
  const titleEl = overlay.querySelector("#auth-modal-title");
  const submitBtn = form.querySelector("button[type=submit]");

  overlay.querySelector("#auth-modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  function setMode(m) {
    mode = m;
    if (m === "login") {
      titleEl.textContent = "Entrar";
      submitBtn.textContent = "Entrar";
      pw2Field.classList.add("hidden");
      overlay.querySelector("#tab-login").className = "flex-1 py-1.5 rounded-lg bg-brand text-white text-sm font-medium";
      overlay.querySelector("#tab-register").className = "flex-1 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition";
    } else {
      titleEl.textContent = "Criar conta";
      submitBtn.textContent = "Cadastrar";
      pw2Field.classList.remove("hidden");
      overlay.querySelector("#tab-register").className = "flex-1 py-1.5 rounded-lg bg-brand text-white text-sm font-medium";
      overlay.querySelector("#tab-login").className = "flex-1 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition";
    }
  }

  overlay.querySelector("#tab-login").addEventListener("click", () => setMode("login"));
  overlay.querySelector("#tab-register").addEventListener("click", () => setMode("register"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errDiv.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "...";

    const fd = new FormData(form);
    const email = fd.get("email");
    const password = fd.get("password");

    let result;
    if (mode === "login") {
      result = await login(email, password);
    } else {
      result = await register(email, password, fd.get("password2"));
    }

    if (result.ok) {
      overlay.remove();
      showToast("✅ Bem-vindo(a)!", "success");
      renderAuthSection();
      window.dispatchEvent(new CustomEvent("auth:login"));
    } else {
      const msg = Object.values(result.errors).flat().join(" ");
      errDiv.textContent = msg;
      errDiv.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "login" ? "Entrar" : "Cadastrar";
    }
  });
}

// ----------------------------------------------------------------
// Toast helper (shared across modules)
// ----------------------------------------------------------------
export function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
    <span class="text-sm flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-white ml-2 text-lg leading-none">×</button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ----------------------------------------------------------------
// Initialise on page load
// ----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  if (isLoggedIn()) {
    await loadCurrentUser();
  } else {
    renderAuthSection();
  }
});
