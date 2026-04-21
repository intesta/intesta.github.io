"use strict";

const appLoaderEl = document.querySelector("#app-loader");
let isAppLoaderHidden = false;
const startupTasks = new Set();
const preloadedImagePromises = new Map();
const preloadedAudioPromises = new Map();
const GALLERY_LIKE_ICON_EMPTY_URL = "./assets/images/empty-like.svg";
const GALLERY_LIKE_ICON_FILLED_URL = "./assets/images/like.png";
const STATIC_IMAGE_PRELOAD_URLS = [
  "./assets/images/logo.png",
  "./assets/images/tomas.png",
  "./assets/images/casco.png",
  "./assets/images/alex.png",
  "./assets/images/x-square.svg",
  "./assets/images/x.svg",
  "./assets/images/circle.svg",
  "./assets/images/base_casco_intesta.png",
  "./assets/images/AI.png",
  "./assets/images/chevrons-down.svg",
  "./assets/images/send-light.svg",
  "./assets/images/send.svg",
  "./assets/images/upload.svg",
  "./assets/images/check-circle.svg",
  "./assets/images/alert-circle.svg",
  "./assets/images/close_popup.svg",
  GALLERY_LIKE_ICON_EMPTY_URL,
  GALLERY_LIKE_ICON_FILLED_URL
];
const CRITICAL_ICON_PRELOAD_URLS = [
  GALLERY_LIKE_ICON_EMPTY_URL,
  GALLERY_LIKE_ICON_FILLED_URL,
  "./assets/images/x-square.svg",
  "./assets/images/close_popup.svg",
  "./assets/images/send-light.svg",
  "./assets/images/send.svg",
  "./assets/images/upload.svg"
];
const STATIC_SOUND_PRELOAD_URLS = [
  "./assets/sounds/lowFrequency_explosion_000.ogg",
  "./assets/sounds/forceField_002.ogg",
  "./assets/sounds/forceField_003.ogg",
  "./assets/sounds/impactMetal_001.ogg",
  "./assets/sounds/spaceEngineLow_001.ogg",
  "./assets/sounds/spaceEngineLow_000.ogg",
  "./assets/sounds/laserSmall_004.ogg",
  "./assets/sounds/impactMetal_004.ogg"
];
const NAV_DOWN_SOUND_URL = "./assets/sounds/lowFrequency_explosion_000.ogg";
const CHOICE_NO_SOUND_URL = "./assets/sounds/forceField_002.ogg";
const CHOICE_YES_SOUND_URL = "./assets/sounds/forceField_003.ogg";
const HELMET_ACTION_SOUND_URL = "./assets/sounds/impactMetal_001.ogg";
const AI_PANEL_SOUND_URL = "./assets/sounds/spaceEngineLow_001.ogg";
const QUESTION_TYPEWRITER_SOUND_URL = "./assets/sounds/spaceEngineLow_000.ogg";
const GALLERY_HEART_SOUND_URL = "./assets/sounds/laserSmall_004.ogg";
const POPUP_CLOSE_SOUND_URL = "./assets/sounds/impactMetal_004.ogg";
const NAV_DOWN_SOUND_VOLUME = 0.83;
const CHOICE_SOUND_VOLUME = 0.31;
const HELMET_ACTION_SOUND_VOLUME = 0.93;
const AI_PANEL_SOUND_VOLUME = 0.93;
const AI_PANEL_SOUND_MAX_DURATION_MS = 250;
const QUESTION_TYPEWRITER_SOUND_VOLUME = 0.5;
const GALLERY_HEART_SOUND_VOLUME = 0.56;
const POPUP_CLOSE_SOUND_VOLUME = 0.93;
const uiSoundCache = new Map();
let aiPanelSoundStopTimerId = null;

function getUiSound(soundKey, sourceUrl, volume = 1) {
  const cachedSound = uiSoundCache.get(soundKey);
  if (cachedSound instanceof HTMLAudioElement) {
    return cachedSound;
  }
  if (typeof Audio !== "function") {
    return null;
  }
  try {
    const soundEl = new Audio(sourceUrl);
    soundEl.preload = "auto";
    soundEl.volume = volume;
    uiSoundCache.set(soundKey, soundEl);
    return soundEl;
  } catch (_error) {
    return null;
  }
}

function playUiSound(soundEl) {
  if (!(soundEl instanceof HTMLAudioElement)) {
    return;
  }
  try {
    soundEl.currentTime = 0;
    const playPromise = soundEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch (_error) {
    // Ignore transient playback errors on restricted devices.
  }
}

function playNavDownSound() {
  playUiSound(getUiSound("nav-down", NAV_DOWN_SOUND_URL, NAV_DOWN_SOUND_VOLUME));
}

function playChoiceSound(choice) {
  if (choice === "yes") {
    playUiSound(getUiSound("choice-yes", CHOICE_YES_SOUND_URL, CHOICE_SOUND_VOLUME));
    return;
  }
  playUiSound(getUiSound("choice-no", CHOICE_NO_SOUND_URL, CHOICE_SOUND_VOLUME));
}

function playPopupCloseSound() {
  playUiSound(getUiSound("popup-close", POPUP_CLOSE_SOUND_URL, POPUP_CLOSE_SOUND_VOLUME));
}

function playHelmetActionSound() {
  playUiSound(getUiSound("helmet-action", HELMET_ACTION_SOUND_URL, HELMET_ACTION_SOUND_VOLUME));
}

function playAiPanelSound() {
  const soundEl = getUiSound("ai-panel", AI_PANEL_SOUND_URL, AI_PANEL_SOUND_VOLUME);
  playUiSound(soundEl);
  if (!(soundEl instanceof HTMLAudioElement)) {
    return;
  }
  if (aiPanelSoundStopTimerId !== null) {
    window.clearTimeout(aiPanelSoundStopTimerId);
  }
  aiPanelSoundStopTimerId = window.setTimeout(() => {
    try {
      soundEl.pause();
      soundEl.currentTime = 0;
    } catch (_error) {
      // Ignore transient playback errors.
    } finally {
      aiPanelSoundStopTimerId = null;
    }
  }, AI_PANEL_SOUND_MAX_DURATION_MS);
}

function playGalleryHeartSound() {
  playUiSound(getUiSound("gallery-heart", GALLERY_HEART_SOUND_URL, GALLERY_HEART_SOUND_VOLUME));
}

function playQuestionTypewriterSound(char) {
  if (typeof char !== "string" || !char.trim()) {
    return;
  }
  playUiSound(getUiSound("question-typewriter", QUESTION_TYPEWRITER_SOUND_URL, QUESTION_TYPEWRITER_SOUND_VOLUME));
}

function stopQuestionTypewriterSound() {
  const soundEl = uiSoundCache.get("question-typewriter");
  if (!(soundEl instanceof HTMLAudioElement)) {
    return;
  }
  try {
    soundEl.pause();
    soundEl.currentTime = 0;
  } catch (_error) {
    // Ignore transient playback errors.
  }
}

function normalizeHeroUiTone(value) {
  return value === "white" ? "white" : "black";
}

function applyHeroUiTone(nextTone) {
  const normalizedTone = normalizeHeroUiTone(nextTone);
  document.documentElement.dataset.heroUiTone = normalizedTone;
  return normalizedTone;
}

function registerStartupTask(taskPromise) {
  if (!(taskPromise instanceof Promise)) {
    return taskPromise;
  }
  startupTasks.add(taskPromise);
  taskPromise.finally(() => {
    startupTasks.delete(taskPromise);
  });
  return taskPromise;
}

function waitForImageLoad(imageEl) {
  return new Promise((resolve) => {
    if (!(imageEl instanceof HTMLImageElement) || imageEl.complete) {
      resolve();
      return;
    }
    const onDone = () => {
      imageEl.removeEventListener("load", onDone);
      imageEl.removeEventListener("error", onDone);
      resolve();
    };
    imageEl.addEventListener("load", onDone, { once: true });
    imageEl.addEventListener("error", onDone, { once: true });
  });
}

function preloadImageUrl(sourceUrl) {
  const normalizedUrl = String(sourceUrl || "").trim();
  if (!normalizedUrl) {
    return Promise.resolve();
  }
  if (preloadedImagePromises.has(normalizedUrl)) {
    return preloadedImagePromises.get(normalizedUrl);
  }
  const preloadPromise = new Promise((resolve) => {
    const preloadImage = new Image();
    const onError = () => {
      preloadImage.removeEventListener("load", onLoad);
      preloadImage.removeEventListener("error", onError);
      resolve();
    };
    const onLoad = async () => {
      preloadImage.removeEventListener("load", onLoad);
      preloadImage.removeEventListener("error", onError);
      // Wait decode too, so the image is immediately paint-ready later.
      if (typeof preloadImage.decode === "function") {
        try {
          await preloadImage.decode();
        } catch (_error) {
          // Ignore decode failures and continue.
        }
      }
      resolve();
    };
    preloadImage.addEventListener("load", onLoad, { once: true });
    preloadImage.addEventListener("error", onError, { once: true });
    preloadImage.src = normalizedUrl;
  });
  preloadedImagePromises.set(normalizedUrl, preloadPromise);
  return preloadPromise;
}

function warmImageUrlsDuringLoader(imageUrls) {
  return new Promise((resolve) => {
    if (!(document.body instanceof HTMLElement)) {
      resolve();
      return;
    }
    const normalizedUrls = Array.from(new Set(
      (Array.isArray(imageUrls) ? imageUrls : [])
        .map((url) => String(url || "").trim())
        .filter(Boolean)
    ));
    if (normalizedUrls.length === 0) {
      resolve();
      return;
    }
    const warmupImages = normalizedUrls.map((url) => {
      const warmupImage = new Image();
      warmupImage.decoding = "sync";
      warmupImage.loading = "eager";
      warmupImage.alt = "";
      warmupImage.width = 44;
      warmupImage.height = 44;
      warmupImage.style.position = "fixed";
      warmupImage.style.left = "-9999px";
      warmupImage.style.top = "-9999px";
      warmupImage.style.width = "44px";
      warmupImage.style.height = "44px";
      warmupImage.style.opacity = "0";
      warmupImage.style.pointerEvents = "none";
      return warmupImage;
    });
    Promise.all(warmupImages.map((warmupImage, index) => new Promise((resolveImage) => {
      const onDone = async () => {
        warmupImage.removeEventListener("load", onDone);
        warmupImage.removeEventListener("error", onDone);
        if (typeof warmupImage.decode === "function") {
          try {
            await warmupImage.decode();
          } catch (_error) {
            // Ignore decode failures and continue.
          }
        }
        resolveImage();
      };
      warmupImage.addEventListener("load", onDone, { once: true });
      warmupImage.addEventListener("error", onDone, { once: true });
      warmupImage.src = normalizedUrls[index];
    }))).then(() => {
      warmupImages.forEach((warmupImage) => {
        document.body.appendChild(warmupImage);
        // Force first layout/paint while loader is still visible.
        void warmupImage.getBoundingClientRect();
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          warmupImages.forEach((warmupImage) => {
            if (warmupImage.isConnected) {
              warmupImage.remove();
            }
          });
          resolve();
        });
      });
    });
  });
}

function preloadAudioUrl(sourceUrl) {
  const normalizedUrl = String(sourceUrl || "").trim();
  if (!normalizedUrl) {
    return Promise.resolve();
  }
  if (preloadedAudioPromises.has(normalizedUrl)) {
    return preloadedAudioPromises.get(normalizedUrl);
  }
  const preloadPromise = new Promise((resolve) => {
    if (typeof Audio !== "function") {
      resolve();
      return;
    }
    const preloadAudio = new Audio();
    let isSettled = false;
    const settle = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      preloadAudio.removeEventListener("canplaythrough", onReady);
      preloadAudio.removeEventListener("loadeddata", onReady);
      preloadAudio.removeEventListener("error", onDone);
      resolve();
    };
    const onDone = () => {
      settle();
    };
    const onReady = () => {
      settle();
    };
    preloadAudio.preload = "auto";
    preloadAudio.addEventListener("canplaythrough", onReady, { once: true });
    preloadAudio.addEventListener("loadeddata", onReady, { once: true });
    preloadAudio.addEventListener("error", onDone, { once: true });
    preloadAudio.src = normalizedUrl;
    preloadAudio.load();
  });
  preloadedAudioPromises.set(normalizedUrl, preloadPromise);
  return preloadPromise;
}

function hideAppLoader() {
  if (!(appLoaderEl instanceof HTMLElement) || isAppLoaderHidden) {
    return;
  }
  isAppLoaderHidden = true;
  appLoaderEl.classList.add("is-hidden");
  document.body.classList.remove("is-app-loading");
  window.setTimeout(() => {
    if (appLoaderEl.isConnected) {
      appLoaderEl.remove();
    }
  }, 260);
}

async function bootLoader() {
  // Let the rest of this script fully initialize UI/tasks first.
  await Promise.resolve();

  if (document.readyState !== "complete") {
    await new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  }

  if (document.fonts && typeof document.fonts.ready === "object") {
    try {
      await document.fonts.ready;
    } catch (_error) {
      // Ignore font readiness failures and continue.
    }
  }

  const images = Array.from(document.querySelectorAll("img"));
  await Promise.all(images.map((imageEl) => waitForImageLoad(imageEl)));
  while (startupTasks.size > 0) {
    const pendingTasks = Array.from(startupTasks);
    await Promise.allSettled(pendingTasks);
  }
  window.requestAnimationFrame(() => {
    hideAppLoader();
  });
}

registerStartupTask(Promise.all(STATIC_IMAGE_PRELOAD_URLS.map((sourceUrl) => preloadImageUrl(sourceUrl))));
registerStartupTask(Promise.all(CRITICAL_ICON_PRELOAD_URLS.map((sourceUrl) => preloadImageUrl(sourceUrl))));
registerStartupTask(Promise.all(STATIC_SOUND_PRELOAD_URLS.map((sourceUrl) => preloadAudioUrl(sourceUrl))));
registerStartupTask((async () => {
  await Promise.all(CRITICAL_ICON_PRELOAD_URLS.map((sourceUrl) => preloadImageUrl(sourceUrl)));
  await warmImageUrlsDuringLoader(CRITICAL_ICON_PRELOAD_URLS);
})());

applyHeroUiTone("black");

void bootLoader();

if (window.location.hash === "#/admin") {
  document.body.classList.add("admin-mode");

  const adminRoot = document.querySelector("#app");
  if (!adminRoot) {
    throw new Error("Missing #app container.");
  }

  const ADMIN_API_BASE = "https://foxly.it/intesta_api/admin";
  const ADMIN_AUTH_TOKEN_STORAGE_KEY = "intesta_admin_token_v1";
  const adminState = {
    authenticated: false,
    loading: true,
    pendingCount: 0,
    groups: [],
    selectedDeviceId: null,
    requestPending: false,
    error: "",
    authToken: ""
  };

  function escapeHtml(value) {
    const text = value == null ? "" : String(value);
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getAdminApiBase() {
    const config = window.INTESA_ADMIN || {};
    const customBase = config.baseUrl ? String(config.baseUrl).trim() : "";
    return customBase || ADMIN_API_BASE;
  }

  function getStoredAdminAuthToken() {
    try {
      return String(window.localStorage.getItem(ADMIN_AUTH_TOKEN_STORAGE_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function storeAdminAuthToken(nextToken) {
    const token = String(nextToken || "").trim();
    try {
      if (token) {
        window.localStorage.setItem(ADMIN_AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(ADMIN_AUTH_TOKEN_STORAGE_KEY);
      }
    } catch (_error) {
      // Ignore storage failures.
    }
    return token;
  }

  function adminResponseMessage(payload, fallbackMessage) {
    if (payload && typeof payload.msg === "string") {
      const msg = payload.msg.trim();
      if (msg) {
        return msg;
      }
    }
    return fallbackMessage;
  }

  function showAdminToast(message, type = "info") {
    const text = String(message || "").trim();
    if (!text) {
      return;
    }
    let viewportEl = document.querySelector("#admin-toast-viewport");
    if (!(viewportEl instanceof HTMLElement)) {
      viewportEl = document.createElement("div");
      viewportEl.id = "admin-toast-viewport";
      viewportEl.className = "admin-toast-viewport";
      document.body.append(viewportEl);
    }
    const toastEl = document.createElement("p");
    toastEl.className = `admin-toast admin-toast--${type}`;
    toastEl.textContent = text;
    viewportEl.append(toastEl);
    window.requestAnimationFrame(() => {
      toastEl.classList.add("is-visible");
    });
    const closeToast = () => {
      toastEl.classList.remove("is-visible");
      window.setTimeout(() => {
        if (toastEl.isConnected) {
          toastEl.remove();
        }
      }, 220);
    };
    window.setTimeout(closeToast, 2600);
  }

  async function adminRequest(path, options = {}) {
    const hasFormData = options.formData instanceof FormData;
    const requestOptions = {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json"
      },
      ...(hasFormData ? { body: options.formData } : {}),
      ...(!hasFormData && options.body ? { body: JSON.stringify(options.body) } : {})
    };
    if (!hasFormData && options.body) {
      requestOptions.headers["Content-Type"] = "application/json";
    }

    const base = getAdminApiBase();
    let requestPath = String(path || "");
    if (adminState.authToken) {
      requestPath += `${requestPath.includes("?") ? "&" : "?"}adminToken=${encodeURIComponent(adminState.authToken)}`;
    }
    const response = await fetch(`${base}${requestPath}`, requestOptions);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
    return { response, payload };
  }

  async function refreshPendingCount() {
    const { response, payload } = await adminRequest("/pending-count");
    if (response.ok && payload?.result === 1) {
      adminState.pendingCount = Number(payload.pendingDeviceCount || 0);
      return true;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
      adminState.authToken = storeAdminAuthToken("");
    }
    return false;
  }

  async function refreshGroups() {
    const { response, payload } = await adminRequest("/device-groups");
    if (response.ok && payload?.result === 1) {
      adminState.groups = Array.isArray(payload.items) ? payload.items : [];
      if (adminState.selectedDeviceId !== null) {
        const exists = adminState.groups.some((group) => Number(group.deviceId) === Number(adminState.selectedDeviceId));
        if (!exists) {
          adminState.selectedDeviceId = null;
        }
      }
      return true;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
      adminState.authToken = storeAdminAuthToken("");
    }
    return false;
  }

  async function loadAdminData() {
    const [pendingOk, groupsOk] = await Promise.all([refreshPendingCount(), refreshGroups()]);
    return Boolean(pendingOk && groupsOk);
  }

  function statusLabel(status) {
    if (status === "approved") {
      return "approvato";
    }
    if (status === "rejected") {
      return "non approvato";
    }
    return "in attesa";
  }

  function groupsMarkup() {
    if (adminState.groups.length === 0) {
      return `<p class="admin-empty">Nessun invio presente.</p>`;
    }
    return adminState.groups.map((group, index) => {
      const status = String(group.status || "pending");
      const statusClass = `admin-status admin-status--${escapeHtml(status)}`;
      const hasText = Boolean(group.text);
      const hasImage = Boolean(group.image);
      return `
        <button class="admin-list-card admin-list-card--button" type="button" data-admin-open-device="${Number(group.deviceId)}">
          <div class="admin-list-head">
            <p class="admin-list-device">Invio ${index + 1}</p>
            <span class="${statusClass}">${escapeHtml(statusLabel(status))}</span>
          </div>
          <p class="admin-list-meta">
            ${hasText ? "Descrizione presente" : "Descrizione assente"} •
            ${hasImage ? "Foto presente" : "Foto assente"} •
            ${escapeHtml(formatDateTime(group.createdAt))}
          </p>
        </button>
      `;
    }).join("");
  }

  function selectedGroup() {
    if (adminState.selectedDeviceId === null) {
      return null;
    }
    return adminState.groups.find((group) => Number(group.deviceId) === Number(adminState.selectedDeviceId)) || null;
  }

  function popupMarkup() {
    const group = selectedGroup();
    if (!group) {
      return "";
    }
    const textHtml = group.text
      ? `<article class="admin-item-block">
          <p class="admin-item-type">Descrizione</p>
          <p class="admin-item-text">${escapeHtml(group.text.description || "")}</p>
        </article>`
      : `<article class="admin-item-block"><p class="admin-item-text">Nessuna descrizione inviata.</p></article>`;
    const imageHtml = group.image
      ? `<article class="admin-item-block">
          <p class="admin-item-type">Foto</p>
          <img class="admin-item-image" src="${escapeHtml(group.image.imageUrl || "")}" alt="Foto inviata" loading="lazy" />
          <div class="admin-image-actions">
            <a class="admin-btn admin-btn--ghost" href="${escapeHtml(group.image.imageUrl || "")}" download>Scarica foto</a>
          </div>
        </article>`
      : `<article class="admin-item-block"><p class="admin-item-text">Nessuna foto inviata.</p></article>`;

    const imageTone = group.image ? normalizeHeroUiTone(group.image.logoTone || "black") : "black";
    const imageToneControls = group.image
      ? `
          <div class="admin-modal-settings" role="group" aria-label="Aspetto logo e chevron sulla home">
            <p class="admin-hero-ui-title">Colore logo sulla foto selezionata</p>
            <div class="admin-hero-ui">
              <label class="admin-hero-ui-option">
                <input type="radio" name="admin-image-logo-tone" value="white" ${imageTone === "white" ? "checked" : ""} />
                <span>Logo bianco</span>
              </label>
              <label class="admin-hero-ui-option">
                <input type="radio" name="admin-image-logo-tone" value="black" ${imageTone === "black" ? "checked" : ""} />
                <span>Logo nero</span>
              </label>
            </div>
          </div>
        `
      : "";

    return `
      <section class="admin-modal" id="admin-modal" aria-modal="true" role="dialog" aria-label="Dettaglio invio">
        <div class="admin-modal-backdrop" data-admin-close-modal></div>
        <article class="admin-modal-card">
          <button class="admin-modal-close" type="button" data-admin-close-modal aria-label="Chiudi dettaglio">×</button>
          <h2 class="admin-modal-title">Dettaglio invio</h2>
          <p class="admin-list-meta">Stato attuale: <span class="admin-status admin-status--${escapeHtml(group.status || "pending")}">${escapeHtml(statusLabel(String(group.status || "pending")))}</span></p>
          ${imageToneControls}
          ${textHtml}
          ${imageHtml}
          <form class="admin-image-upload-form" id="admin-image-upload-form">
            <label class="admin-label" for="admin-image-file">Sostituisci foto</label>
            <input id="admin-image-file" class="admin-input" type="file" accept=".jpg,.jpeg,.png,.gif,.webp" />
            <button class="admin-btn admin-btn--ghost admin-upload-submit" id="admin-image-upload-submit" type="submit" disabled>Seleziona un file</button>
          </form>
          <div class="admin-decision-actions">
            <button class="admin-btn admin-btn--success" type="button" data-admin-set-status="approved">Approva</button>
            <button class="admin-btn admin-btn--danger" type="button" data-admin-set-status="rejected">Non approvato</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderAdmin() {
    if (adminState.loading) {
      adminRoot.innerHTML = `<section class="admin-shell"><p class="admin-loading">Caricamento area admin...</p></section>`;
      return;
    }

    if (!adminState.authenticated) {
      adminRoot.innerHTML = `
        <section class="admin-shell">
          <article class="admin-login-card">
            <h1 class="admin-title">Area Admin</h1>
            <p class="admin-subtitle">Accesso protetto da password.</p>
            <form id="admin-login-form" class="admin-login-form">
              <label class="admin-label" for="admin-password">Password</label>
              <input id="admin-password" class="admin-input" type="password" name="password" autocomplete="current-password" required />
              <button class="admin-btn admin-btn--primary" type="submit">Accedi</button>
            </form>
            ${adminState.error ? `<p class="admin-error">${escapeHtml(adminState.error)}</p>` : ""}
          </article>
        </section>
      `;
      const loginForm = document.querySelector("#admin-login-form");
      if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (adminState.requestPending) {
            return;
          }
          const passwordInput = loginForm.querySelector("#admin-password");
          const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
          adminState.requestPending = true;
          adminState.error = "";
          try {
            const { response, payload } = await adminRequest("/login", {
              method: "POST",
              body: { password }
            });
            if (!response.ok || payload?.result !== 1) {
              adminState.error = payload?.msg || "Accesso non riuscito.";
              showAdminToast(adminState.error, "error");
              renderAdmin();
              return;
            }
            adminState.authToken = storeAdminAuthToken(payload?.authToken || "");
            adminState.authenticated = true;
            adminState.loading = true;
            renderAdmin();
            const dataLoaded = await loadAdminData();
            adminState.loading = false;
            showAdminToast(
              dataLoaded ? "Accesso admin effettuato." : "Accesso riuscito, ma aggiornamento dati non completo.",
              dataLoaded ? "success" : "error"
            );
            renderAdmin();
          } catch (_error) {
            adminState.error = "Errore di rete.";
            showAdminToast(adminState.error, "error");
            renderAdmin();
          } finally {
            adminState.requestPending = false;
          }
        });
      }
      return;
    }

    adminRoot.innerHTML = `
      <section class="admin-shell">
        <header class="admin-header">
          <div class="admin-actions admin-actions--icon">
            <button class="admin-icon-btn" id="admin-refresh-list" type="button" aria-label="Aggiorna elenco" title="Aggiorna elenco">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
                <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
              </svg>
            </button>
            <button class="admin-icon-btn" id="admin-logout" type="button" aria-label="Logout" title="Logout">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
          <div class="admin-header-center">
            <h1 class="admin-title">Moderazione invii</h1>
            <p class="admin-pending">
              Da approvare
              <span class="admin-count-dot">${adminState.pendingCount}</span>
            </p>
            <button class="admin-btn admin-btn--danger" type="button" data-admin-delete-unapproved>Elimina invii non approvati</button>
          </div>
        </header>
        <main class="admin-main">
          <section class="admin-list-view">
            <div class="admin-list-wrap">${groupsMarkup()}</div>
          </section>
        </main>
        ${popupMarkup()}
      </section>
    `;

    const logoutButton = document.querySelector("#admin-logout");
    const refreshListButton = document.querySelector("#admin-refresh-list");
    const openButtons = Array.from(document.querySelectorAll("[data-admin-open-device]"));
    const closeModalButtons = Array.from(document.querySelectorAll("[data-admin-close-modal]"));
    const statusButtons = Array.from(document.querySelectorAll("[data-admin-set-status]"));
    const deleteUnapprovedButtons = Array.from(document.querySelectorAll("[data-admin-delete-unapproved]"));
    const imageUploadForm = document.querySelector("#admin-image-upload-form");
    const imageUploadSubmit = document.querySelector("#admin-image-upload-submit");
    const imageUploadInput = document.querySelector("#admin-image-file");
    const imageLogoToneInputs = Array.from(document.querySelectorAll("input[name=\"admin-image-logo-tone\"]"));

    openButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      button.addEventListener("click", () => {
        const id = Number(button.dataset.adminOpenDevice || "0");
        if (id > 0) {
          adminState.selectedDeviceId = id;
          renderAdmin();
        }
      });
    });

    closeModalButtons.forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.addEventListener("click", () => {
        adminState.selectedDeviceId = null;
        renderAdmin();
      });
    });

    if (logoutButton instanceof HTMLButtonElement) {
      logoutButton.addEventListener("click", async () => {
        try {
          const { response, payload } = await adminRequest("/logout", { method: "POST" });
          if (!response.ok || payload?.result !== 1) {
            showAdminToast(adminResponseMessage(payload, "Logout non riuscito."), "error");
          } else {
            showAdminToast(adminResponseMessage(payload, "Logout effettuato."), "success");
          }
        } catch (_error) {
          showAdminToast("Errore di rete durante logout.", "error");
        }
        adminState.authenticated = false;
        adminState.authToken = storeAdminAuthToken("");
        adminState.groups = [];
        adminState.selectedDeviceId = null;
        adminState.error = "";
        renderAdmin();
      });
    }
    if (refreshListButton instanceof HTMLButtonElement) {
      refreshListButton.addEventListener("click", async () => {
        adminState.loading = true;
        renderAdmin();
        let loadedOk = false;
        try {
          loadedOk = await loadAdminData();
          showAdminToast(loadedOk ? "Elenco aggiornato." : "Aggiornamento incompleto.", loadedOk ? "success" : "error");
        } catch (_error) {
          showAdminToast("Errore durante l'aggiornamento elenco.", "error");
        }
        adminState.loading = false;
        renderAdmin();
      });
    }
    imageLogoToneInputs.forEach((inputEl) => {
      if (!(inputEl instanceof HTMLInputElement)) {
        return;
      }
      inputEl.addEventListener("change", () => {
        const group = selectedGroup();
        const contributionId = group && group.image && Number(group.image.id) > 0 ? Number(group.image.id) : 0;
        if (!inputEl.checked || contributionId <= 0 || adminState.requestPending) {
          return;
        }
        adminState.requestPending = true;
        void (async () => {
          try {
            const { response, payload } = await adminRequest("/image-logo-tone", {
              method: "POST",
              body: {
                contributionId,
                logoTone: normalizeHeroUiTone(inputEl.value)
              }
            });
            if (!response.ok || payload?.result !== 1) {
              showAdminToast(adminResponseMessage(payload, "Impossibile aggiornare il colore logo."), "error");
              return;
            }
            const loadedOk = await loadAdminData();
            showAdminToast(
              loadedOk
                ? adminResponseMessage(payload, "Colore logo aggiornato.")
                : "Colore aggiornato, ma refresh non completo.",
              loadedOk ? "success" : "error"
            );
          } catch (_error) {
            showAdminToast("Errore di rete durante salvataggio colore.", "error");
          } finally {
            adminState.requestPending = false;
            renderAdmin();
          }
        })();
      });
    });

    statusButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      button.addEventListener("click", async () => {
        if (adminState.selectedDeviceId === null || adminState.requestPending) {
          return;
        }
        const nextStatus = String(button.dataset.adminSetStatus || "");
        if (!nextStatus) {
          return;
        }
        adminState.requestPending = true;
        try {
          const { response, payload } = await adminRequest("/device-status", {
            method: "POST",
            body: {
              deviceId: adminState.selectedDeviceId,
              status: nextStatus
            }
          });
          if (!response.ok || payload?.result !== 1) {
            showAdminToast(adminResponseMessage(payload, "Aggiornamento stato non riuscito."), "error");
            return;
          }
          const loadedOk = await loadAdminData();
          showAdminToast(
            loadedOk ? adminResponseMessage(payload, "Stato aggiornato.") : "Stato aggiornato, ma refresh non completo.",
            loadedOk ? "success" : "error"
          );
        } catch (_error) {
          showAdminToast("Errore di rete durante aggiornamento stato.", "error");
        } finally {
          adminState.requestPending = false;
          renderAdmin();
        }
      });
    });
    deleteUnapprovedButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      button.addEventListener("click", async () => {
        if (adminState.requestPending) {
          return;
        }
        const shouldDelete = window.confirm("Eliminare tutti gli invii non approvati?");
        if (!shouldDelete) {
          return;
        }
        adminState.requestPending = true;
        try {
          const { response, payload } = await adminRequest("/device-delete-unapproved", {
            method: "POST"
          });
          if (!response.ok || payload?.result !== 1) {
            showAdminToast(adminResponseMessage(payload, "Eliminazione non riuscita."), "error");
            return;
          }
          const loadedOk = await loadAdminData();
          if (adminState.selectedDeviceId !== null) {
            const stillExists = adminState.groups.some((group) => Number(group.deviceId) === Number(adminState.selectedDeviceId));
            if (!stillExists) {
              adminState.selectedDeviceId = null;
            }
          }
          showAdminToast(
            loadedOk ? adminResponseMessage(payload, "Invii non approvati eliminati.") : "Eliminazione ok, ma refresh non completo.",
            loadedOk ? "success" : "error"
          );
        } catch (_error) {
          showAdminToast("Errore di rete durante eliminazione.", "error");
        } finally {
          adminState.requestPending = false;
          renderAdmin();
        }
      });
    });

    if (imageUploadForm instanceof HTMLFormElement) {
      const syncUploadButtonState = () => {
        if (!(imageUploadSubmit instanceof HTMLButtonElement) || !(imageUploadInput instanceof HTMLInputElement)) {
          return;
        }
        const hasFile = Boolean(imageUploadInput.files && imageUploadInput.files[0]);
        imageUploadSubmit.disabled = !hasFile || adminState.requestPending;
        imageUploadSubmit.classList.toggle("is-ready", hasFile && !adminState.requestPending);
        imageUploadSubmit.textContent = adminState.requestPending
          ? "Caricamento..."
          : hasFile
            ? "Carica nuova foto"
            : "Seleziona un file";
      };

      if (imageUploadInput instanceof HTMLInputElement) {
        imageUploadInput.addEventListener("change", syncUploadButtonState);
      }
      syncUploadButtonState();

      imageUploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (adminState.selectedDeviceId === null || adminState.requestPending) {
          return;
        }
        const fileInput = imageUploadForm.querySelector("#admin-image-file");
        const imageFile = fileInput instanceof HTMLInputElement && fileInput.files ? fileInput.files[0] : null;
        if (!imageFile) {
          return;
        }
        const formData = new FormData();
        formData.append("deviceId", String(adminState.selectedDeviceId));
        formData.append("image", imageFile, imageFile.name);
        adminState.requestPending = true;
        syncUploadButtonState();
        try {
          const { response, payload } = await adminRequest("/device-image", {
            method: "POST",
            formData
          });
          if (!response.ok || payload?.result !== 1) {
            showAdminToast(adminResponseMessage(payload, "Upload foto non riuscito."), "error");
            return;
          }
          const loadedOk = await loadAdminData();
          showAdminToast(
            loadedOk ? adminResponseMessage(payload, "Foto aggiornata.") : "Upload completato, ma refresh non completo.",
            loadedOk ? "success" : "error"
          );
        } catch (_error) {
          showAdminToast("Errore di rete durante upload foto.", "error");
        } finally {
          adminState.requestPending = false;
          syncUploadButtonState();
          renderAdmin();
        }
      });
    }
  }

  void (async () => {
    adminState.authToken = getStoredAdminAuthToken();
    try {
      const { response, payload } = await adminRequest("/session");
      adminState.authenticated = Boolean(response.ok && payload?.result === 1 && payload?.authenticated === 1);
      if (response.ok && payload?.result === 1 && payload?.authToken) {
        adminState.authToken = storeAdminAuthToken(payload.authToken);
      }
      if (adminState.authenticated) {
        await loadAdminData();
      }
    } catch (_error) {
      adminState.authenticated = false;
    } finally {
      adminState.loading = false;
      renderAdmin();
    }
  })();
} else {

const slides = [
  { title: "", subtitle: "", control: "hero" },
  { title: "Sei uno studente?", subtitle: "", control: "choice" },
  { title: "Hai una bici?", subtitle: "", control: "choice" },
  { title: "Utilizzi un casco?", subtitle: "", control: "choice" },
  { title: "", subtitle: "", control: "targets" }
];
const TARGETS_SLIDE_INDEX = 4;
const POPUP_ANIMATION_MS = 320;
const CHOICE_ANIMATION_MS = 340;
const CHOICE_SWEEP_BLUR_PX = 1.8;
const QUESTION_TYPEWRITER_DELAY_MS = 34;
const QUESTION_TYPEWRITER_PUNCT_DELAY_MS = 120;
const TARGETS_DIVIDER_SCROLL_SPEED_PX_PER_SEC = 28;
const TARGETS_TEXT_TYPEWRITER_DELAY_MS = 24;
const TARGETS_TEXT_TYPEWRITER_PUNCT_DELAY_MS = 90;
const HERO_CAROUSEL_INTERVAL_MS = 2500;
const LAST_SLIDE_REACHED_STORAGE_KEY = "intesta_last_slide_reached_v1";

function hasReachedLastSlideInStorage() {
  try {
    return window.localStorage.getItem(LAST_SLIDE_REACHED_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function storeReachedLastSlide() {
  try {
    window.localStorage.setItem(LAST_SLIDE_REACHED_STORAGE_KEY, "1");
  } catch (_error) {
    // Ignore storage failures.
  }
}

function getLandingDestinationIndex() {
  return hasReachedLastSlideInStorage() ? TARGETS_SLIDE_INDEX : 1;
}

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Missing #app container.");
}

app.innerHTML = `
  <section class="slider" aria-label="Landing slider">
    <div class="slides"></div>
    <footer class="bottom">
      <p class="slide-subtitle" id="slide-subtitle"></p>
      <div class="controls" id="slide-controls"></div>
    </footer>
    <p class="sr-only" aria-live="polite" id="slide-announcer"></p>
  </section>
  <section class="profile-popup" id="profile-popup" hidden aria-modal="true" role="dialog" aria-label="Profilo di Tomas Berardi">
    <button class="profile-popup-close" id="profile-popup-close" type="button" aria-label="Chiudi popup profilo">
      <img class="profile-popup-close-icon" src="./assets/images/x-square.svg" alt="" aria-hidden="true" />
    </button>
    <div class="profile-popup-body">
      <article class="profile-card" aria-label="Profilo di Tomas Berardi">
        <div class="profile-photo-frame" aria-hidden="true">
          <span class="photo-corner photo-corner--tl"></span>
          <span class="photo-corner photo-corner--tr"></span>
          <span class="photo-corner photo-corner--bl"></span>
          <span class="photo-corner photo-corner--br"></span>
          <img class="profile-photo" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
        </div>
        <p class="profile-bio">
            <b><a href="https://www.instagram.com/tomas._.berardi" target="_blank" rel="noopener noreferrer">@tomas._.berardi</a><br><br>21 y.o. Faenza<br><br>Studente ISIA</b>: università di Design del prodotto e della comunicazione.<br><br>Ho bisogno del tuo aiuto per il mio progetto di tesi.<br>Ho realizzato questo sito e attività per te!
        </p>
        <p class="profile-contact">
          Per maggiori informazioni conttatami.<br>
          <a href="tel:+393313809922">+39 3313809922</a><br />
          <a href="mailto:intesta2026@gmail.com">intesta2026@gmail.com</a>
        </p>
      </article>
    </div>
  </section>
  <section class="gallery-preview" id="gallery-preview" hidden aria-modal="true" role="dialog" aria-label="Anteprima immagine galleria">
    <div class="gallery-preview-backdrop" id="gallery-preview-backdrop"></div>
    <div class="gallery-preview-shell">
      <div class="gallery-preview-media">
        <button class="gallery-preview-close" id="gallery-preview-close" type="button" aria-label="Chiudi anteprima immagine">
          <i class="feather-x-square gallery-preview-close-icon" aria-hidden="true"></i>
        </button>
        <img class="gallery-preview-image" id="gallery-preview-image" src="" alt="Anteprima lavoro approvato" />
        <div class="gallery-like-row">
          <button class="gallery-like-btn" id="gallery-like-btn" type="button" aria-label="Metti mi piace alla foto">
            <img class="gallery-like-icon" src="./assets/images/empty-like.svg" alt="" aria-hidden="true" />
          </button>
          <span class="gallery-like-count" id="gallery-like-count">0 Like</span>
        </div>
      </div>
      <p class="gallery-preview-caption" id="gallery-preview-caption" hidden></p>
    </div>
  </section>
  <section class="ai-chat" id="ai-chat" aria-label="Chat assistente AI">
    <button class="ai-chat-launcher" id="ai-chat-launcher" type="button" aria-label="Apri chat assistente">
      <img class="ai-chat-launcher-image" src="./assets/images/AI.png" alt="" aria-hidden="true" />
    </button>
    <div class="ai-chat-panel" id="ai-chat-panel" aria-hidden="true">
      <header class="ai-chat-header">
        <p>AI Assistant</p>
        <button class="ai-chat-close" id="ai-chat-close" type="button" aria-label="Chiudi chat">×</button>
      </header>
      <div class="ai-chat-messages" id="ai-chat-messages"></div>
      <form class="ai-chat-form" id="ai-chat-form">
        <input
          class="ai-chat-input"
          id="ai-chat-input"
          type="text"
          name="message"
          placeholder="Es: idea casco, invio foto, privacy, contatti..."
          autocomplete="off"
          required
        />
        <button class="ai-chat-send" id="ai-chat-send" type="submit">Invia</button>
      </form>
    </div>
  </section>
`;

const slidesContainer = app.querySelector(".slides");
const subtitleEl = app.querySelector("#slide-subtitle");
const announcerEl = app.querySelector("#slide-announcer");
const controlsEl = app.querySelector("#slide-controls");
const popupEl = app.querySelector("#profile-popup");
const popupBodyEl = app.querySelector(".profile-popup-body");
const popupCloseEl = app.querySelector("#profile-popup-close");
const popupCardEl = app.querySelector(".profile-card");
const defaultPopupCloseMarkup = popupCloseEl instanceof HTMLElement ? popupCloseEl.innerHTML : "";
const galleryPreviewEl = app.querySelector("#gallery-preview");
const galleryPreviewBackdropEl = app.querySelector("#gallery-preview-backdrop");
const galleryPreviewCloseEl = app.querySelector("#gallery-preview-close");
const galleryPreviewImageEl = app.querySelector("#gallery-preview-image");
const galleryPreviewCaptionEl = app.querySelector("#gallery-preview-caption");
const galleryLikeBtnEl = app.querySelector("#gallery-like-btn");
const galleryLikeIconEl = app.querySelector(".gallery-like-icon");
const galleryLikeCountEl = app.querySelector("#gallery-like-count");
const chatRootEl = app.querySelector("#ai-chat");
const chatLauncherEl = app.querySelector("#ai-chat-launcher");
const chatPanelEl = app.querySelector("#ai-chat-panel");
const chatCloseEl = app.querySelector("#ai-chat-close");
const chatMessagesEl = app.querySelector("#ai-chat-messages");
const chatFormEl = app.querySelector("#ai-chat-form");
const chatInputEl = app.querySelector("#ai-chat-input");
const chatSendEl = app.querySelector("#ai-chat-send");
const legalDockEl = document.querySelector(".legal-dock");
const legalLinkEls = legalDockEl ? Array.from(legalDockEl.querySelectorAll(".legal-icon")) : [];

if (
  !slidesContainer ||
  !subtitleEl ||
  !announcerEl ||
  !controlsEl ||
  !popupEl ||
  !popupBodyEl ||
  !popupCloseEl ||
  !popupCardEl ||
  !galleryPreviewEl ||
  !galleryPreviewBackdropEl ||
  !galleryPreviewCloseEl ||
  !galleryPreviewImageEl ||
  !galleryPreviewCaptionEl ||
  !galleryLikeBtnEl ||
  !galleryLikeCountEl ||
  !chatRootEl ||
  !chatLauncherEl ||
  !chatPanelEl ||
  !chatCloseEl ||
  !chatMessagesEl ||
  !chatFormEl ||
  !chatInputEl ||
  !chatSendEl
) {
  throw new Error("Slider markup not initialized.");
}

legalLinkEls.forEach((linkEl) => {
  if (!linkEl.dataset.shortLabel) {
    linkEl.dataset.shortLabel = linkEl.textContent?.trim() || "";
  }
  if (!linkEl.dataset.longLabel) {
    linkEl.dataset.longLabel = linkEl.getAttribute("title") || linkEl.dataset.shortLabel;
  }
  linkEl.addEventListener("click", (event) => {
    const pageKey = linkEl.dataset.shortLabel || "";
    if (!legalPopupPages[pageKey]) {
      return;
    }
    event.preventDefault();
    openLegalPopup(pageKey);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") {
    return;
  }
  if (galleryPreviewEl instanceof HTMLElement && !galleryPreviewEl.hidden) {
    e.preventDefault();
    closeGalleryPreview();
    return;
  }
  const openPopup = document.querySelector(".helmet-send-popup.is-open");
  if (!(openPopup instanceof HTMLElement)) {
    return;
  }
  e.preventDefault();
  openPopup.classList.remove("is-open");
  openPopup.setAttribute("aria-hidden", "true");
  let returnId = "helmet-send-image";
  if (openPopup.id === "helmet-send-popup-text") {
    returnId = "helmet-send-text";
  } else if (openPopup.id === "helmet-remove-popup-image") {
    returnId = "helmet-remove-image";
  }
  const returnBtn = document.getElementById(returnId);
  if (returnBtn instanceof HTMLElement) {
    returnBtn.focus();
  }
});

let current = 0;
let touchStartX = 0;
let touchStartY = 0;
let isAnimating = false;
let wheelLocked = false;
let isChoiceAnimating = false;
let choiceSweepRafId = null;
let popupCloseTimer = null;
let currentPopupMode = "profile";
let hasTargetsScrolledDown = false;
let isChatOpen = false;
let isChatRequestPending = false;
let fetchedGeminiApiKey = "";
let typingIndicatorEl = null;
let persistedDeviceCode = "";
let isDeviceLocked = false;
let lockedContribution = null;
let toastTimerId = null;
let galleryPreviewCloseTimerId = null;
let questionTypingTimerId = null;
let questionTypingRunId = 0;
let targetsDividerResizeHandler = null;
let targetsTextObserver = null;
const targetsTypewriterTimerIds = new Set();
const GALLERY_PREVIEW_ANIMATION_MS = 220;
let currentGalleryPreviewSrc = "";
let currentGalleryPreviewAssetKey = "";
let currentGalleryLikeCount = 0;
let currentGalleryLikedByViewer = false;

function syncGalleryLikeUi() {
  if (!(galleryLikeBtnEl instanceof HTMLButtonElement) || !(galleryLikeCountEl instanceof HTMLElement)) {
    return;
  }
  galleryLikeCountEl.textContent = `${Math.max(0, currentGalleryLikeCount)} Like`;
  galleryLikeBtnEl.classList.toggle("is-liked", currentGalleryLikedByViewer);
  if (galleryLikeIconEl instanceof HTMLImageElement) {
    galleryLikeIconEl.src = currentGalleryLikedByViewer
      ? GALLERY_LIKE_ICON_FILLED_URL
      : GALLERY_LIKE_ICON_EMPTY_URL;
  }
}

function openGalleryPreview(imageSrc, showAlexCaption = false, assetKey = "", likeCount = 0, likedByViewer = false) {
  if (!(galleryPreviewEl instanceof HTMLElement) || !(galleryPreviewImageEl instanceof HTMLImageElement) || !(galleryPreviewCaptionEl instanceof HTMLElement)) {
    return;
  }
  if (galleryPreviewCloseTimerId !== null) {
    window.clearTimeout(galleryPreviewCloseTimerId);
    galleryPreviewCloseTimerId = null;
  }
  galleryPreviewImageEl.src = imageSrc;
  currentGalleryPreviewSrc = imageSrc;
  currentGalleryPreviewAssetKey = assetKey;
  currentGalleryLikeCount = Number.isFinite(likeCount) ? Math.max(0, Math.floor(likeCount)) : 0;
  currentGalleryLikedByViewer = Boolean(likedByViewer);
  if (galleryLikeBtnEl instanceof HTMLButtonElement) {
    galleryLikeBtnEl.disabled = false;
  }
  syncGalleryLikeUi();
  galleryPreviewCaptionEl.hidden = !showAlexCaption;
  galleryPreviewCaptionEl.innerHTML = showAlexCaption ? "<b><a href=\"https://www.instagram.com/alex.timoncini/\" target=\"_blank\" rel=\"noopener noreferrer\">@alex.timoncini</a><br><br>22 y.o. Brisighella<br><br>Full-Stack Web Developer</b><br><br><a href=\"tel:+39393456200\">+39 393 456 200</a><br><a href=\"mailto:timoncinidev@gmail.com\">timoncinidev@gmail.com</a>" : "";
  galleryPreviewEl.hidden = false;
  galleryPreviewEl.classList.remove("is-closing");
  window.requestAnimationFrame(() => {
    galleryPreviewEl.classList.add("is-open");
  });
}

function closeGalleryPreview() {
  if (!(galleryPreviewEl instanceof HTMLElement) || !(galleryPreviewImageEl instanceof HTMLImageElement) || !(galleryPreviewCaptionEl instanceof HTMLElement)) {
    return;
  }
  if (galleryPreviewEl.hidden) {
    return;
  }
  playPopupCloseSound();
  galleryPreviewEl.classList.remove("is-open");
  galleryPreviewEl.classList.add("is-closing");
  if (galleryPreviewCloseTimerId !== null) {
    window.clearTimeout(galleryPreviewCloseTimerId);
  }
  galleryPreviewCloseTimerId = window.setTimeout(() => {
    galleryPreviewEl.hidden = true;
    galleryPreviewEl.classList.remove("is-closing");
    galleryPreviewImageEl.src = "";
    currentGalleryPreviewSrc = "";
    currentGalleryPreviewAssetKey = "";
    currentGalleryLikeCount = 0;
    currentGalleryLikedByViewer = false;
    if (galleryLikeBtnEl instanceof HTMLButtonElement) {
      galleryLikeBtnEl.disabled = false;
    }
    galleryPreviewCaptionEl.hidden = true;
    galleryPreviewCaptionEl.textContent = "";
    galleryPreviewCloseTimerId = null;
  }, GALLERY_PREVIEW_ANIMATION_MS);
}

if (galleryPreviewBackdropEl instanceof HTMLElement) {
  galleryPreviewBackdropEl.addEventListener("click", closeGalleryPreview);
}
if (galleryPreviewCloseEl instanceof HTMLButtonElement) {
  galleryPreviewCloseEl.addEventListener("click", closeGalleryPreview);
}
if (galleryLikeBtnEl instanceof HTMLButtonElement) {
  galleryLikeBtnEl.addEventListener("click", async () => {
    if (!currentGalleryPreviewSrc) {
      return;
    }
    playGalleryHeartSound();
    const previousLiked = currentGalleryLikedByViewer;
    const previousLikeCount = currentGalleryLikeCount;
    const nextLiked = !currentGalleryLikedByViewer;
    currentGalleryLikedByViewer = nextLiked;
    currentGalleryLikeCount = Math.max(0, previousLikeCount + (nextLiked ? 1 : -1));
    syncGalleryLikeUi();
    const syncActiveTileDataset = () => {
      if (!currentGalleryPreviewAssetKey) {
        return;
      }
      const activeTileButtons = document.querySelectorAll(`.helmet-tile--clickable[data-gallery-asset-key="${currentGalleryPreviewAssetKey}"]`);
      activeTileButtons.forEach((buttonEl) => {
        if (buttonEl instanceof HTMLElement) {
          buttonEl.dataset.galleryLikeCount = String(currentGalleryLikeCount);
          buttonEl.dataset.galleryLiked = currentGalleryLikedByViewer ? "1" : "0";
        }
      });
    };
    syncActiveTileDataset();
    if (!currentGalleryPreviewAssetKey) {
      return;
    }
    galleryLikeBtnEl.disabled = true;
    try {
      const payload = await submitGalleryLike(currentGalleryPreviewAssetKey, nextLiked);
      currentGalleryLikedByViewer = Boolean(payload.likedByViewer);
      currentGalleryLikeCount = Number.isFinite(payload.likeCount) ? Math.max(0, Math.floor(payload.likeCount)) : currentGalleryLikeCount;
      syncGalleryLikeUi();
      syncActiveTileDataset();
    } catch (_error) {
      currentGalleryLikedByViewer = previousLiked;
      currentGalleryLikeCount = previousLikeCount;
      syncGalleryLikeUi();
      syncActiveTileDataset();
      showUploadToast("Like non disponibile al momento.", "error");
    } finally {
      galleryLikeBtnEl.disabled = false;
    }
  });
}

const CHAT_SITE_CONTEXT = `
Sito: Intesta (presentazione mobile-first in italiano).
Autore/progetto: Tomas Berardi, studente ISIA (Design del prodotto e della comunicazione), progetto tesi sul tema dell'utilizzo del casco tra i giovani.
Obiettivo del sito: coinvolgere utenti giovani, presentare il progetto, invitare a interagire con i contenuti e a contattare il progetto.
Tono del sito: diretto, semplice, umano, contemporaneo, frasi brevi, senza tecnicismi inutili.
Contenuti principali: percorso a slide, sezioni profilo/casco, contatti, pagine legali (privacy, cookie, termini di utilizzo).
Ambito creativo: l'assistente puo supportare la creazione del casco con brainstorming, proposte colori/materiali/texture, concept visivi, naming e varianti di stile.
Contatti e profili utili:
- Tomas Berardi (autore progetto) - studente ISIA, 21 anni, Faenza.
- Contatti Tomas Berardi: telefono +39 3313809922, email intesta2026@gmail.com.
- Alex Timoncini (programmatore / full-stack web developer) - 22 anni, Brisighella.
- Contatti Alex Timoncini: telefono +39 393 456 200, email timoncinidev@gmail.com.
Vincoli: niente divagazioni su temi non collegati al progetto/sito; niente invenzioni di dati, prezzi, policy o funzionalita non presenti.
`;

const popupContent = {
  tomas: `
    <div class="profile-photo-frame" aria-hidden="true">
      <span class="photo-corner photo-corner--tl"></span>
      <span class="photo-corner photo-corner--tr"></span>
      <span class="photo-corner photo-corner--bl"></span>
      <span class="photo-corner photo-corner--br"></span>
      <img class="profile-photo" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
    </div>
    <p class="profile-bio">
        <b><a href="https://www.instagram.com/tomas._.berardi" target="_blank" rel="noopener noreferrer">@tomas._.berardi</a><br><br>21 y.o. Faenza<br><br>Studente ISIA</b>: università di Design del prodotto e della comunicazione.<br><br>Ho bisogno del tuo aiuto per il mio progetto di tesi.<br>Ho realizzato questo sito e attività per te!
    </p>
    <p class="profile-contact">
      Per maggiori informazioni conttatami.<br>
      <a href="tel:+393313809922">+39 3313809922</a><br />
      <a href="mailto:intesta2026@gmail.com">intesta2026@gmail.com</a>
    </p>
  `,
  casco: `
    <article class="helmet-event-flow" aria-label="Evento casco">
      <section class="helmet-event-screen helmet-event-screen--hero">
        <header class="helmet-event-head">
          <p class="helmet-event-place">Parco Bucci Faenza</p>
          <p class="helmet-event-address">Entrata piazzale Pancrazi</p>
        </header>
        <p class="helmet-event-title">EVENTO DESIGN<br />DI GRUPPO</p>
        <div class="helmet-event-media">
          <img class="helmet-event-photo" src="./assets/images/casco.png" alt="Immagine casco evento" />
          <div class="helmet-event-time">
            <p class="helmet-event-time-col helmet-event-time-col--left">
              <span>09</span>
              <span>05</span>
              <span>26</span>
            </p>
            <p class="helmet-event-time-col helmet-event-time-col--right">
              <span>15</span>
              <span>00</span>
            </p>
          </div>
        </div>
        <button class="targets-jump-btn helmet-event-jump" id="helmet-event-jump" type="button" aria-label="Scorri in basso nel popup casco">
          <img class="icon-svg icon-svg--down" src="./assets/images/chevrons-down.svg" alt="" aria-hidden="true" />
        </button>
      </section>
      <section class="helmet-event-screen helmet-event-screen--details" id="helmet-event-details">
        <div class="helmet-event-details-content">
          <p class="helmet-event-details-topline">
            <span>Premio</span>
            <span>Bike Gadget Ltd.</span>
          </p>

          <section class="helmet-event-details-block">
            <h3 class="helmet-event-details-title">Ci incontriamo?</h3>
            <p class="helmet-event-details-copy">
              Un invito a ragionare sul tema della realizzazione di un casco che ci rappresenti.
            </p>
          </section>

          <section class="helmet-event-details-block">
            <h3 class="helmet-event-details-title">Come partecipare?</h3>
            <p class="helmet-event-details-copy">
              Se hai tra i 16-20 anni e vuoi partecipare da solo o con amici contattami.
            </p>
            <p class="helmet-event-details-contact">
              <a href="https://www.instagram.com/intesta.26/" target="_blank" rel="noopener noreferrer">@intesta.26</a><br />
              +39 331 380 9922<br />
              intesta2026@gmail.com
            </p>
          </section>

          <section class="helmet-event-details-block">
            <h3 class="helmet-event-details-title">Orario-Attività</h3>
            <p class="helmet-event-details-subtitle">Per i piu organizzati</p>
            <div class="helmet-event-timeline">
              <p class="helmet-event-timeline-row">
                <span class="helmet-event-timeline-time">15:00</span>
                <span class="helmet-event-timeline-desc">-Ci conosciamo</span>
              </p>
              <p class="helmet-event-timeline-row">
                <span class="helmet-event-timeline-time">16:00</span>
                <span class="helmet-event-timeline-desc">-Brainstorming tutti insieme</span>
              </p>
              <p class="helmet-event-timeline-row">
                <span class="helmet-event-timeline-time">17:00</span>
                <span class="helmet-event-timeline-desc">-Realizziamo un modello/disegno/AI image della vostra idea di gruppo o individuale</span>
              </p>
              <p class="helmet-event-timeline-row">
                <span class="helmet-event-timeline-time">18:00</span>
                <span class="helmet-event-timeline-desc">-Votazione dell'idea migliore e premiazione!</span>
              </p>
            </div>
          </section>
        </div>
      </section>
    </article>
  `
};

function extractImageSourcesFromHtml(htmlString) {
  const html = String(htmlString || "");
  const matches = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g));
  return matches
    .map((match) => (Array.isArray(match) && typeof match[1] === "string" ? match[1].trim() : ""))
    .filter((src) => Boolean(src));
}

const popupTemplateImageUrls = Object.values(popupContent)
  .flatMap((content) => extractImageSourcesFromHtml(content))
  .filter((value, index, arr) => arr.indexOf(value) === index);

registerStartupTask(Promise.all(popupTemplateImageUrls.map((sourceUrl) => preloadImageUrl(sourceUrl))));

function syncProfilePopupVariant(type) {
  if (!(popupEl instanceof HTMLElement) || !(popupCloseEl instanceof HTMLButtonElement)) {
    return;
  }
  const isHelmetVariant = type === "casco";
  popupEl.classList.toggle("is-helmet-event-mode", isHelmetVariant);
  popupCloseEl.innerHTML = defaultPopupCloseMarkup;
  popupCloseEl.setAttribute("aria-label", "Chiudi popup profilo");
}

function wireHelmetPopupJump() {
  if (!(popupBodyEl instanceof HTMLElement) || !(popupCardEl instanceof HTMLElement)) {
    return;
  }
  popupBodyEl.scrollTo({ top: 0, behavior: "auto" });
  const jumpBtn = popupCardEl.querySelector("#helmet-event-jump");
  const detailsSection = popupCardEl.querySelector("#helmet-event-details");
  if (!(jumpBtn instanceof HTMLButtonElement) || !(detailsSection instanceof HTMLElement)) {
    return;
  }
  jumpBtn.addEventListener("click", () => {
    playNavDownSound();
    popupBodyEl.scrollTo({
      top: detailsSection.offsetTop,
      behavior: "smooth"
    });
  });
}

const legalPopupPages = {
  PR: { href: "./privacy.html", title: "Privacy Policy" },
  CK: { href: "./cookie.html", title: "Cookie tecnici" },
  TS: { href: "./termini.html", title: "Termini di utilizzo del servizio" }
};
const HELMET_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const HELMET_UPLOAD_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const HELMET_UPLOAD_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const DEVICE_CODE_STORAGE_KEY = "intesta_device_code_v1";
const HELMET_UPLOAD_ENDPOINTS = [
  "https://foxly.it/intesta_api/helmet-submissions",
  "https://foxly.it/intesta_api/public/helmet-submissions",
  "./intesta_api/helmet-submissions"
];
const DEVICE_REGISTER_ENDPOINTS = [
  "https://foxly.it/intesta_api/devices/register",
  "https://foxly.it/intesta_api/public/devices/register",
  "./intesta_api/devices/register"
];
const DEVICE_SUBMISSION_STATUS_ENDPOINTS = [
  "https://foxly.it/intesta_api/devices/submission-status",
  "https://foxly.it/intesta_api/public/devices/submission-status",
  "./intesta_api/devices/submission-status"
];
const DEVICE_DELETE_SUBMISSION_ENDPOINTS = [
  "https://foxly.it/intesta_api/devices/delete-submission",
  "https://foxly.it/intesta_api/public/devices/delete-submission",
  "./intesta_api/devices/delete-submission"
];
const GALLERY_APPROVED_IMAGE_ENDPOINTS = [
  "https://foxly.it/intesta_api/gallery/approved-images",
  "https://foxly.it/intesta_api/public/gallery/approved-images",
  "./intesta_api/gallery/approved-images"
];
const GALLERY_LIKE_ENDPOINTS = [
  "https://foxly.it/intesta_api/gallery/like",
  "https://foxly.it/intesta_api/public/gallery/like",
  "./intesta_api/gallery/like"
];

const slideEls = slides.map((slideData) => {
  const section = document.createElement("section");
  section.className = "slide";
  if (slideData.control === "hero") {
    section.classList.add("slide--hero");
    section.innerHTML = `
      <div class="hero-carousel" aria-hidden="true">
        <div class="hero-carousel-layer is-active" id="hero-layer-a"></div>
        <div class="hero-carousel-layer" id="hero-layer-b"></div>
      </div>
      <img class="hero-logo" src="./assets/images/logo.png" alt="Logo Intesta" />
    `;
  } else {
    section.innerHTML = `<h1 class="slide-title">${slideData.title}</h1>`;
  }
  slidesContainer.append(section);
  return section;
});

const heroLayerAEl = slideEls[0]?.querySelector("#hero-layer-a");
const heroLayerBEl = slideEls[0]?.querySelector("#hero-layer-b");
const heroCarouselEl = slideEls[0]?.querySelector(".hero-carousel");
let heroCarouselSlides = [];
let heroActiveLayerIsA = true;
let heroCarouselIndex = 0;
let heroCarouselTimerId = null;

function setHeroLayerSource(layerEl, sourceUrl) {
  if (!(layerEl instanceof HTMLElement)) {
    return;
  }
  if (!sourceUrl) {
    layerEl.style.backgroundImage = "none";
    return;
  }
  layerEl.style.backgroundImage = `url("${sourceUrl.replace(/"/g, "%22")}")`;
}

function applyHeroBackgroundSources(slideItems) {
  const nextSlides = Array.isArray(slideItems)
    ? slideItems
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const src = typeof item.src === "string" ? item.src.trim() : "";
        if (!src) {
          return null;
        }
        return {
          src,
          logoTone: normalizeHeroUiTone(item.logoTone || "black")
        };
      })
      .filter((item) => item !== null)
      .filter((item, index, arr) => arr.findIndex((entry) => entry && entry.src === item.src) === index)
    : [];
  heroCarouselSlides = nextSlides;
  heroCarouselIndex = 0;
  heroActiveLayerIsA = true;
  const firstSlide = heroCarouselSlides[0] || null;
  const firstSource = firstSlide ? firstSlide.src : "";
  const firstTone = firstSlide ? firstSlide.logoTone : "black";
  setHeroLayerSource(heroLayerAEl, firstSource);
  setHeroLayerSource(heroLayerBEl, firstSource);
  if (heroLayerAEl instanceof HTMLElement) {
    heroLayerAEl.classList.toggle("is-active", Boolean(firstSource));
  }
  if (heroLayerBEl instanceof HTMLElement) {
    heroLayerBEl.classList.remove("is-active");
  }
  if (heroCarouselEl instanceof HTMLElement) {
    heroCarouselEl.classList.toggle("has-media", Boolean(firstSource));
  }
  applyHeroUiTone(firstTone);
}

function startHeroCarousel() {
  if (!(heroLayerAEl instanceof HTMLElement) || !(heroLayerBEl instanceof HTMLElement)) {
    return;
  }
  if (heroCarouselTimerId !== null) {
    window.clearInterval(heroCarouselTimerId);
    heroCarouselTimerId = null;
  }
  if (heroCarouselSlides.length <= 1) {
    return;
  }
  heroCarouselTimerId = window.setInterval(() => {
    heroCarouselIndex = (heroCarouselIndex + 1) % heroCarouselSlides.length;
    const nextSlide = heroCarouselSlides[heroCarouselIndex];
    if (!nextSlide) {
      return;
    }
    const nextLayerEl = heroActiveLayerIsA ? heroLayerBEl : heroLayerAEl;
    const previousLayerEl = heroActiveLayerIsA ? heroLayerAEl : heroLayerBEl;
    setHeroLayerSource(nextLayerEl, nextSlide.src);
    nextLayerEl.classList.add("is-active");
    previousLayerEl.classList.remove("is-active");
    heroActiveLayerIsA = !heroActiveLayerIsA;
    applyHeroUiTone(nextSlide.logoTone);
  }, HERO_CAROUSEL_INTERVAL_MS);
}

applyHeroBackgroundSources([]);
startHeroCarousel();

function escapeChatHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAssistantInlineHtml(value) {
  const escaped = escapeChatHtml(value);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>");
}

function renderAssistantMessageHtml(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n");
  const htmlParts = [];
  let activeListTag = "";
  const closeList = () => {
    if (!activeListTag) {
      return;
    }
    htmlParts.push(`</${activeListTag}>`);
    activeListTag = "";
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      return;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      if (activeListTag !== "ul") {
        closeList();
        activeListTag = "ul";
        htmlParts.push("<ul class=\"ai-chat-list\">");
      }
      htmlParts.push(`<li>${formatAssistantInlineHtml(unorderedMatch[1])}</li>`);
      return;
    }

    const orderedMatch = line.match(/^\d+[\.\)]\s+(.+)$/);
    if (orderedMatch) {
      if (activeListTag !== "ol") {
        closeList();
        activeListTag = "ol";
        htmlParts.push("<ol class=\"ai-chat-list\">");
      }
      htmlParts.push(`<li>${formatAssistantInlineHtml(orderedMatch[1])}</li>`);
      return;
    }

    closeList();

    if (/^[^.!?]{1,72}:$/.test(line)) {
      const titleText = line.endsWith(":") ? line.slice(0, -1) : line;
      htmlParts.push(`<p class="ai-chat-msg-title"><strong>${formatAssistantInlineHtml(titleText)}</strong></p>`);
      return;
    }

    htmlParts.push(`<p>${formatAssistantInlineHtml(line)}</p>`);
  });

  closeList();
  return htmlParts.join("");
}

function appendChatMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `ai-chat-msg ai-chat-msg--${role}`;
  if (role === "assistant") {
    msg.innerHTML = renderAssistantMessageHtml(text);
  } else {
    msg.textContent = text;
  }
  chatMessagesEl.append(msg);
  scrollAiChatToBottom(msg);
  return msg;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getHelmetUploadEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.endpoint ? String(uploadConfig.endpoint) : "";
  return [customEndpoint, ...HELMET_UPLOAD_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getDeviceRegisterEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.deviceEndpoint ? String(uploadConfig.deviceEndpoint) : "";
  return [customEndpoint, ...DEVICE_REGISTER_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getDeviceSubmissionStatusEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.deviceStatusEndpoint ? String(uploadConfig.deviceStatusEndpoint) : "";
  return [customEndpoint, ...DEVICE_SUBMISSION_STATUS_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getDeviceDeleteSubmissionEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.deviceDeleteEndpoint ? String(uploadConfig.deviceDeleteEndpoint) : "";
  return [customEndpoint, ...DEVICE_DELETE_SUBMISSION_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getGalleryApprovedImageEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.galleryEndpoint ? String(uploadConfig.galleryEndpoint) : "";
  return [customEndpoint, ...GALLERY_APPROVED_IMAGE_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getGalleryLikeEndpoints() {
  const uploadConfig = window.INTESA_UPLOAD || {};
  const customEndpoint = uploadConfig.galleryLikeEndpoint ? String(uploadConfig.galleryLikeEndpoint) : "";
  return [customEndpoint, ...GALLERY_LIKE_ENDPOINTS].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function getStoredDeviceCode() {
  const value = window.localStorage.getItem(DEVICE_CODE_STORAGE_KEY) || "";
  return value.length >= 8 ? value : "";
}

async function registerDeviceOnServer(deviceCode = "") {
  const endpoints = getDeviceRegisterEndpoints();
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(deviceCode ? { deviceCode } : {})
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
      if (response.ok && payload && payload.result === 1 && typeof payload.deviceCode === "string") {
        return payload.deviceCode;
      }
      if (response.status !== 404) {
        break;
      }
    } catch (_error) {
      if (String(endpoint).includes("://")) {
        continue;
      }
      break;
    }
  }
  return "";
}

async function ensureDeviceCode() {
  const localCode = getStoredDeviceCode();
  const registeredCode = await registerDeviceOnServer(localCode);
  if (registeredCode && registeredCode.length >= 8) {
    window.localStorage.setItem(DEVICE_CODE_STORAGE_KEY, registeredCode);
    persistedDeviceCode = registeredCode;
    return registeredCode;
  }
  if (localCode) {
    persistedDeviceCode = localCode;
    return localCode;
  }
  return "";
}

function buildContributionImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== "string") {
    return "";
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  const cleanPath = imagePath.replace(/^\/+/, "");
  const uploadConfig = window.INTESA_UPLOAD || {};
  const baseUrl = uploadConfig.assetBaseUrl
    ? String(uploadConfig.assetBaseUrl)
    : "https://foxly.it/intesta_api/";
  return `${baseUrl.replace(/\/+$/, "")}/${cleanPath}`;
}

function showUploadToast(message, type = "success") {
  if (!message) {
    return;
  }
  let toastEl = document.querySelector("#helmet-upload-toast");
  if (!(toastEl instanceof HTMLElement)) {
    toastEl = document.createElement("div");
    toastEl.id = "helmet-upload-toast";
    toastEl.className = "upload-toast";
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.remove("is-success", "is-error", "is-visible");
  toastEl.classList.add(type === "error" ? "is-error" : "is-success", "is-visible");
  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId);
  }
  toastTimerId = window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
    toastTimerId = null;
  }, 2200);
}

async function fetchDeviceSubmissionStatus(deviceCode) {
  if (!deviceCode) {
    return null;
  }
  const endpoints = getDeviceSubmissionStatusEndpoints();
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}deviceCode=${encodeURIComponent(deviceCode)}`;
      const response = await fetch(url, { method: "GET" });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
      if (!response.ok || !payload || payload.result !== 1) {
        if (response.status !== 404) {
          return null;
        }
        continue;
      }
      if (payload.exists === 1 && payload.contributions) {
        return payload.contributions;
      }
      return null;
    } catch (_error) {
      if (String(endpoint).includes("://")) {
        continue;
      }
      return null;
    }
  }
  return null;
}

async function deleteDeviceSubmission(deviceCode, type) {
  if (!deviceCode || (type !== "text" && type !== "image")) {
    throw new Error("Parametri eliminazione non validi.");
  }
  const endpoints = getDeviceDeleteSubmissionEndpoints();
  let lastError = new Error("Endpoint eliminazione non disponibile.");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          deviceCode,
          type
        })
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (response.ok && payload && payload.result === 1) {
        return payload;
      }
      lastError = new Error(payload && payload.msg ? payload.msg : `Eliminazione non riuscita (HTTP ${response.status}).`);
      if (response.status !== 404) {
        throw lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Errore di rete.");
      if (String(endpoint).includes("://")) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

async function fetchApprovedGalleryImages() {
  const deviceCode = persistedDeviceCode || getStoredDeviceCode();
  const endpoints = getGalleryApprovedImageEndpoints();
  for (const endpoint of endpoints) {
    try {
      const endpointUrl = deviceCode
        ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}deviceCode=${encodeURIComponent(deviceCode)}`
        : endpoint;
      const response = await fetch(endpointUrl, { method: "GET" });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }
        break;
      }
      if (!payload || payload.result !== 1) {
        continue;
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      const approved = items.map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const src = typeof item.imageUrl === "string" && item.imageUrl
          ? item.imageUrl
          : (typeof item.imagePath === "string" && item.imagePath ? buildContributionImageUrl(item.imagePath) : "");
        if (!src) {
          return null;
        }
        return {
          src,
          assetKey: typeof item.assetKey === "string" && item.assetKey ? item.assetKey : "",
          likeCount: Number.isFinite(Number(item.likeCount)) ? Number(item.likeCount) : 0,
          likedByViewer: Boolean(item.likedByViewer),
          logoTone: normalizeHeroUiTone(item.logoTone || "black")
        };
      }).filter(Boolean);
      const alex = payload.alex && typeof payload.alex === "object"
        ? {
          src: "./assets/images/alex.png",
          assetKey: typeof payload.alex.assetKey === "string" && payload.alex.assetKey ? payload.alex.assetKey : "alex",
          likeCount: Number.isFinite(Number(payload.alex.likeCount)) ? Number(payload.alex.likeCount) : 0,
          likedByViewer: Boolean(payload.alex.likedByViewer),
          isAlex: true
        }
        : {
          src: "./assets/images/alex.png",
          assetKey: "alex",
          likeCount: 0,
          likedByViewer: false,
          isAlex: true
        };
      return [alex, ...approved];
    } catch (_error) {
      if (String(endpoint).includes("://")) {
        continue;
      }
      break;
    }
  }
  return [{
    src: "./assets/images/alex.png",
    assetKey: "alex",
    likeCount: 0,
    likedByViewer: false,
    isAlex: true
  }];
}

registerStartupTask((async () => {
  const approvedItems = await fetchApprovedGalleryImages();
  const heroSources = approvedItems
    .filter((item) => item && typeof item === "object" && !item.isAlex)
    .map((item) => ({
      src: typeof item.src === "string" ? item.src : "",
      logoTone: normalizeHeroUiTone(item.logoTone || "black")
    }))
    .filter((item) => Boolean(item.src));
  await Promise.all(heroSources.map((item) => preloadImageUrl(item.src)));
  applyHeroBackgroundSources(heroSources);
  startHeroCarousel();
})());

async function submitGalleryLike(assetKey, liked) {
  const deviceCode = persistedDeviceCode || (await ensureDeviceCode());
  if (!deviceCode) {
    throw new Error("Dispositivo non disponibile.");
  }
  const endpoints = getGalleryLikeEndpoints();
  let lastError = new Error("Endpoint like non disponibile.");
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          deviceCode,
          assetKey,
          liked
        })
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }
      if (response.ok && payload && payload.result === 1) {
        return {
          likeCount: Number.isFinite(payload.likeCount) ? Number(payload.likeCount) : 0,
          likedByViewer: Boolean(payload.likedByViewer)
        };
      }
      lastError = new Error(payload && payload.msg ? payload.msg : `Like non riuscito (HTTP ${response.status}).`);
      if (response.status !== 404) {
        throw lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Errore di rete.");
      if (String(endpoint).includes("://")) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

function validateHelmetUploadFile(file) {
  if (!file) {
    return "";
  }
  if (!HELMET_UPLOAD_ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Formato non supportato. Usa JPG, PNG, GIF o WEBP.";
  }
  if (file.size > HELMET_UPLOAD_MAX_BYTES) {
    return `File troppo grande. Limite ${formatBytes(HELMET_UPLOAD_MAX_BYTES)}.`;
  }
  return "";
}

async function submitHelmetContribution(payload) {
  const { deviceCode, description, imageFile } = payload;
  const formData = new FormData();
  formData.append("deviceCode", deviceCode);
  if (description) {
    formData.append("description", description);
  }
  if (imageFile) {
    formData.append("image", imageFile, imageFile.name);
  }

  const endpoints = getHelmetUploadEndpoints();
  let lastError = new Error("Endpoint upload non disponibile.");

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (response.ok && payload && payload.result === 1) {
        return payload;
      }

      const message = payload && payload.msg
        ? payload.msg
        : `Upload non riuscito (HTTP ${response.status}).`;
      lastError = new Error(message);

      if (response.status !== 404) {
        throw lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Errore di rete.");
      if (String(endpoint).includes("://")) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

function scrollAiChatToBottom(anchorEl) {
  if (!chatMessagesEl) {
    return;
  }
  const run = () => {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  };
  run();
  window.requestAnimationFrame(() => {
    run();
    window.requestAnimationFrame(run);
  });
}

function showTypingIndicator() {
  if (typingIndicatorEl) {
    return;
  }
  const msg = document.createElement("div");
  msg.className = "ai-chat-msg ai-chat-msg--assistant ai-chat-msg--typing";
  msg.setAttribute("aria-label", "Assistente sta scrivendo");
  msg.innerHTML = `
    <span class="ai-dot"></span>
    <span class="ai-dot"></span>
    <span class="ai-dot"></span>
  `;
  chatMessagesEl.append(msg);
  scrollAiChatToBottom(msg);
  typingIndicatorEl = msg;
}

function hideTypingIndicator() {
  if (!typingIndicatorEl) {
    return;
  }
  typingIndicatorEl.remove();
  typingIndicatorEl = null;
}

async function appendAssistantMessageTypewriter(text) {
  let msg = typingIndicatorEl;
  if (msg) {
    typingIndicatorEl = null;
  } else {
    msg = document.createElement("div");
    msg.className = "ai-chat-msg ai-chat-msg--assistant ai-chat-msg--typewriter ai-chat-msg--from-dots";
    msg.textContent = "";
    chatMessagesEl.append(msg);
    scrollAiChatToBottom(msg);
  }

  msg.className = "ai-chat-msg ai-chat-msg--assistant ai-chat-msg--typewriter ai-chat-msg--from-dots";
  msg.textContent = "";
  window.requestAnimationFrame(() => {
    msg.classList.add("is-expanding");
  });
  await sleep(130);
  msg.classList.remove("is-expanding");
  msg.classList.remove("ai-chat-msg--from-dots");

  let keepAutoScroll = true;
  const autoScrollLoop = () => {
    if (!keepAutoScroll) {
      return;
    }
    scrollAiChatToBottom(msg);
    window.requestAnimationFrame(autoScrollLoop);
  };
  window.requestAnimationFrame(autoScrollLoop);

  const fullText = text || "";
  let progressiveText = "";
  for (let i = 0; i < fullText.length; i += 1) {
    progressiveText += fullText[i];
    msg.innerHTML = renderAssistantMessageHtml(progressiveText);
    scrollAiChatToBottom(msg);
    await sleep(16);
  }

  keepAutoScroll = false;
  msg.classList.remove("ai-chat-msg--typewriter");
  scrollAiChatToBottom(msg);
  return msg;
}

function setChatPendingState(pending) {
  isChatRequestPending = pending;
  chatInputEl.disabled = pending;
  chatSendEl.disabled = pending;
}

async function submitChatMessage(rawMessage) {
  if (isChatRequestPending) {
    return;
  }
  const userMessage = String(rawMessage || "").trim();
  if (!userMessage) {
    return;
  }

  appendChatMessage("user", userMessage);
  chatInputEl.value = "";
  setChatPendingState(true);
  showTypingIndicator();

  try {
    const reply = await getAssistantReply(userMessage);
    await appendAssistantMessageTypewriter(reply);
  } finally {
    hideTypingIndicator();
    setChatPendingState(false);
    chatInputEl.focus();
  }
}

async function getAssistantReply(userMessage) {
  const geminiConfig = window.INTESA_CHAT_GEMINI || {};
  const localApiKey = geminiConfig && geminiConfig.apiKey ? String(geminiConfig.apiKey) : "";
  const apiKey = localApiKey || (await fetchGeminiApiKeyFromServer());
  if (!apiKey) {
    return "Ho ricevuto la tua domanda. API key non disponibile: configura il server endpoint /intesta_api/gemini-key.";
  }

  const modelCandidates = Array.isArray(geminiConfig.models) && geminiConfig.models.length > 0
    ? geminiConfig.models
    : [geminiConfig.model || "gemini-2.0-flash-lite", "gemma-3-27b-it"];
  const systemPrompt = geminiConfig.systemPrompt || `
Sei l'assistente ufficiale del sito Intesta.
Usa solo il contesto fornito qui sotto e non inventare dettagli mancanti.
Rispondi in italiano con tono amichevole, diretto e concreto.

Obiettivo:
- aiutare su progetto Intesta, invio descrizione/foto casco, galleria, contatti e pagine legali;
- offrire supporto creativo concreto mentre l'utente sta ideando il casco;
- proporre sempre il prossimo passo pratico.

Stile:
- massimo 4 frasi brevi;
- se utile usa 2-4 punti elenco;
- evita testo generico.

Quando l'utente chiede idee creative casco:
- proponi 3-5 idee diverse e realizzabili;
- per ogni idea indica palette colori, mood e un dettaglio distintivo;
- aggiungi 1 variante "safe" e 1 variante piu audace;
- chiudi con una domanda utile per convergere (es. stile, colori, target, evento).

Se la domanda e fuori tema:
- rispondi con 1 frase gentile;
- proponi subito 2 argomenti pertinenti al sito.

Se manca un dato:
- dichiaralo chiaramente;
- indica dove verificarlo nel sito.
`;
  const mergedContext = geminiConfig.context
    ? `${CHAT_SITE_CONTEXT}\n${geminiConfig.context}`
    : CHAT_SITE_CONTEXT;
  const context = `\n\nContesto sito:\n${mergedContext}`;
  const promptText = `${systemPrompt}${context}\n\nDomanda utente: ${userMessage}`;

  let hadQuotaError = false;
  let hadTemporaryError = false;

  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: promptText
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const lowered = errorText.toLowerCase();
        if (response.status === 429 || lowered.includes("quota") || lowered.includes("rate limit")) {
          hadQuotaError = true;
          continue;
        }
        if (response.status >= 500) {
          hadTemporaryError = true;
          continue;
        }
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
      if (text) {
        return text;
      }
    } catch (error) {
      hadTemporaryError = true;
      continue;
    }
  }

  if (hadQuotaError) {
    return "In questo momento la quota AI giornaliera e terminata. Riprova tra poco.";
  }
  if (hadTemporaryError) {
    return "Il servizio AI e temporaneamente non disponibile. Riprova tra poco.";
  }
  return "Non ho trovato una risposta utile. Riprova con una domanda piu specifica.";
}

async function fetchGeminiApiKeyFromServer() {
  if (fetchedGeminiApiKey) {
    return fetchedGeminiApiKey;
  }

  const geminiConfig = window.INTESA_CHAT_GEMINI || {};
  const endpointCandidates = [
    geminiConfig.apiKeyEndpoint || "",
    "https://foxly.it/intesta_api/gemini-key",
    "https://foxly.it/intesta_api/public/gemini-key",
    "./intesta_api/gemini-key"
  ].filter(Boolean);

  for (const endpoint of endpointCandidates) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (data && data.result === 1 && typeof data.apiKey === "string" && data.apiKey.length > 0) {
        fetchedGeminiApiKey = data.apiKey;
        return fetchedGeminiApiKey;
      }
    } catch (error) {
      continue;
    }
  }

  return "";
}

function closeChatPanel() {
  isChatOpen = false;
  chatRootEl.classList.remove("is-open");
  chatPanelEl.setAttribute("aria-hidden", "true");
  syncAiChatDocking();
}

function openChatPanel() {
  isChatOpen = true;
  chatRootEl.classList.add("is-open");
  chatPanelEl.setAttribute("aria-hidden", "false");
  chatInputEl.focus();
  syncAiChatDocking();
}

function syncAiChatDocking() {
  const shouldManageDock = current === TARGETS_SLIDE_INDEX && popupEl.hidden && hasTargetsScrolledDown;
  if (!shouldManageDock) {
    chatRootEl.classList.remove("is-docked");
    chatRootEl.style.setProperty("--ai-dock-shift", "0px");
    return;
  }

  const footerContactEl = controlsEl.querySelector(".targets-contact-row");
  const inlineLegalEl = controlsEl.querySelector(".legal-dock.is-inline-footer");
  const footerEls = [footerContactEl, inlineLegalEl]
    .filter((el) => el instanceof HTMLElement);
  if (footerEls.length === 0) {
    chatRootEl.classList.remove("is-docked");
    chatRootEl.style.setProperty("--ai-dock-shift", "0px");
    return;
  }

  const footerTopPx = Math.min(...footerEls.map((el) => el.getBoundingClientRect().top));
  const footerBottomPx = Math.max(...footerEls.map((el) => el.getBoundingClientRect().bottom));
  const footerBlockHeight = Math.max(0, footerBottomPx - footerTopPx);
  const remainingScrollPx = Math.max(0, controlsEl.scrollHeight - controlsEl.scrollTop - controlsEl.clientHeight);
  const viewportBottomPx = window.visualViewport
    ? window.visualViewport.offsetTop + window.visualViewport.height
    : window.innerHeight;
  const chatBottomWithoutShiftPx = viewportBottomPx - 50;
  const minGapPx = 12;
  const overlapPx = (chatBottomWithoutShiftPx + minGapPx) - footerTopPx;
  const dockStartThresholdPx = Math.max(120, footerBlockHeight + 10);
  if (remainingScrollPx > dockStartThresholdPx) {
    chatRootEl.classList.remove("is-docked");
    chatRootEl.style.setProperty("--ai-dock-shift", "0px");
    return;
  }
  const maxShiftPx = Math.max(0, viewportBottomPx - 90);
  const shiftPx = Math.max(0, Math.min(maxShiftPx, overlapPx));

  chatRootEl.classList.toggle("is-docked", shiftPx > 0.5);
  chatRootEl.style.setProperty("--ai-dock-shift", `${shiftPx.toFixed(1)}px`);
}

function syncChatVisibility() {
  const isLastSlide = current === TARGETS_SLIDE_INDEX;
  const shouldShow = isLastSlide && popupEl.hidden && hasTargetsScrolledDown;
  chatRootEl.classList.toggle("is-available", shouldShow);

  const jumpButton = controlsEl.querySelector("#targets-jump-btn");
  if (jumpButton instanceof HTMLButtonElement) {
    const showJump = isLastSlide && popupEl.hidden && !hasTargetsScrolledDown;
    jumpButton.classList.toggle("is-hidden", !showJump);
  }

  if (!shouldShow) {
    closeChatPanel();
  }
  syncAiChatDocking();
}

function openProfilePopup(type) {
  if (popupCloseTimer !== null) {
    window.clearTimeout(popupCloseTimer);
    popupCloseTimer = null;
  }
  currentPopupMode = "profile";
  popupEl.classList.remove("is-legal-mode");
  syncProfilePopupVariant(type);
  popupCardEl.innerHTML = popupContent[type] || popupContent.tomas;
  if (type === "casco") {
    wireHelmetPopupJump();
  } else if (popupBodyEl instanceof HTMLElement) {
    popupBodyEl.scrollTo({ top: 0, behavior: "auto" });
  }
  popupEl.hidden = false;
  popupEl.classList.remove("is-closing");
  window.requestAnimationFrame(() => {
    popupEl.classList.add("is-open");
  });
  app.classList.add("is-popup-open");
  document.body.classList.add("is-profile-popup-open");
  popupCloseEl.focus();
  syncChatVisibility();
}

function openLegalPopup(pageKey) {
  const page = legalPopupPages[pageKey];
  if (!page) {
    return;
  }

  if (popupCloseTimer !== null) {
    window.clearTimeout(popupCloseTimer);
    popupCloseTimer = null;
  }

  currentPopupMode = "legal";
  syncProfilePopupVariant("tomas");
  popupEl.classList.add("is-legal-mode");
  popupCardEl.innerHTML = `
    <section class="legal-popup-shell" aria-label="${page.title}">
      <p class="legal-popup-title">${page.title}</p>
      <iframe class="legal-popup-frame" src="${page.href}" title="${page.title}" loading="lazy"></iframe>
    </section>
  `;
  popupEl.hidden = false;
  popupEl.classList.remove("is-closing");
  window.requestAnimationFrame(() => {
    popupEl.classList.add("is-open");
  });
  app.classList.add("is-popup-open");
  document.body.classList.add("is-profile-popup-open");
  popupCloseEl.focus();
  syncChatVisibility();
}

function closeProfilePopup() {
  if (popupEl.hidden) {
    return;
  }

  popupEl.classList.remove("is-open");
  popupEl.classList.add("is-closing");
  popupCloseTimer = window.setTimeout(() => {
    popupEl.hidden = true;
    popupEl.classList.remove("is-closing");
    if (currentPopupMode === "legal") {
      popupCardEl.innerHTML = popupContent.tomas;
      popupEl.classList.remove("is-legal-mode");
      currentPopupMode = "profile";
    }
    syncProfilePopupVariant("tomas");
    document.body.classList.remove("is-profile-popup-open");
    popupCloseTimer = null;
    syncChatVisibility();
  }, POPUP_ANIMATION_MS);
  app.classList.remove("is-popup-open");
}

function setChoiceAnimationState(choice, enabled) {
  const noClass = "is-selecting-no";
  const yesClass = "is-selecting-yes";

  app.classList.remove(noClass, yesClass);
  if (enabled) {
    app.classList.add(choice === "no" ? noClass : yesClass);
  }
}

function clearChoiceDotSweep() {
  if (choiceSweepRafId !== null) {
    window.cancelAnimationFrame(choiceSweepRafId);
    choiceSweepRafId = null;
  }
  app.classList.remove("is-choice-sweep");
  app.style.removeProperty("--choice-sweep-color");
  app.style.removeProperty("--choice-sweep-blur");
}

function startChoiceDotSweep(choice) {
  clearChoiceDotSweep();
  const sweepColor = choice === "yes" ? "#39b86a" : "#e14a4a";
  const startAt = performance.now();
  const easeOutMotion = (t) => 1 - (1 - t) ** 3;

  app.classList.add("is-choice-sweep");
  app.style.setProperty("--choice-sweep-color", sweepColor);
  app.style.setProperty("--choice-sweep-blur", "0px");

  const animate = (now) => {
    const rawProgress = Math.min((now - startAt) / CHOICE_ANIMATION_MS, 1);
    const halfProgress = rawProgress <= 0.5 ? rawProgress * 2 : (1 - rawProgress) * 2;
    const blurFactor = easeOutMotion(halfProgress);

    app.style.setProperty("--choice-sweep-blur", `${(blurFactor * CHOICE_SWEEP_BLUR_PX).toFixed(2)}px`);
    if (rawProgress < 1) {
      choiceSweepRafId = window.requestAnimationFrame(animate);
      return;
    }
    app.style.setProperty("--choice-sweep-blur", "0px");
    choiceSweepRafId = null;
  };
  choiceSweepRafId = window.requestAnimationFrame(animate);
}

function runChoiceAnimation(choice, onDone) {
  const buttonSelector = choice === "no" ? ".choice-btn--no" : ".choice-btn--yes";
  const button = controlsEl.querySelector(buttonSelector);
  if (!(button instanceof HTMLElement)) {
    onDone();
    return;
  }

  isChoiceAnimating = true;
  setChoiceAnimationState(choice, true);
  startChoiceDotSweep(choice);
  button.classList.add("is-picked");

  window.setTimeout(() => {
    button.classList.remove("is-picked");
    setChoiceAnimationState(choice, false);
    clearChoiceDotSweep();
    isChoiceAnimating = false;
    onDone();
  }, CHOICE_ANIMATION_MS);
}

function handleChoice(choice) {
  if (isChoiceAnimating || slides[current].control !== "choice") {
    return;
  }

  playChoiceSound(choice);
  runChoiceAnimation(choice, () => {
    next();
  });
}

function buildTargetsDividerCopies(trackEl) {
  if (!(trackEl instanceof HTMLElement)) {
    return;
  }
  const dividerEl = trackEl.closest(".targets-divider");
  if (!(dividerEl instanceof HTMLElement)) {
    return;
  }
  const rawLabel = typeof dividerEl.dataset.dividerLabel === "string" ? dividerEl.dataset.dividerLabel.trim() : "";
  const label = rawLabel || "cliccami";
  trackEl.textContent = "";

  const sample = document.createElement("span");
  sample.className = "targets-divider-copy";
  sample.textContent = label;
  trackEl.append(sample);

  const sampleWidth = Math.max(1, sample.getBoundingClientRect().width);
  const dividerWidth = Math.max(1, dividerEl.getBoundingClientRect().width || window.innerWidth || 320);
  const copiesPerChunk = Math.max(8, Math.ceil(dividerWidth / sampleWidth) + 2);

  trackEl.textContent = "";
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < copiesPerChunk * 2; i += 1) {
    const item = document.createElement("span");
    item.className = "targets-divider-copy";
    item.textContent = label;
    fragment.append(item);
  }
  trackEl.append(fragment);

  const totalTrackWidth = Math.max(1, trackEl.scrollWidth);
  const loopDistancePx = totalTrackWidth / 2;
  const durationSec = loopDistancePx / TARGETS_DIVIDER_SCROLL_SPEED_PX_PER_SEC;
  trackEl.style.setProperty("--targets-divider-loop-distance", `${loopDistancePx}px`);
  trackEl.style.animationDuration = `${Math.max(6, durationSec)}s`;
}

function buildAllTargetsDividers(scopeEl) {
  if (!(scopeEl instanceof HTMLElement)) {
    return;
  }
  const trackEls = scopeEl.querySelectorAll(".targets-divider-track");
  trackEls.forEach((trackEl, index) => {
    buildTargetsDividerCopies(trackEl);
    if (trackEl instanceof HTMLElement) {
      trackEl.style.animationDirection = index % 2 === 0 ? "reverse" : "normal";
    }
  });
}

function clearTargetsTypewriterState() {
  if (targetsTextObserver) {
    targetsTextObserver.disconnect();
    targetsTextObserver = null;
  }
  targetsTypewriterTimerIds.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  targetsTypewriterTimerIds.clear();
  stopQuestionTypewriterSound();
}

function scheduleTargetsTypewriterTick(callback, delayMs) {
  const timerId = window.setTimeout(() => {
    targetsTypewriterTimerIds.delete(timerId);
    callback();
  }, delayMs);
  targetsTypewriterTimerIds.add(timerId);
}

function normalizeTypewriterSourceText(value) {
  const rawText = String(value || "").replace(/\r\n?/g, "\n");
  const lines = rawText.split("\n").map((line) => line.replace(/\s+/g, " ").trim());
  return lines.join("\n").trim();
}

function startTargetsElementTypewriter(el) {
  if (!(el instanceof HTMLElement) || el.dataset.typewriterDone === "1") {
    return;
  }
  const shouldPlayTypewriterSound = el.dataset.typewriterSound === "question";
  const sourceText = normalizeTypewriterSourceText(el.dataset.typewriterText || el.textContent || "");
  if (!sourceText) {
    el.dataset.typewriterDone = "1";
    return;
  }
  el.dataset.typewriterDone = "1";
  el.textContent = "";
  if (sourceText.includes("\n")) {
    el.classList.add("is-typewriter-preline");
  }
  let cursor = 0;
  const tick = () => {
    cursor += 1;
    el.textContent = sourceText.slice(0, cursor);
    if (shouldPlayTypewriterSound) {
      const currentChar = sourceText.charAt(cursor - 1);
      playQuestionTypewriterSound(currentChar);
    }
    if (cursor >= sourceText.length) {
      if (shouldPlayTypewriterSound) {
        stopQuestionTypewriterSound();
      }
      return;
    }
    const lastChar = sourceText.charAt(cursor - 1);
    const delay = /[?!.,:;]/.test(lastChar)
      ? TARGETS_TEXT_TYPEWRITER_PUNCT_DELAY_MS
      : TARGETS_TEXT_TYPEWRITER_DELAY_MS;
    scheduleTargetsTypewriterTick(tick, delay);
  };
  scheduleTargetsTypewriterTick(tick, TARGETS_TEXT_TYPEWRITER_DELAY_MS);
}

function startTargetsPlaceholderTypewriter(inputEl) {
  if (!(inputEl instanceof HTMLElement) || inputEl.dataset.typewriterPlaceholderDone === "1") {
    return;
  }
  const fallbackPlaceholder = inputEl.getAttribute("placeholder") || "";
  const sourceText = normalizeTypewriterSourceText(inputEl.dataset.typewriterPlaceholder || fallbackPlaceholder);
  if (!sourceText) {
    inputEl.dataset.typewriterPlaceholderDone = "1";
    return;
  }
  inputEl.dataset.typewriterPlaceholderDone = "1";
  inputEl.setAttribute("placeholder", "");
  let cursor = 0;
  const tick = () => {
    cursor += 1;
    inputEl.setAttribute("placeholder", sourceText.slice(0, cursor));
    if (cursor >= sourceText.length) {
      return;
    }
    const lastChar = sourceText.charAt(cursor - 1);
    const delay = /[?!.,:;]/.test(lastChar)
      ? TARGETS_TEXT_TYPEWRITER_PUNCT_DELAY_MS
      : TARGETS_TEXT_TYPEWRITER_DELAY_MS;
    scheduleTargetsTypewriterTick(tick, delay);
  };
  scheduleTargetsTypewriterTick(tick, TARGETS_TEXT_TYPEWRITER_DELAY_MS);
}

function setupTargetsTypewriters(scopeEl) {
  if (!(scopeEl instanceof HTMLElement)) {
    return;
  }
  clearTargetsTypewriterState();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.45) {
        return;
      }
      const targetEl = entry.target;
      if (!(targetEl instanceof HTMLElement)) {
        return;
      }
      if (targetEl.hasAttribute("data-typewriter-text")) {
        startTargetsElementTypewriter(targetEl);
      }
      if (targetEl.hasAttribute("data-typewriter-placeholder")) {
        startTargetsPlaceholderTypewriter(targetEl);
      }
      if (
        targetEl.dataset.typewriterDone === "1" &&
        targetEl.dataset.typewriterPlaceholderDone === "1"
      ) {
        observer.unobserve(targetEl);
      }
      if (
        targetEl.hasAttribute("data-typewriter-text") &&
        !targetEl.hasAttribute("data-typewriter-placeholder") &&
        targetEl.dataset.typewriterDone === "1"
      ) {
        observer.unobserve(targetEl);
      }
      if (
        targetEl.hasAttribute("data-typewriter-placeholder") &&
        !targetEl.hasAttribute("data-typewriter-text") &&
        targetEl.dataset.typewriterPlaceholderDone === "1"
      ) {
        observer.unobserve(targetEl);
      }
    });
  }, {
    root: controlsEl instanceof HTMLElement ? controlsEl : null,
    threshold: [0.45]
  });
  targetsTextObserver = observer;

  const typewriterEls = scopeEl.querySelectorAll("[data-typewriter-text], [data-typewriter-placeholder]");
  typewriterEls.forEach((el) => {
    observer.observe(el);
  });
}

function renderControls(controlType) {
  if (typeof targetsDividerResizeHandler === "function") {
    window.removeEventListener("resize", targetsDividerResizeHandler);
    targetsDividerResizeHandler = null;
  }
  clearTargetsTypewriterState();

  if (legalDockEl && legalDockEl.parentElement === controlsEl) {
    legalDockEl.classList.remove("is-inline-footer");
    legalLinkEls.forEach((linkEl) => {
      linkEl.textContent = linkEl.dataset.shortLabel || linkEl.textContent || "";
    });
    app.insertAdjacentElement("afterend", legalDockEl);
  }

  controlsEl.innerHTML = "";
  controlsEl.onscroll = null;
  controlsEl.classList.toggle("is-choice", controlType === "choice");
  controlsEl.classList.toggle("is-targets", controlType === "targets");
  controlsEl.classList.toggle("is-hero", controlType === "hero");

  if (controlType === "hero") {
    const button = document.createElement("button");
    button.className = "targets-jump-btn targets-jump-btn--hero";
    button.type = "button";
    button.setAttribute("aria-label", "Scorri alla slide successiva");
    button.innerHTML = `
      <img class="icon-svg icon-svg--down" src="./assets/images/chevrons-down.svg" alt="" aria-hidden="true" />
    `;
    button.addEventListener("click", () => {
      playNavDownSound();
      next();
    });
    controlsEl.append(button);
    return;
  }

  if (controlType === "down") {
    const button = document.createElement("button");
    button.className = "nav-btn nav-btn--down";
    button.type = "button";
    button.setAttribute("aria-label", "Scorri alla slide successiva");
    button.innerHTML = `
      <img
        class="icon-svg icon-svg--down"
        src="./assets/images/chevrons-down.svg"
        alt=""
        aria-hidden="true"
      />
    `;
    button.addEventListener("click", () => {
      playNavDownSound();
      next();
    });
    controlsEl.append(button);
    return;
  }

  if (controlType === "choice") {
    const choices = document.createElement("div");
    choices.className = "choice-group";
    choices.innerHTML = `
      <button class="choice-btn choice-btn--no" type="button" aria-label="No, continua">
        <img
          class="icon-svg icon-svg--choice"
          src="./assets/images/x.svg"
          alt=""
          aria-hidden="true"
        />
      </button>
      <button class="choice-btn choice-btn--yes" type="button" aria-label="Sì, continua">
        <img
          class="icon-svg icon-svg--choice"
          src="./assets/images/circle.svg"
          alt=""
          aria-hidden="true"
        />
      </button>
    `;

    const noButton = choices.querySelector(".choice-btn--no");
    const yesButton = choices.querySelector(".choice-btn--yes");
    if (noButton instanceof HTMLElement) {
      noButton.addEventListener("click", () => {
        handleChoice("no");
      });
    }
    if (yesButton instanceof HTMLElement) {
      yesButton.addEventListener("click", () => {
        handleChoice("yes");
      });
    }

    controlsEl.append(choices);
    return;
  }

  if (controlType === "targets") {
    const targets = document.createElement("div");
    targets.className = "target-grid";
    targets.innerHTML = `
      <div class="targets-layout">
        <section class="targets-screen targets-screen--intro">
          <img class="targets-logo" src="./assets/images/logo.png" alt="Logo Intesta" />
          <section class="target-btn target-btn--intro" aria-label="Invito creativo">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <p class="targets-claim" data-typewriter-text="Inventiamo un casco&#10;da bici bellissimo!" data-typewriter-sound="question">Inventiamo un casco<br />da bici bellissimo!</p>
            <button class="targets-jump-btn" id="targets-jump-btn" type="button" aria-label="Scorri ai target profilo e casco">
              <img class="icon-svg icon-svg--down" src="./assets/images/chevrons-down.svg" alt="" aria-hidden="true" />
            </button>
          </section>
        </section>

        <div class="targets-divider" data-divider-label="cliccami" aria-hidden="true">
          <div class="targets-divider-track"></div>
        </div>

        <section class="targets-screen targets-screen--pair" id="targets-lower">
          <button class="target-btn target-btn--profile" type="button" aria-label="Apri popup profilo">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <img class="target-image" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
            <span class="target-discover-chip" aria-hidden="true">scopri</span>
          </button>
          <div class="targets-divider" data-divider-label="new event" aria-hidden="true">
            <div class="targets-divider-track"></div>
          </div>
          <button class="target-btn target-btn--helmet" type="button" aria-label="Apri popup casco">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <img class="target-image target-image--helmet" src="./assets/images/casco.png" alt="Casco" />
            <span class="target-discover-chip" aria-hidden="true">scopri</span>
          </button>
        </section>

        <section class="targets-screen targets-screen--pair" id="targets-upload">
          <div class="helmet-upload-form" id="helmet-upload-form">
            <div class="targets-divider" data-divider-label="scrivimi" aria-hidden="true">
              <div class="targets-divider-track"></div>
            </div>
            <label class="target-btn target-btn--input target-btn--description" for="helmet-description">
              <span class="target-corner target-corner--tl"></span>
              <span class="target-corner target-corner--tr"></span>
              <span class="target-corner target-corner--bl"></span>
              <span class="target-corner target-corner--br"></span>
              <textarea
                class="helmet-upload-textarea"
                id="helmet-description"
                name="description"
                maxlength="2000"
                data-typewriter-placeholder="descrivi il casco che desideri&#10;..."
                placeholder="descrivi il casco che desideri&#10;..."
                aria-label="Descrizione casco"
              ></textarea>
              <button class="helmet-send-btn helmet-send-btn--text" id="helmet-send-text" type="button" aria-label="Invia descrizione">
                <img class="helmet-send-icon" src="./assets/images/send-light.svg" alt="" aria-hidden="true" />
              </button>
              <div
                class="helmet-send-popup"
                id="helmet-send-popup-text"
                role="dialog"
                aria-modal="true"
                aria-labelledby="helmet-send-popup-text-title"
                aria-hidden="true"
              >
                <div class="helmet-send-popup-panel">
                  <span class="helmet-send-popup-mark helmet-send-popup-mark--ok" aria-hidden="true">
                    <img class="helmet-send-popup-check" src="./assets/images/check-circle.svg" alt="" />
                  </span>
                  <p class="helmet-send-popup-title" id="helmet-send-popup-text-title">vuoi inviare la descrizione?</p>
                  <label class="helmet-send-popup-consent" for="helmet-send-popup-text-consent">
                    <input type="checkbox" class="helmet-send-popup-consent-input" id="helmet-send-popup-text-consent" />
                    <span class="helmet-send-popup-consent-copy">accetto e dichiaro di aver letto l'<a class="helmet-send-popup-privacy-link" href="#" data-legal-page="PR">informativa sulla privacy</a></span>
                  </label>
                  <div class="helmet-send-popup-actions">
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--cancel" id="helmet-send-popup-text-cancel" aria-label="Annulla invio descrizione">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/x.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--confirm" id="helmet-send-popup-text-confirm" aria-label="Conferma invio descrizione">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/circle.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </label>

            <div class="targets-divider" data-divider-label="AI allowed" aria-hidden="true">
              <div class="targets-divider-track"></div>
            </div>
            <label class="target-btn target-btn--input target-btn--upload" for="helmet-image">
              <span class="target-corner target-corner--tl"></span>
              <span class="target-corner target-corner--tr"></span>
              <span class="target-corner target-corner--bl"></span>
              <span class="target-corner target-corner--br"></span>
              <input
                class="helmet-upload-file"
                id="helmet-image"
                name="image"
                type="file"
                accept="${HELMET_UPLOAD_ALLOWED_EXTENSIONS.join(",")}"
              />
              <img class="helmet-upload-icon" src="./assets/images/upload.svg" alt="" aria-hidden="true" />
              <p class="helmet-upload-copy" data-typewriter-text="carica foto del casco che desideri">carica foto del casco che desideri</p>
              <img class="helmet-upload-preview is-hidden" id="helmet-image-preview" alt="Anteprima immagine casco caricata" />
              <button class="helmet-remove-btn helmet-remove-btn--image is-hidden" id="helmet-remove-image" type="button" aria-label="Elimina foto precedente">
                <img class="helmet-remove-icon" src="./assets/images/close_popup.svg" alt="" aria-hidden="true" />
              </button>
              <button class="helmet-send-btn helmet-send-btn--image" id="helmet-send-image" type="button" aria-label="Invia foto">
                <img class="helmet-send-icon" src="./assets/images/send-light.svg" alt="" aria-hidden="true" />
              </button>
              <div
                class="helmet-send-popup"
                id="helmet-send-popup-image"
                role="dialog"
                aria-modal="true"
                aria-labelledby="helmet-send-popup-image-title"
                aria-hidden="true"
              >
                <div class="helmet-send-popup-panel">
                  <span class="helmet-send-popup-mark helmet-send-popup-mark--ok" aria-hidden="true">
                    <img class="helmet-send-popup-check" src="./assets/images/check-circle.svg" alt="" />
                  </span>
                  <p class="helmet-send-popup-title" id="helmet-send-popup-image-title">vuoi inviare l'immagine?<br />potrebbe essere mostrata nel catalogo del sito</p>
                  <label class="helmet-send-popup-consent" for="helmet-send-popup-image-consent">
                    <input type="checkbox" class="helmet-send-popup-consent-input" id="helmet-send-popup-image-consent" />
                    <span class="helmet-send-popup-consent-copy">accetto e dichiaro di aver letto l'<a class="helmet-send-popup-privacy-link" href="#" data-legal-page="PR">informativa sulla privacy</a></span>
                  </label>
                  <div class="helmet-send-popup-actions">
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--cancel" id="helmet-send-popup-image-cancel" aria-label="Annulla invio immagine">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/x.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--confirm" id="helmet-send-popup-image-confirm" aria-label="Conferma invio immagine">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/circle.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                class="helmet-send-popup helmet-send-popup--danger"
                id="helmet-remove-popup-image"
                role="dialog"
                aria-modal="true"
                aria-labelledby="helmet-remove-popup-image-title"
                aria-hidden="true"
              >
                <div class="helmet-send-popup-panel">
                  <span class="helmet-send-popup-mark helmet-send-popup-mark--danger" aria-hidden="true">
                    <img class="helmet-send-popup-alert" src="./assets/images/alert-circle.svg" alt="" />
                  </span>
                  <p class="helmet-send-popup-title" id="helmet-remove-popup-image-title">vuoi eliminare l'immagine?</p>
                  <div class="helmet-send-popup-actions">
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--cancel" id="helmet-remove-popup-image-cancel" aria-label="Annulla eliminazione immagine">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/x.svg" alt="" aria-hidden="true" />
                    </button>
                    <button type="button" class="helmet-send-popup-choice helmet-send-popup-choice--confirm" id="helmet-remove-popup-image-confirm" aria-label="Conferma eliminazione immagine">
                      <img class="helmet-send-popup-choice-icon" src="./assets/images/circle.svg" alt="" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </label>

            <div class="targets-divider" data-divider-label="your help" aria-hidden="true">
              <div class="targets-divider-track"></div>
            </div>
            <a class="target-btn target-btn--input target-btn--download" href="./assets/images/base_casco_intesta.jpg" download="base_casco_intesta.jpg" target="_blank" rel="noopener noreferrer" aria-label="Scarica casco su cui disegnare">
              <span class="target-corner target-corner--tl"></span>
              <span class="target-corner target-corner--tr"></span>
              <span class="target-corner target-corner--bl"></span>
              <span class="target-corner target-corner--br"></span>
              <img class="helmet-download-bg" src="./assets/images/base_casco_intesta.png" alt="" aria-hidden="true" />
              <img class="helmet-download-icon" src="./assets/images/upload.svg" alt="" aria-hidden="true" />
              <p class="helmet-download-copy" data-typewriter-text="scarica casco&#10;su cui disegnare">scarica casco<br />su cui disegnare</p>
            </a>
          </div>
        </section>

        <div class="targets-divider" data-divider-label="catalogo" aria-hidden="true">
          <div class="targets-divider-track"></div>
        </div>

        <section class="targets-screen targets-screen--gallery">
          <section class="target-btn target-btn--gallery" aria-label="Mosaico contenuti casco">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <div class="helmet-tiles-grid" id="helmet-tiles-grid" aria-hidden="true"></div>
          </section>
        </section>
      </div>
    `;

    const profileTarget = targets.querySelector(".target-btn--profile");
    const helmetTarget = targets.querySelector(".target-btn--helmet");
    const targetsJumpButton = targets.querySelector("#targets-jump-btn");
    const targetsLower = targets.querySelector("#targets-lower");
    const targetsUpload = targets.querySelector("#targets-upload");
    const activateTargetsArea = () => {
      if (!hasTargetsScrolledDown) {
        hasTargetsScrolledDown = true;
        syncChatVisibility();
      }
    };
    const onTargetsScroll = () => {
      if (controlsEl.scrollTop > 10) {
        activateTargetsArea();
      }
      syncAiChatDocking();
    };
    controlsEl.onscroll = onTargetsScroll;
    window.setTimeout(onTargetsScroll, 40);

    if (targetsJumpButton instanceof HTMLButtonElement) {
      targetsJumpButton.addEventListener("click", () => {
        playNavDownSound();
        activateTargetsArea();
        const jumpTo = targetsLower instanceof HTMLElement
          ? targetsLower.offsetTop
          : controlsEl.clientHeight;
        controlsEl.scrollTo({
          top: jumpTo,
          behavior: "smooth"
        });
      });
    }

    if (profileTarget instanceof HTMLElement) {
      profileTarget.addEventListener("click", () => {
        activateTargetsArea();
        openProfilePopup("tomas");
      });
    }
    if (helmetTarget instanceof HTMLElement) {
      helmetTarget.addEventListener("click", () => {
        activateTargetsArea();
        openProfilePopup("casco");
      });
    }

    const descriptionEl = targets.querySelector("#helmet-description");
    const fileInputEl = targets.querySelector("#helmet-image");
    const imagePreviewEl = targets.querySelector("#helmet-image-preview");
    const sendTextEl = targets.querySelector("#helmet-send-text");
    const sendImageEl = targets.querySelector("#helmet-send-image");
    const sendPopupTextEl = targets.querySelector("#helmet-send-popup-text");
    const sendPopupTextConfirmEl = targets.querySelector("#helmet-send-popup-text-confirm");
    const sendPopupTextCancelEl = targets.querySelector("#helmet-send-popup-text-cancel");
    const sendPopupTextConsentEl = targets.querySelector("#helmet-send-popup-text-consent");
    const sendPopupImageEl = targets.querySelector("#helmet-send-popup-image");
    const sendPopupImageConfirmEl = targets.querySelector("#helmet-send-popup-image-confirm");
    const sendPopupImageCancelEl = targets.querySelector("#helmet-send-popup-image-cancel");
    const sendPopupImageConsentEl = targets.querySelector("#helmet-send-popup-image-consent");
    const sendPopupPrivacyLinks = targets.querySelectorAll(".helmet-send-popup-privacy-link");
    const removePopupImageEl = targets.querySelector("#helmet-remove-popup-image");
    const removePopupImageConfirmEl = targets.querySelector("#helmet-remove-popup-image-confirm");
    const removePopupImageCancelEl = targets.querySelector("#helmet-remove-popup-image-cancel");
    const removeImageEl = targets.querySelector("#helmet-remove-image");
    const baseHelmetDownloadEl = targets.querySelector(".target-btn--download");
    const descriptionBoxEl = targets.querySelector(".target-btn--description");
    const uploadBoxEl = targets.querySelector(".target-btn--upload");
    const sendImageIconEl = sendImageEl instanceof HTMLButtonElement
      ? sendImageEl.querySelector(".helmet-send-icon")
      : null;
    const galleryTilesGridEl = targets.querySelector("#helmet-tiles-grid");
    let previewUrl = "";
    let galleryTilesData = [{
      src: "./assets/images/alex.png",
      assetKey: "alex",
      likeCount: 0,
      likedByViewer: false,
      isAlex: true
    }];

    const animateSubmittedCorners = (targetEl) => {
      if (!(targetEl instanceof HTMLElement)) {
        return;
      }
      targetEl.classList.remove("is-corners-thick");
      window.requestAnimationFrame(() => {
        targetEl.classList.add("is-corners-thick");
      });
    };

    const syncImageSendIconVariant = (hasPreviewImage) => {
      if (!(sendImageIconEl instanceof HTMLImageElement)) {
        return;
      }
      sendImageIconEl.src = hasPreviewImage
        ? "./assets/images/send.svg"
        : "./assets/images/send-light.svg";
    };

    const syncGalleryTiles = () => {
      if (!(galleryTilesGridEl instanceof HTMLElement)) {
        return;
      }
      const cols = 4;
      const computed = window.getComputedStyle(galleryTilesGridEl);
      const gap = Number.parseFloat(computed.columnGap || computed.gap || "0") || 0;
      const gridWidth = galleryTilesGridEl.clientWidth;
      const gridHeight = galleryTilesGridEl.clientHeight;
      if (gridWidth <= 0 || gridHeight <= 0) {
        return;
      }
      const tileWidth = (gridWidth - (gap * (cols - 1))) / cols;
      if (tileWidth <= 0) {
        return;
      }
      const tileHeight = tileWidth * (14 / 9);
      const rows = Math.max(1, Math.floor((gridHeight + gap) / (tileHeight + gap)));
      const nextCount = rows * cols;
      const renderSignature = `${nextCount}:${galleryTilesData.map((item) => `${item.src}|${item.likeCount}|${item.likedByViewer ? 1 : 0}`).join("#")}`;
      if (galleryTilesGridEl.dataset.renderSignature === renderSignature) {
        return;
      }
      galleryTilesGridEl.dataset.renderSignature = renderSignature;
      galleryTilesGridEl.replaceChildren();
      const fragment = document.createDocumentFragment();
      let addTilePlaced = false;
      for (let index = 0; index < nextCount; index += 1) {
        const tileData = galleryTilesData[index] || null;
        if (!tileData || !tileData.src) {
          if (!addTilePlaced) {
            const addTile = document.createElement("button");
            addTile.className = "helmet-tile helmet-tile--add";
            addTile.type = "button";
            addTile.setAttribute("aria-label", "Aggiungi il tuo casco");
            addTile.innerHTML = '<span class="helmet-tile-plus" aria-hidden="true">+</span>';
            fragment.append(addTile);
            addTilePlaced = true;
          } else {
            const emptyTile = document.createElement("span");
            emptyTile.className = "helmet-tile";
            fragment.append(emptyTile);
          }
          continue;
        }
        const tileButton = document.createElement("button");
        tileButton.className = "helmet-tile helmet-tile--clickable";
        tileButton.type = "button";
        tileButton.dataset.gallerySrc = tileData.src;
        tileButton.dataset.galleryAssetKey = tileData.assetKey || "";
        tileButton.dataset.galleryLikeCount = String(Number.isFinite(tileData.likeCount) ? tileData.likeCount : 0);
        tileButton.dataset.galleryLiked = tileData.likedByViewer ? "1" : "0";
        if (tileData.isAlex) {
          tileButton.dataset.galleryAlex = "1";
        }
        tileButton.setAttribute("aria-label", "Apri anteprima immagine");
        const tileImage = document.createElement("img");
        tileImage.className = "helmet-tile-image";
        tileImage.src = tileData.src;
        tileImage.alt = "";
        tileImage.loading = "lazy";
        tileImage.decoding = "async";
        tileButton.append(tileImage);
        fragment.append(tileButton);
      }
      galleryTilesGridEl.append(fragment);
    };

    window.requestAnimationFrame(syncGalleryTiles);
    window.setTimeout(syncGalleryTiles, 90);
    if (galleryTilesGridEl instanceof HTMLElement && typeof ResizeObserver !== "undefined") {
      let galleryTilesObserver = null;
      galleryTilesObserver = new ResizeObserver(() => {
        if (!galleryTilesGridEl.isConnected) {
          if (galleryTilesObserver) {
            galleryTilesObserver.disconnect();
          }
          return;
        }
        syncGalleryTiles();
      });
      galleryTilesObserver.observe(galleryTilesGridEl);
    }
    if (galleryTilesGridEl instanceof HTMLElement) {
      galleryTilesGridEl.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const addTile = target ? target.closest(".helmet-tile--add") : null;
        if (addTile instanceof HTMLButtonElement) {
          activateTargetsArea();
          const uploadTop = targetsUpload instanceof HTMLElement
            ? targetsUpload.offsetTop
            : controlsEl.clientHeight;
          controlsEl.scrollTo({
            top: uploadTop,
            behavior: "smooth"
          });
          return;
        }
        const tileButton = target ? target.closest(".helmet-tile--clickable") : null;
        if (!(tileButton instanceof HTMLButtonElement)) {
          return;
        }
        const src = tileButton.dataset.gallerySrc || "";
        if (!src) {
          return;
        }
        const likeCount = Number.parseInt(tileButton.dataset.galleryLikeCount || "0", 10) || 0;
        const likedByViewer = tileButton.dataset.galleryLiked === "1";
        const assetKey = tileButton.dataset.galleryAssetKey || "";
        openGalleryPreview(src, tileButton.dataset.galleryAlex === "1", assetKey, likeCount, likedByViewer);
      });
    }
    void fetchApprovedGalleryImages().then((approvedItems) => {
      galleryTilesData = approvedItems;
      syncGalleryTiles();
    });

    const openHelmetSendPopup = (popupEl, focusEl) => {
      if (!(popupEl instanceof HTMLElement)) {
        return;
      }
      if (popupEl === sendPopupTextEl && sendPopupTextConsentEl instanceof HTMLInputElement) {
        sendPopupTextConsentEl.checked = false;
      }
      if (popupEl === sendPopupImageEl && sendPopupImageConsentEl instanceof HTMLInputElement) {
        sendPopupImageConsentEl.checked = false;
      }
      playHelmetActionSound();
      popupEl.setAttribute("aria-hidden", "false");
      window.requestAnimationFrame(() => {
        popupEl.classList.add("is-open");
        if (focusEl instanceof HTMLElement) {
          focusEl.focus();
        }
      });
    };

    const closeHelmetSendPopup = (popupEl, returnFocusEl) => {
      if (!(popupEl instanceof HTMLElement)) {
        return;
      }
      popupEl.classList.remove("is-open");
      popupEl.setAttribute("aria-hidden", "true");
      if (popupEl === sendPopupImageEl && sendPopupImageConsentEl instanceof HTMLInputElement) {
        sendPopupImageConsentEl.checked = false;
      }
      if (popupEl === sendPopupTextEl && sendPopupTextConsentEl instanceof HTMLInputElement) {
        sendPopupTextConsentEl.checked = false;
      }
      if (returnFocusEl instanceof HTMLElement) {
        returnFocusEl.focus();
      }
    };

    sendPopupPrivacyLinks.forEach((linkEl) => {
      if (!(linkEl instanceof HTMLAnchorElement)) {
        return;
      }
      linkEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const legalPage = String(linkEl.dataset.legalPage || "PR");
        openLegalPopup(legalPage || "PR");
      });
    });

    const applyLockedState = (contributionBundle) => {
      if (contributionBundle && typeof contributionBundle === "object") {
        const hasText = Object.prototype.hasOwnProperty.call(contributionBundle, "text");
        const hasImage = Object.prototype.hasOwnProperty.call(contributionBundle, "image");
        lockedContribution = {
          text: hasText ? contributionBundle.text : (lockedContribution ? lockedContribution.text : null),
          image: hasImage ? contributionBundle.image : (lockedContribution ? lockedContribution.image : null)
        };
      }
      const hasTextLock = Boolean(lockedContribution && lockedContribution.text);
      const hasImageLock = Boolean(lockedContribution && lockedContribution.image);
      isDeviceLocked = hasImageLock;

      if (descriptionEl instanceof HTMLTextAreaElement) {
        descriptionEl.disabled = false;
        descriptionEl.readOnly = false;
      }
      if (sendTextEl instanceof HTMLButtonElement) {
        sendTextEl.disabled = false;
        sendTextEl.classList.remove("is-hidden");
      }
      if (descriptionBoxEl instanceof HTMLElement) {
        descriptionBoxEl.classList.remove("is-text-locked");
        descriptionBoxEl.classList.toggle("is-corners-thick", Boolean(lockedContribution && lockedContribution.text));
      }
      if (lockedContribution && lockedContribution.text && descriptionEl instanceof HTMLTextAreaElement) {
        descriptionEl.value = lockedContribution.text.description || "";
      } else if (descriptionEl instanceof HTMLTextAreaElement) {
        descriptionEl.value = "";
      }

      if (fileInputEl instanceof HTMLInputElement) {
        fileInputEl.disabled = hasImageLock;
      }
      if (sendImageEl instanceof HTMLButtonElement) {
        sendImageEl.disabled = hasImageLock;
        sendImageEl.classList.toggle("is-hidden", hasImageLock);
      }
      if (removeImageEl instanceof HTMLButtonElement) {
        removeImageEl.disabled = !hasImageLock;
        removeImageEl.classList.toggle("is-hidden", !hasImageLock);
      }
      if (uploadBoxEl instanceof HTMLElement) {
        uploadBoxEl.classList.toggle("is-image-locked", hasImageLock);
        uploadBoxEl.classList.toggle("is-corners-thick", hasImageLock);
      }
      if (hasImageLock && imagePreviewEl instanceof HTMLImageElement) {
        const imageUrl = lockedContribution.image.previewUrl || buildContributionImageUrl(lockedContribution.image.imagePath || "");
        if (imageUrl) {
          imagePreviewEl.src = imageUrl;
          imagePreviewEl.classList.remove("is-hidden");
        }
        syncImageSendIconVariant(false);
      } else if (!hasImageLock && imagePreviewEl instanceof HTMLImageElement) {
        imagePreviewEl.src = "";
        imagePreviewEl.classList.add("is-hidden");
        if (fileInputEl instanceof HTMLInputElement) {
          fileInputEl.value = "";
        }
        syncImageSendIconVariant(false);
      }
    };

    const refreshPreview = () => {
      if (!(fileInputEl instanceof HTMLInputElement) || !(imagePreviewEl instanceof HTMLImageElement)) {
        return;
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      const file = fileInputEl.files && fileInputEl.files[0] ? fileInputEl.files[0] : null;
      if (!file) {
        imagePreviewEl.src = "";
        imagePreviewEl.classList.add("is-hidden");
        syncImageSendIconVariant(false);
        return;
      }
      const validationError = validateHelmetUploadFile(file);
      if (validationError) {
        fileInputEl.value = "";
        imagePreviewEl.src = "";
        imagePreviewEl.classList.add("is-hidden");
        showUploadToast(validationError, "error");
        syncImageSendIconVariant(false);
        return;
      }
      previewUrl = URL.createObjectURL(file);
      imagePreviewEl.addEventListener("load", playHelmetActionSound, { once: true });
      imagePreviewEl.src = previewUrl;
      imagePreviewEl.classList.remove("is-hidden");
      syncImageSendIconVariant(true);
    };

    if (fileInputEl instanceof HTMLInputElement) {
      fileInputEl.addEventListener("change", refreshPreview);
    }
    if (baseHelmetDownloadEl instanceof HTMLAnchorElement) {
      baseHelmetDownloadEl.addEventListener("click", () => {
        playHelmetActionSound();
      });
    }

    const performHelmetTextSubmit = async () => {
      if (!(descriptionEl instanceof HTMLTextAreaElement) || !(sendTextEl instanceof HTMLButtonElement)) {
        return;
      }
      const description = descriptionEl.value.trim();
      if (!description) {
        showUploadToast("Scrivi una descrizione prima di inviare.", "error");
        return;
      }
      if (!(sendPopupTextConsentEl instanceof HTMLInputElement) || !sendPopupTextConsentEl.checked) {
        showUploadToast("Devi accettare la privacy prima di inviare.", "error");
        return;
      }

      sendTextEl.disabled = true;
      descriptionEl.disabled = true;
      if (sendPopupTextConfirmEl instanceof HTMLButtonElement) {
        sendPopupTextConfirmEl.disabled = true;
      }

      try {
        const deviceCode = persistedDeviceCode || (await ensureDeviceCode());
        if (!deviceCode) {
          showUploadToast("Impossibile registrare il dispositivo. Riprova.", "error");
          return;
        }
        await submitHelmetContribution({
          deviceCode,
          description
        });
        applyLockedState({
          text: {
            description
          }
        });
        animateSubmittedCorners(descriptionBoxEl);
        showUploadToast("Descrizione inviata correttamente.", "success");
        if (sendPopupTextEl instanceof HTMLElement) {
          closeHelmetSendPopup(sendPopupTextEl, sendTextEl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invio non riuscito.";
        showUploadToast(message, "error");
      } finally {
        sendTextEl.disabled = false;
        descriptionEl.disabled = false;
        if (sendPopupTextConfirmEl instanceof HTMLButtonElement) {
          sendPopupTextConfirmEl.disabled = false;
        }
      }
    };

    if (sendTextEl instanceof HTMLButtonElement && descriptionEl instanceof HTMLTextAreaElement) {
      sendTextEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const description = descriptionEl.value.trim();
        if (!description) {
          showUploadToast("Scrivi una descrizione prima di inviare.", "error");
          return;
        }
        if (sendPopupTextEl instanceof HTMLElement) {
          openHelmetSendPopup(sendPopupTextEl, sendPopupTextConfirmEl);
        }
      });
    }

    if (sendPopupTextCancelEl instanceof HTMLButtonElement && sendPopupTextEl instanceof HTMLElement) {
      sendPopupTextCancelEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playChoiceSound("no");
        closeHelmetSendPopup(sendPopupTextEl, sendTextEl);
      });
    }

    if (sendPopupTextConfirmEl instanceof HTMLButtonElement) {
      sendPopupTextConfirmEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playChoiceSound("yes");
        void performHelmetTextSubmit();
      });
    }

    const performHelmetImageSubmit = async () => {
      if (
        !(sendImageEl instanceof HTMLButtonElement) ||
        !(fileInputEl instanceof HTMLInputElement) ||
        !(imagePreviewEl instanceof HTMLImageElement)
      ) {
        return;
      }
      if (lockedContribution && lockedContribution.image) {
        showUploadToast("Foto gia inviata da questo dispositivo.", "error");
        return;
      }
      const file = fileInputEl.files && fileInputEl.files[0] ? fileInputEl.files[0] : null;
      const fileError = validateHelmetUploadFile(file);
      if (!file) {
        showUploadToast("Seleziona una foto prima di inviare.", "error");
        return;
      }
      if (fileError) {
        showUploadToast(fileError, "error");
        return;
      }
      if (!(sendPopupImageConsentEl instanceof HTMLInputElement) || !sendPopupImageConsentEl.checked) {
        showUploadToast("Devi accettare la privacy prima di inviare.", "error");
        return;
      }

      sendImageEl.disabled = true;
      fileInputEl.disabled = true;
      if (sendPopupImageConfirmEl instanceof HTMLButtonElement) {
        sendPopupImageConfirmEl.disabled = true;
      }

      try {
        const deviceCode = persistedDeviceCode || (await ensureDeviceCode());
        if (!deviceCode) {
          showUploadToast("Impossibile registrare il dispositivo. Riprova.", "error");
          return;
        }
        await submitHelmetContribution({
          deviceCode,
          imageFile: file
        });
        applyLockedState({
          image: {
            imagePath: "",
            previewUrl: imagePreviewEl.src || ""
          }
        });
        animateSubmittedCorners(uploadBoxEl);
        showUploadToast("Foto inviata correttamente.", "success");
        if (sendPopupImageEl instanceof HTMLElement) {
          closeHelmetSendPopup(sendPopupImageEl, sendImageEl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invio non riuscito.";
        showUploadToast(message, "error");
      } finally {
        if (!(lockedContribution && lockedContribution.image)) {
          sendImageEl.disabled = false;
          fileInputEl.disabled = false;
        }
        if (sendPopupImageConfirmEl instanceof HTMLButtonElement) {
          sendPopupImageConfirmEl.disabled = false;
        }
      }
    };

    if (
      sendImageEl instanceof HTMLButtonElement &&
      fileInputEl instanceof HTMLInputElement &&
      imagePreviewEl instanceof HTMLImageElement
    ) {
      sendImageEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (lockedContribution && lockedContribution.image) {
          showUploadToast("Foto gia inviata da questo dispositivo.", "error");
          return;
        }
        const file = fileInputEl.files && fileInputEl.files[0] ? fileInputEl.files[0] : null;
        const fileError = validateHelmetUploadFile(file);
        if (!file) {
          showUploadToast("Seleziona una foto prima di inviare.", "error");
          return;
        }
        if (fileError) {
          showUploadToast(fileError, "error");
          return;
        }
        if (sendPopupImageEl instanceof HTMLElement) {
          openHelmetSendPopup(sendPopupImageEl, sendPopupImageConfirmEl);
        }
      });
    }

    if (sendPopupImageCancelEl instanceof HTMLButtonElement && sendPopupImageEl instanceof HTMLElement) {
      sendPopupImageCancelEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playChoiceSound("no");
        closeHelmetSendPopup(sendPopupImageEl, sendImageEl);
      });
    }

    if (sendPopupImageConfirmEl instanceof HTMLButtonElement) {
      sendPopupImageConfirmEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        playChoiceSound("yes");
        void performHelmetImageSubmit();
      });
    }

    const performHelmetImageDelete = async () => {
      if (!(removeImageEl instanceof HTMLButtonElement)) {
        return;
      }
      if (!(lockedContribution && lockedContribution.image)) {
        return;
      }
      removeImageEl.disabled = true;
      if (removePopupImageConfirmEl instanceof HTMLButtonElement) {
        removePopupImageConfirmEl.disabled = true;
      }
      try {
        const deviceCode = persistedDeviceCode || (await ensureDeviceCode());
        if (!deviceCode) {
          showUploadToast("Impossibile identificare il dispositivo.", "error");
          return;
        }
        await deleteDeviceSubmission(deviceCode, "image");
        applyLockedState({
          image: null
        });
        showUploadToast("Foto precedente eliminata.", "success");
        if (removePopupImageEl instanceof HTMLElement) {
          closeHelmetSendPopup(removePopupImageEl, removeImageEl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Eliminazione non riuscita.";
        showUploadToast(message, "error");
      } finally {
        removeImageEl.disabled = false;
        if (removePopupImageConfirmEl instanceof HTMLButtonElement) {
          removePopupImageConfirmEl.disabled = false;
        }
      }
    };

    if (removeImageEl instanceof HTMLButtonElement) {
      removeImageEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!(lockedContribution && lockedContribution.image)) {
          return;
        }
        if (removePopupImageEl instanceof HTMLElement) {
          openHelmetSendPopup(removePopupImageEl, removePopupImageConfirmEl);
        }
      });
    }

    if (removePopupImageCancelEl instanceof HTMLButtonElement && removePopupImageEl instanceof HTMLElement) {
      removePopupImageCancelEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeHelmetSendPopup(removePopupImageEl, removeImageEl);
      });
    }

    if (removePopupImageConfirmEl instanceof HTMLButtonElement) {
      removePopupImageConfirmEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void performHelmetImageDelete();
      });
    }

    if (lockedContribution) {
      applyLockedState(lockedContribution);
    }

    controlsEl.append(targets);
    buildAllTargetsDividers(targets);
    setupTargetsTypewriters(targets);
    targetsDividerResizeHandler = () => {
      buildAllTargetsDividers(targets);
    };
    window.addEventListener("resize", targetsDividerResizeHandler);
    if (legalDockEl) {
      const footerContact = document.createElement("div");
      footerContact.className = "targets-contact-row";
      footerContact.innerHTML = `
        <a href="tel:+393313809922">+39 3313809922</a>
        <a href="mailto:intesta2026@gmail.com">intesta2026@gmail.com</a>
      `;
      controlsEl.append(footerContact);

      legalDockEl.classList.add("is-inline-footer");
      legalLinkEls.forEach((linkEl) => {
        linkEl.textContent = linkEl.dataset.longLabel || linkEl.textContent || "";
      });
      controlsEl.append(legalDockEl);
    }
  }
}

function paint(index) {
  slideEls.forEach((slideEl, slideIndex) => {
    slideEl.classList.toggle("is-active", slideIndex === index);
  });

  updateQuestionTitleTyping(index);

  subtitleEl.textContent = slides[index].subtitle;
  subtitleEl.classList.toggle("is-hidden", !slides[index].subtitle);
  renderControls(slides[index].control);
  announcerEl.textContent = slides[index].subtitle
    ? `${slides[index].title}, ${slides[index].subtitle}`
    : slides[index].title;
  syncChatVisibility();
}

function clearQuestionTypingTimer() {
  if (questionTypingTimerId !== null) {
    window.clearTimeout(questionTypingTimerId);
    questionTypingTimerId = null;
  }
  stopQuestionTypewriterSound();
}

function updateQuestionTitleTyping(activeIndex) {
  questionTypingRunId += 1;
  clearQuestionTypingTimer();
  const activeRunId = questionTypingRunId;

  slideEls.forEach((slideEl, slideIndex) => {
    const titleEl = slideEl.querySelector(".slide-title");
    if (!(titleEl instanceof HTMLElement)) {
      return;
    }
    titleEl.classList.remove("is-typing");
    if (slideIndex !== activeIndex || slides[slideIndex].control !== "choice") {
      titleEl.textContent = slides[slideIndex].title || "";
    }
  });

  const activeSlide = slides[activeIndex];
  const activeTitleEl = slideEls[activeIndex]?.querySelector(".slide-title");
  if (!(activeTitleEl instanceof HTMLElement) || !activeSlide || activeSlide.control !== "choice") {
    return;
  }

  const fullTitle = String(activeSlide.title || "");
  activeTitleEl.textContent = "";
  activeTitleEl.classList.add("is-typing");

  if (!fullTitle) {
    activeTitleEl.classList.remove("is-typing");
    stopQuestionTypewriterSound();
    return;
  }

  let cursor = 0;
  const tick = () => {
    if (activeRunId !== questionTypingRunId) {
      return;
    }
    cursor += 1;
    activeTitleEl.textContent = fullTitle.slice(0, cursor);
    playQuestionTypewriterSound(fullTitle.charAt(cursor - 1));
    if (cursor >= fullTitle.length) {
      activeTitleEl.classList.remove("is-typing");
      questionTypingTimerId = null;
      stopQuestionTypewriterSound();
      return;
    }
    const lastChar = fullTitle.charAt(cursor - 1);
    const delay = /[?!.,:;]/.test(lastChar) ? QUESTION_TYPEWRITER_PUNCT_DELAY_MS : QUESTION_TYPEWRITER_DELAY_MS;
    questionTypingTimerId = window.setTimeout(tick, delay);
  };

  questionTypingTimerId = window.setTimeout(tick, QUESTION_TYPEWRITER_DELAY_MS);
}

function animateTransition() {
  if (isAnimating) {
    return;
  }

  isAnimating = true;
  app.classList.add("is-transitioning");

  window.setTimeout(() => {
    app.classList.remove("is-transitioning");
    isAnimating = false;
  }, 420);
}

function goTo(index) {
  const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
  if (safeIndex === current) {
    return;
  }

  const previous = current;
  if (safeIndex === TARGETS_SLIDE_INDEX && previous !== TARGETS_SLIDE_INDEX) {
    hasTargetsScrolledDown = false;
  }
  if (safeIndex !== TARGETS_SLIDE_INDEX) {
    hasTargetsScrolledDown = false;
  }
  current = safeIndex;
  if (current === TARGETS_SLIDE_INDEX) {
    storeReachedLastSlide();
  }
  animateTransition();
  paint(current);
}

function next() {
  if (!popupEl.hidden) {
    return;
  }

  if (current === 0) {
    goTo(getLandingDestinationIndex());
    return;
  }

  if (current < slides.length - 1) {
    goTo(current + 1);
  }
}

function onTouchStart(event) {
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function onTouchEnd(event) {
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }

  if (!popupEl.hidden) {
    return;
  }

  const touch = event.changedTouches[0];
  const diffX = touch.clientX - touchStartX;
  const diffY = touch.clientY - touchStartY;
  const minDistance = 32;
  const minDistanceFirstSlide = 22;

  if (current === 0) {
    if (diffY > -minDistanceFirstSlide) {
      return;
    }

    playNavDownSound();
    next();
    return;
  }

  if (slides[current].control === "choice") {
    if (Math.abs(diffX) < minDistance || Math.abs(diffX) < Math.abs(diffY)) {
      return;
    }

    if (diffX < 0) {
      handleChoice("no");
    } else {
      handleChoice("yes");
    }
    return;
  }

  if (Math.abs(diffX) < minDistance || Math.abs(diffX) < Math.abs(diffY)) {
    return;
  }

  if (diffX < 0) {
    next();
  }
}

function onWheel(event) {
  if (!popupEl.hidden) {
    return;
  }

  if (wheelLocked || slides[current].control === "choice") {
    return;
  }

  if (event.deltaY > 8) {
    wheelLocked = true;
    next();
    window.setTimeout(() => {
      wheelLocked = false;
    }, 350);
  }
}

document.addEventListener("keydown", (event) => {
  if (!popupEl.hidden) {
    if (event.key === "Escape") {
      closeProfilePopup();
    }
    return;
  }

  if (event.key === "ArrowRight") {
    if (slides[current].control === "choice") {
      handleChoice("yes");
    } else {
      next();
    }
  } else if (event.key === "ArrowLeft") {
    if (slides[current].control === "choice") {
      handleChoice("no");
    }
  }
});

popupCloseEl.addEventListener("click", () => {
  playPopupCloseSound();
  closeProfilePopup();
});
popupEl.addEventListener("click", (event) => {
  if (event.target === popupEl) {
    closeProfilePopup();
  }
});

chatLauncherEl.addEventListener("click", () => {
  if (isChatOpen) {
    playPopupCloseSound();
    closeChatPanel();
  } else {
    playAiPanelSound();
    openChatPanel();
  }
});

chatCloseEl.addEventListener("click", () => {
  playPopupCloseSound();
  closeChatPanel();
});

chatFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitChatMessage(chatInputEl.value);
});

void (async () => {
  const deviceCode = await ensureDeviceCode();
  if (!deviceCode) {
    return;
  }
  const contributions = await fetchDeviceSubmissionStatus(deviceCode);
  if (contributions) {
    lockedContribution = {
      text: contributions.text
        ? {
          description: contributions.text.description || ""
        }
        : null,
      image: contributions.image
        ? {
          imagePath: contributions.image.imagePath || "",
          previewUrl: buildContributionImageUrl(contributions.image.imagePath || "")
        }
        : null
    };
    isDeviceLocked = Boolean(lockedContribution.text && lockedContribution.image);
    if (slides[current].control === "targets") {
      paint(current);
    }
  }
})();

appendChatMessage(
  "assistant",
  "Ciao! Sono l'assistente AI di Intesta. Posso aiutarti su progetto, invio descrizione/foto casco, galleria, privacy e contatti, e anche con idee creative per il casco. Esempi: 'Dammi 5 concept casco street', 'Come invio la foto?', 'Che formato file posso caricare?', 'Cosa c'e nella privacy policy?'."
);

window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
window.addEventListener("wheel", onWheel, { passive: true });
window.addEventListener("resize", () => {
  syncAiChatDocking();
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    syncAiChatDocking();
  });
}

paint(current);
}
