/**
 * settings.js — Preferences / Settings view logic
 */

import { apiFetch, isLoggedIn, getCurrentUser, loadCurrentUser, showToast, logout } from "./auth.js";

const API_BASE = "/api";

export function initSettingsView() {
  _populateForm();
  _bindSaveButton();
  _bindDeleteAccount();
  _loadTogglesFromStorage();

  // Re-populate when user logs in
  window.addEventListener("auth:login", _populateForm);
}

function _populateForm() {
  const user = getCurrentUser();
  const nameInput = document.getElementById("settings-name");
  const emailInput = document.getElementById("settings-email");
  const avatarEl = document.getElementById("settings-avatar");

  if (!user) {
    if (nameInput) nameInput.value = "";
    if (emailInput) emailInput.value = "";
    return;
  }

  if (nameInput) nameInput.value = user.first_name || "";
  if (emailInput) emailInput.value = user.email || "";

  const avatar = user.profile?.avatar_url;
  const initial = (user.first_name || user.email || "U")[0].toUpperCase();
  if (avatarEl) {
    avatarEl.innerHTML = avatar
      ? `<img src="${avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : `<span style="font-size:28px;font-weight:700;color:var(--on-surface)">${initial}</span>`;
  }
}

function _bindSaveButton() {
  document
    .getElementById("btn-update-profile")
    ?.addEventListener("click", async () => {
      if (!isLoggedIn()) {
        showToast("Faça login para atualizar o perfil.", "info");
        return;
      }
      const name = document.getElementById("settings-name")?.value.trim();
      if (!name) {
        showToast("Insira um nome válido.", "error");
        return;
      }

      const btn = document.getElementById("btn-update-profile");
      if (btn) btn.disabled = true;

      try {
        const resp = await apiFetch(`${API_BASE}/auth/me/`, {
          method: "PATCH",
          body: JSON.stringify({ first_name: name }),
        });
        if (resp.ok) {
          await loadCurrentUser();
          showToast("Perfil atualizado!", "success");
        } else {
          showToast("Erro ao atualizar o perfil.", "error");
        }
      } catch (e) {
        showToast("Erro de conexão.", "error");
      } finally {
        if (btn) btn.disabled = false;
      }
    });
}

function _bindDeleteAccount() {
  document
    .getElementById("btn-delete-account")
    ?.addEventListener("click", () => {
      if (
        !confirm(
          "Tem certeza que deseja excluir sua conta? Esta ação é irreversível."
        )
      )
        return;
      showToast(
        "Funcionalidade em desenvolvimento. Entre em contato com o suporte.",
        "info"
      );
    });
}

function _loadTogglesFromStorage() {
  const prefs = _getPrefs();
  const darkAuto = document.getElementById("toggle-dark-auto");
  const notifNearby = document.getElementById("toggle-notif-nearby");
  const notifWeather = document.getElementById("toggle-notif-weather");

  if (darkAuto) darkAuto.checked = prefs.darkAuto ?? false;
  if (notifNearby) notifNearby.checked = prefs.notifNearby ?? true;
  if (notifWeather) notifWeather.checked = prefs.notifWeather ?? false;

  darkAuto?.addEventListener("change", () => _savePrefs({ darkAuto: darkAuto.checked }));
  notifNearby?.addEventListener("change", () =>
    _savePrefs({ notifNearby: notifNearby.checked })
  );
  notifWeather?.addEventListener("change", () =>
    _savePrefs({ notifWeather: notifWeather.checked })
  );
}

function _getPrefs() {
  try {
    return JSON.parse(localStorage.getItem("bora_prefs") || "{}");
  } catch {
    return {};
  }
}

function _savePrefs(patch) {
  const prefs = { ..._getPrefs(), ...patch };
  localStorage.setItem("bora_prefs", JSON.stringify(prefs));
}
