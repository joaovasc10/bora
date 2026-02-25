/**
 * map.js — Mapbox GL JS initialisation and core map logic
 *
 * - Loads Mapbox token from backend /api/auth/mapbox-token/
 * - Dark-mode map centered on Porto Alegre
 * - Exposes mapInstance and flyToEvent for other modules
 * - Handles cluster click → zoom-in behaviour
 * - Coordinates with pins.js for Three.js markers
 */

import { showToast } from "./auth.js";

// ----------------------------------------------------------------
// Get token from backend (scoped public token)
// ----------------------------------------------------------------
async function fetchMapboxToken() {
  try {
    const resp = await fetch("/api/auth/mapbox-token/");
    if (resp.ok) {
      const data = await resp.json();
      return data.token;
    }
  } catch (err) {
    console.warn("Could not fetch Mapbox token from backend, trying window fallback.");
  }
  // Fallback: injected by server-side template or set in window
  return window.MAPBOX_TOKEN || "";
}

// ----------------------------------------------------------------
// Map singleton
// ----------------------------------------------------------------
let mapInstance = null;

export function getMap() {
  return mapInstance;
}

// ----------------------------------------------------------------
// Initialise map
// ----------------------------------------------------------------
export async function initMap() {
  const token = await fetchMapboxToken();
  if (!token) {
    showToast("Mapbox token ausente. Verifique a configuração.", "error");
    return;
  }

  mapboxgl.accessToken = token;

  mapInstance = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [-51.2177, -30.0346],  // Porto Alegre
    zoom: 13,
    attributionControl: true,
    logoPosition: "bottom-left",
  });

  // Navigation controls
  mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");
  mapInstance.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserHeading: false,
    }),
    "top-right"
  );

  mapInstance.on("load", () => {
    // Hide loading overlay
    const overlay = document.getElementById("map-loading");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 500);
    }

    // Add GeoJSON source (will be populated by events.js)
    mapInstance.addSource("events-source", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    addClusterLayers();
    window.dispatchEvent(new CustomEvent("map:ready"));
  });

  // Click on cluster → zoom in
  mapInstance.on("click", "clusters", (e) => {
    const features = mapInstance.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0].properties.cluster_id;
    mapInstance.getSource("events-source").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      mapInstance.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom + 1,
      });
    });
  });

  mapInstance.on("mouseenter", "clusters", () => {
    mapInstance.getCanvas().style.cursor = "pointer";
  });
  mapInstance.on("mouseleave", "clusters", () => {
    mapInstance.getCanvas().style.cursor = "";
  });

  return mapInstance;
}

// ----------------------------------------------------------------
// Cluster layers (Mapbox native clustering)
// ----------------------------------------------------------------
function addClusterLayers() {
  // Cluster circles
  mapInstance.addLayer({
    id: "clusters",
    type: "circle",
    source: "events-source",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#3B82F6",
        10, "#8B5CF6",
        30, "#EC4899",
      ],
      "circle-radius": [
        "step",
        ["get", "point_count"],
        24,
        10, 32,
        30, 40,
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "rgba(17, 24, 39, 0.9)",
      "circle-opacity": 0.9,
    },
  });

  // Cluster count label
  mapInstance.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "events-source",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 14,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });
}

// ----------------------------------------------------------------
// Update map data source
// ----------------------------------------------------------------
export function updateMapSource(geojsonData) {
  const source = mapInstance?.getSource("events-source");
  if (source) {
    source.setData(geojsonData);
  }
}

// ----------------------------------------------------------------
// Fly to event
// ----------------------------------------------------------------
export function flyToEvent(lngLat, zoom = 15) {
  if (!mapInstance) return;
  mapInstance.flyTo({
    center: lngLat,
    zoom,
    duration: 1800,
    essential: true,
  });
}

// ----------------------------------------------------------------
// Click handler for individual pins (Three.js markers listen separately,
// but we also handle the invisible click radius here as backup)
// ----------------------------------------------------------------
export function onPinClick(callback) {
  mapInstance?.on("click", "unclustered-point-invisible", (e) => {
    if (!e.features?.[0]) return;
    const props = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates;
    callback({ ...props, _coordinates: coords });
  });

  mapInstance?.on("mouseenter", "unclustered-point-invisible", () => {
    mapInstance.getCanvas().style.cursor = "pointer";
  });
  mapInstance?.on("mouseleave", "unclustered-point-invisible", () => {
    mapInstance.getCanvas().style.cursor = "";
  });
}

// ----------------------------------------------------------------
// Add invisible click target layer for unclustered events
// (Three.js does the visual rendering; this layer provides events)
// ----------------------------------------------------------------
export function addInvisibleClickLayer() {
  if (!mapInstance?.getLayer("unclustered-point-invisible")) {
    mapInstance?.addLayer({
      id: "unclustered-point-invisible",
      type: "circle",
      source: "events-source",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 18,
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    });
  }
}
