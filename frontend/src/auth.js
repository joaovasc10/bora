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
    }).catch(() => { });
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
// Render auth section in sidebar + update nav avatar
// ----------------------------------------------------------------
function renderAuthSection() {
  const container = document.getElementById("auth-section");
  const navAvatar = document.getElementById("side-nav-avatar");

  const user = getCurrentUser();

  if (user) {
    const name = user.first_name || user.email.split("@")[0];
    const avatar = user.profile?.avatar_url;
    const initial = name[0].toUpperCase();

    // Update side-nav avatar
    if (navAvatar) {
      navAvatar.innerHTML = avatar
        ? `<img src="${avatar}" alt="Avatar" />`
        : `<span style="font-size:15px;font-weight:700;color:var(--on-surface)">${initial}</span>`;
    }

    if (container) {
      container.innerHTML = `
        <div class="auth-user-row">
          <div class="auth-avatar">
            ${avatar
          ? `<img src="${avatar}" alt="Avatar" />`
          : `<span style="font-size:13px;font-weight:700">${initial}</span>`
        }
          </div>
          <div style="min-width:0">
            <p class="auth-user-name">${name}</p>
            <p class="auth-user-email">${user.email}</p>
          </div>
        </div>
        <button id="btn-my-events" class="auth-action-btn">
          <span class="material-symbols-outlined">calendar_month</span>
          Meus eventos
        </button>
        <button id="btn-logout" class="auth-action-btn">
          <span class="material-symbols-outlined">logout</span>
          Sair
        </button>
      `;

      container.querySelector("#btn-logout")?.addEventListener("click", logout);
      container.querySelector("#btn-my-events")?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("show:my-events"));
      });
    }
  } else {
    // Reset nav avatar
    if (navAvatar) {
      navAvatar.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px;color:var(--on-surface-variant)">person</span>`;
    }

    if (container) {
      container.innerHTML = `
        <button id="btn-open-login" class="btn-login">
          <span class="material-symbols-outlined" style="font-size:16px">key</span>
          Entrar / Cadastrar
        </button>
      `;
      container.querySelector("#btn-open-login")?.addEventListener("click", showAuthModal);
    }
  }
}

// ----------------------------------------------------------------
// Auth modal with new design
// ----------------------------------------------------------------
export function showAuthModal() {
  const existing = document.getElementById("auth-modal-overlay");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "auth-modal-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px";

  overlay.innerHTML = `
    <div style="background:rgba(26,26,26,0.95);backdrop-filter:blur(32px);border-radius:20px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 60px rgba(0,0,0,0.8);width:100%;max-width:380px;padding:0;overflow:hidden">
      <div style="padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2 id="auth-modal-title" style="font-size:22px;font-weight:900;letter-spacing:-0.02em;color:var(--on-surface);margin:0 0 3px">Entrar</h2>
          <p style="font-size:13px;color:var(--on-surface-variant);margin:0">Bem-vindo ao Bora</p>
        </div>
        <button id="auth-modal-close"
          style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:var(--on-surface-variant);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px">
          <span class="material-symbols-outlined" style="font-size:18px">close</span>
        </button>
      </div>

      <div style="padding:20px 28px 24px">
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <button id="tab-login" data-active="true"
            style="flex:1;padding:9px;border-radius:10px;background:var(--primary);color:#fff;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer">
            Entrar
          </button>
          <button id="tab-register" data-active="false"
            style="flex:1;padding:9px;border-radius:10px;background:var(--surface-high);color:var(--on-surface-variant);border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:background 0.15s">
            Cadastrar
          </button>
        </div>

        <form id="auth-form" style="display:flex;flex-direction:column;gap:12px">
          <input name="email" type="email" required placeholder="E-mail" class="modal-input" />
          <input name="password" type="password" required placeholder="Senha" class="modal-input" />
          <div id="password2-field" style="display:none">
            <input name="password2" type="password" placeholder="Confirme a senha" class="modal-input" style="width:100%" />
          </div>
          <div id="auth-error" style="display:none;font-size:13px;color:#fca5a5;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:10px 14px"></div>
          <button type="submit"
            style="background:linear-gradient(135deg,#FFB690,#F97316);color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:transform 0.15s">
            Entrar
          </button>
        </form>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">
          <a href="/api/auth/google/"
            style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px;background:var(--surface-high);border:1px solid var(--outline);border-radius:12px;font-size:13px;color:var(--on-surface-variant);text-decoration:none;transition:background 0.15s;font-family:'Plus Jakarta Sans',sans-serif">
            <span class="material-symbols-outlined" style="font-size:18px;color:#4285F4">account_circle</span>
            Continuar com Google
          </a>
        </div>
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
  const tabLogin = overlay.querySelector("#tab-login");
  const tabRegister = overlay.querySelector("#tab-register");

  overlay.querySelector("#auth-modal-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  function setMode(m) {
    mode = m;
    const activeStyle = "flex:1;padding:9px;border-radius:10px;background:var(--primary);color:#fff;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer";
    const inactiveStyle = "flex:1;padding:9px;border-radius:10px;background:var(--surface-high);color:var(--on-surface-variant);border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:background 0.15s";
    if (m === "login") {
      titleEl.textContent = "Entrar";
      submitBtn.textContent = "Entrar";
      pw2Field.style.display = "none";
      tabLogin.style.cssText = activeStyle;
      tabRegister.style.cssText = inactiveStyle;
    } else {
      titleEl.textContent = "Criar conta";
      submitBtn.textContent = "Cadastrar";
      pw2Field.style.display = "block";
      tabRegister.style.cssText = activeStyle;
      tabLogin.style.cssText = inactiveStyle;
    }
  }

  tabLogin.addEventListener("click", () => setMode("login"));
  tabRegister.addEventListener("click", () => setMode("register"));

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

  const icons = { success: "check_circle", error: "error", info: "info" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:18px;flex-shrink:0;color:${type === "success" ? "#22C55E" : type === "error" ? "#EF4444" : "var(--primary)"}">${icons[type] || "info"}</span>
    <span style="flex:1;font-size:13px">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--on-surface-variant);cursor:pointer;font-size:18px;line-height:1;padding:0;margin-left:8px">&times;</button>
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
