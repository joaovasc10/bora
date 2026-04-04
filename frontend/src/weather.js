/**
 * weather.js — Fetches current weather for Porto Alegre using Open-Meteo (no API key)
 * Updates the weather widget in the map view.
 */

// Porto Alegre coordinates
const LAT = -30.0277;
const LNG = -51.2287;

// https://open-meteo.com/en/docs#weathervariables
const WMO_CODES = {
  0: "Céu limpo",
  1: "Quase limpo",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Geada",
  51: "Garoa leve",
  53: "Garoa",
  55: "Garoa intensa",
  61: "Chuva leve",
  63: "Chuva",
  65: "Chuva forte",
  71: "Neve leve",
  73: "Neve",
  75: "Neve forte",
  80: "Pancadas",
  81: "Pancadas fortes",
  82: "Pancadas violentas",
  95: "Trovoada",
  96: "Trovoada c/ granizo",
  99: "Trovoada c/ granizo forte",
};

function wmoToCondition(code) {
  return WMO_CODES[code] ?? "—";
}

export async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LNG}` +
    `&current=temperature_2m,weathercode` +
    `&timezone=America%2FSao_Paulo`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
    const data = await resp.json();
    const temp = Math.round(data.current?.temperature_2m ?? null);
    const code = data.current?.weathercode ?? null;
    return {
      temp: temp !== null ? `${temp}°` : "—°",
      condition: code !== null ? wmoToCondition(code) : "—",
    };
  } catch (err) {
    console.warn("weather fetch failed:", err);
    return { temp: "—°", condition: "—" };
  }
}

export async function initWeatherWidget() {
  const tempEl = document.getElementById("weather-temp");
  const condEl = document.getElementById("weather-cond");
  if (!tempEl || !condEl) return;

  const { temp, condition } = await fetchWeather();
  tempEl.textContent = temp;
  condEl.textContent = condition;

  // Refresh every 15 minutes
  setInterval(async () => {
    const updated = await fetchWeather();
    tempEl.textContent = updated.temp;
    condEl.textContent = updated.condition;
  }, 15 * 60 * 1000);
}
