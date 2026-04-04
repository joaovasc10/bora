/**
 * app.js — Application bootstrap
 */

import { initMap, addInvisibleClickLayer, onPinClick, getMap } from "./map.js";
import { initThreeOverlay, normaliseProps } from "./pins.js";
import { loadAndRenderEvents, openEventDetail, closeEventDetail, initCreateEventModal, loadExploreEvents, filters } from "./events.js";
import { fetchCategories, renderCategoryFilters, initDateFilters, initFreeFilter, initSearchFilter } from "./filters.js";
import { initWeatherWidget } from "./weather.js";
import { initSavedView, loadSavedEvents } from "./saved.js";
import { initActivityView, loadActivityView, _updateNotifBadge } from "./activity.js";
import { initSettingsView } from "./settings.js";
import { initProfileView, loadProfileView } from "./profile.js";

let defaultCityId = null;

// ----------------------------------------------------------------
// View navigation
// ----------------------------------------------------------------
async function showView(slug) {
  if (slug === "add") {
    document.getElementById("btn-new-event")?.click();
    return;
  }

  const viewId = `view-${slug}`;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(viewId);
  if (target) target.classList.add("active");

  // Update side-nav active state (buttons + avatar)
  document.querySelectorAll(".side-nav-item[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === slug);
  });
  const avatar = document.getElementById("side-nav-avatar");
  if (avatar) {
    avatar.classList.toggle("active", slug === "profile");
  }

  // Trigger view-specific data load
  if (slug === "explore") {
    loadExploreEvents();
  } else if (slug === "saved") {
    loadSavedEvents();
  } else if (slug === "notifications") {
    loadActivityView();
  } else if (slug === "profile") {
    loadProfileView();
  }
}

function initNavigation() {
  // Side nav buttons with data-view
  document.querySelectorAll(".side-nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => showView(item.dataset.view));
  });

  // Avatar → profile
  document.getElementById("side-nav-avatar")?.addEventListener("click", () => showView("profile"));

  // Logo → home
  document.getElementById("btn-nav-home")?.addEventListener("click", () => showView("map"));

  // "Open map" button in explore view
  document.getElementById("btn-open-map")?.addEventListener("click", () => showView("map"));

  // "New event" in explore view
  document.getElementById("btn-new-event-explore")?.addEventListener("click", () => {
    document.getElementById("btn-new-event")?.click();
  });

  // Floating category filter chips
  document.querySelectorAll("[data-float-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.dataset.floatCat;
      const isAll = slug === "all";

      document.querySelectorAll("[data-float-cat]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      filters.categories = isAll ? [] : [slug];
      loadAndRenderEvents();
    });
  });

  // Explore category nav
  document.querySelectorAll("[data-explore-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-explore-cat]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const slug = btn.dataset.exploreCat;
      filters.categories = slug === "all" ? [] : [slug];
      loadExploreEvents();
    });
  });
}

// ----------------------------------------------------------------
// Custom map controls
// ----------------------------------------------------------------
function initMapControls() {
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    getMap()?.zoomIn({ duration: 200 });
  });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    getMap()?.zoomOut({ duration: 200 });
  });
  document.getElementById("btn-geolocate")?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        getMap()?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 1200,
        });
      },
      () => {
        const { showToast } = import("./auth.js");
      }
    );
  });

  // Close event detail when clicking the map background
  document.getElementById("map-area")?.addEventListener("click", (e) => {
    if (e.target.closest(".map-pin, #event-detail-card, #event-full-panel, #inner-panel, #map-controls, #floating-filters, #weather-widget")) return;
    closeEventDetail();
  });
}

async function bootstrap() {
  // 1. Init navigation
  initNavigation();

  // 2. Init new views (non-map)
  initSavedView();
  initActivityView();
  initSettingsView();
  initProfileView();

  // 3. Init Mapbox map
  const map = await initMap();
  if (!map) return;

  // 4. Wait for map to be ready
  window.addEventListener(
    "map:ready",
    async () => {
      // 5. Init pin overlay (no-op if using DOM markers)
      initThreeOverlay();

      // 6. Invisible click layer (fallback for Mapbox events)
      addInvisibleClickLayer();

      // 7. Categories
      const categories = await fetchCategories();
      renderCategoryFilters(categories);

      // 8. Filter controls
      initDateFilters();
      initFreeFilter();
      initSearchFilter();

      // 9. Load Porto Alegre city id
      try {
        const cityResp = await fetch("/api/cities/porto-alegre/");
        if (cityResp.ok) {
          const city = await cityResp.json();
          defaultCityId = city.id;
        }
      } catch (e) {
        console.warn("Could not load Porto Alegre city data:", e);
      }

      // 10. Load events onto map
      await loadAndRenderEvents();

      // 11. Update nearby count in weather widget
      _updateNearbyCount();

      // 12. Start weather widget
      initWeatherWidget();

      // 13. Init notification badge
      _updateNotifBadge();

      // 14a. Pin click (DOM Marker via custom event)
      window.addEventListener("pin:clicked", (e) => {
        openEventDetail(e.detail.eventData, e.detail.coords);
      });

      // 14b. Invisible Mapbox layer click (fallback)
      onPinClick((props) => {
        const coords = props._coordinates;
        openEventDetail(props, coords);
      });

      // 15. Create-event modal
      initCreateEventModal(categories, defaultCityId);

      // 16. Auth changes → reload events + refresh views
      window.addEventListener("auth:login", async () => {
        await loadAndRenderEvents();
        _updateNearbyCount();
      });
      window.addEventListener("auth:logout", async () => {
        await loadAndRenderEvents();
        _updateNearbyCount();
      });

      // 17. Custom map controls
      initMapControls();
    },
    { once: true }
  );

  // 18. "Meus eventos" — registrado FORA do map:ready para não duplicar
  window.addEventListener("show:my-events", handleShowMyEvents);

  // 19. Internal navigation events (from profile/settings)
  window.addEventListener("nav:goto", (e) => showView(e.detail));
}

function _updateNearbyCount() {
  const el = document.getElementById("nearby-count");
  if (!el) return;
  // Count active markers (after renderPins runs)
  // We approximate by querying rendered pin elements
  const count = document.querySelectorAll(".map-pin").length;
  el.textContent = count;
}

async function handleShowMyEvents() {
  try {
    const authModule = await import("./auth.js");
    const token = authModule.getAccessToken?.();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const resp = await fetch("/api/events/mine/", { headers });
    if (!resp.ok) throw new Error(`${resp.status}`);

    const geojson = await resp.json();
    const features = geojson.features || [];

    if (features.length === 0) {
      const { showToast } = await import("./auth.js");
      showToast("Você ainda não criou eventos.", "info");
      return;
    }

    const f = features[0];
    const props = { ...(f.properties || {}) };
    if (!props.id && f.id) props.id = f.id;
    openEventDetail(props, f.geometry?.coordinates);
  } catch (e) {
    console.warn("show:my-events error:", e);
  }
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}