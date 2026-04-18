"use strict";

if (window.location.hash === "#/admin") {
  document.body.classList.add("admin-mode");

  const adminRoot = document.querySelector("#app");
  if (!adminRoot) {
    throw new Error("Missing #app container.");
  }

  const ADMIN_API_BASE = "https://foxly.it/intesta_api/admin";
  const adminState = {
    authenticated: false,
    loading: true,
    pendingCount: 0,
    groups: [],
    selectedDeviceId: null,
    requestPending: false,
    error: ""
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
    const response = await fetch(`${base}${path}`, requestOptions);
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
      return;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
    }
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
      return;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
    }
  }

  async function loadAdminData() {
    await refreshPendingCount();
    await refreshGroups();
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

    return `
      <section class="admin-modal" id="admin-modal" aria-modal="true" role="dialog" aria-label="Dettaglio invio">
        <div class="admin-modal-backdrop" data-admin-close-modal></div>
        <article class="admin-modal-card">
          <button class="admin-modal-close" type="button" data-admin-close-modal aria-label="Chiudi dettaglio">×</button>
          <h2 class="admin-modal-title">Dettaglio invio</h2>
          <p class="admin-list-meta">Stato attuale: <span class="admin-status admin-status--${escapeHtml(group.status || "pending")}">${escapeHtml(statusLabel(String(group.status || "pending")))}</span></p>
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
              renderAdmin();
              return;
            }
            adminState.authenticated = true;
            adminState.loading = true;
            renderAdmin();
            await loadAdminData();
            adminState.loading = false;
            renderAdmin();
          } catch (_error) {
            adminState.error = "Errore di rete.";
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
    const imageUploadForm = document.querySelector("#admin-image-upload-form");
    const imageUploadSubmit = document.querySelector("#admin-image-upload-submit");
    const imageUploadInput = document.querySelector("#admin-image-file");

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
        await adminRequest("/logout", { method: "POST" });
        adminState.authenticated = false;
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
        await loadAdminData();
        adminState.loading = false;
        renderAdmin();
      });
    }

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
          await adminRequest("/device-status", {
            method: "POST",
            body: {
              deviceId: adminState.selectedDeviceId,
              status: nextStatus
            }
          });
          await loadAdminData();
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
          await adminRequest("/device-image", {
            method: "POST",
            formData
          });
          await loadAdminData();
        } finally {
          adminState.requestPending = false;
          syncUploadButtonState();
          renderAdmin();
        }
      });
    }
  }

  void (async () => {
    try {
      const { response, payload } = await adminRequest("/session");
      adminState.authenticated = Boolean(response.ok && payload?.result === 1 && payload?.authenticated === 1);
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
  { title: "CIAO!", subtitle: "Ho una missione per te", control: "down" },
  { title: "Sei uno studente?", subtitle: "", control: "choice" },
  { title: "Hai una bici?", subtitle: "", control: "choice" },
  { title: "Utilizzi un casco?", subtitle: "", control: "choice" },
  { title: "", subtitle: "", control: "targets" }
];
const TARGETS_SLIDE_INDEX = 4;
const POPUP_ANIMATION_MS = 320;
const CHOICE_ANIMATION_MS = 340;
const CHOICE_SWEEP_BLUR_PX = 1.8;

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
        <p class="profile-name">&nbsp;&nbsp;Tomas._.Berardi</p>
        <div class="profile-photo-frame" aria-hidden="true">
          <span class="photo-corner photo-corner--tl"></span>
          <span class="photo-corner photo-corner--tr"></span>
          <span class="photo-corner photo-corner--bl"></span>
          <span class="photo-corner photo-corner--br"></span>
          <img class="profile-photo" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
        </div>
        <p class="profile-bio">
          Sono uno studente ISIA: università di Design del prodotto e della comunicazione.
          Vivo a Faenza ed ho 21 anni, Ho bisogno del tuo aiuto per il mio progetto di tesi
          che tratta il tema dell’utilizzo del casco tra noi giovani.
          Ho realizzato appositamente per voi un attività, se sei un creativo te la consiglio!
          puoi trovare l’invito all’interno del sito e per informazioni non esitare a contattarmi.
        </p>
        <p class="profile-contact">
          +39 331 380 99 22<br />
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
        <button class="gallery-like-btn" id="gallery-like-btn" type="button" aria-label="Metti mi piace alla foto">
          <svg class="gallery-like-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span class="gallery-like-count" id="gallery-like-count">0</span>
        </button>
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
          placeholder="Scrivi la tua domanda..."
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
const popupCloseEl = app.querySelector("#profile-popup-close");
const popupCardEl = app.querySelector(".profile-card");
const galleryPreviewEl = app.querySelector("#gallery-preview");
const galleryPreviewBackdropEl = app.querySelector("#gallery-preview-backdrop");
const galleryPreviewCloseEl = app.querySelector("#gallery-preview-close");
const galleryPreviewImageEl = app.querySelector("#gallery-preview-image");
const galleryPreviewCaptionEl = app.querySelector("#gallery-preview-caption");
const galleryLikeBtnEl = app.querySelector("#gallery-like-btn");
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
const GALLERY_PREVIEW_ANIMATION_MS = 220;
let currentGalleryPreviewSrc = "";
let currentGalleryPreviewAssetKey = "";
let currentGalleryLikeCount = 0;
let currentGalleryLikedByViewer = false;

function syncGalleryLikeUi() {
  if (!(galleryLikeBtnEl instanceof HTMLButtonElement) || !(galleryLikeCountEl instanceof HTMLElement)) {
    return;
  }
  galleryLikeCountEl.textContent = String(Math.max(0, currentGalleryLikeCount));
  galleryLikeBtnEl.classList.toggle("is-liked", currentGalleryLikedByViewer);
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
    galleryLikeBtnEl.disabled = !currentGalleryPreviewAssetKey;
  }
  syncGalleryLikeUi();
  galleryPreviewCaptionEl.hidden = !showAlexCaption;
  galleryPreviewCaptionEl.innerHTML = showAlexCaption ? "ALEX TIMONCINI <br> WEB DEVELOPER DI INTESTA" : "";
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
    if (!currentGalleryPreviewSrc || !currentGalleryPreviewAssetKey) {
      return;
    }
    const nextLiked = !currentGalleryLikedByViewer;
    galleryLikeBtnEl.disabled = true;
    try {
      const payload = await submitGalleryLike(currentGalleryPreviewAssetKey, nextLiked);
      currentGalleryLikedByViewer = Boolean(payload.likedByViewer);
      currentGalleryLikeCount = Number.isFinite(payload.likeCount) ? Math.max(0, Math.floor(payload.likeCount)) : currentGalleryLikeCount;
      syncGalleryLikeUi();
      const activeTileButtons = document.querySelectorAll(`.helmet-tile--clickable[data-gallery-asset-key="${currentGalleryPreviewAssetKey}"]`);
      activeTileButtons.forEach((buttonEl) => {
        if (buttonEl instanceof HTMLElement) {
          buttonEl.dataset.galleryLikeCount = String(currentGalleryLikeCount);
          buttonEl.dataset.galleryLiked = currentGalleryLikedByViewer ? "1" : "0";
        }
      });
    } catch (_error) {
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
Vincoli: niente divagazioni su temi non collegati al progetto/sito; niente invenzioni di dati, prezzi, policy o funzionalita non presenti.
`;

const popupContent = {
  tomas: `
    <p class="profile-name">&nbsp;&nbsp;Tomas._.Berardi</p>
    <div class="profile-photo-frame" aria-hidden="true">
      <span class="photo-corner photo-corner--tl"></span>
      <span class="photo-corner photo-corner--tr"></span>
      <span class="photo-corner photo-corner--bl"></span>
      <span class="photo-corner photo-corner--br"></span>
      <img class="profile-photo" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
    </div>
    <p class="profile-bio">
      Sono uno studente ISIA: università di Design del prodotto e della comunicazione.
      Vivo a Faenza ed ho 21 anni, Ho bisogno del tuo aiuto per il mio progetto di tesi
      che tratta il tema dell’utilizzo del casco tra noi giovani.
      Ho realizzato appositamente per voi un attività, se sei un creativo te la consiglio!
      puoi trovare l’invito all’interno del sito e per informazioni non esitare a contattarmi.
    </p>
    <p class="profile-contact">
      +39 331 380 99 22<br />
      <a href="mailto:intesta2026@gmail.com">intesta2026@gmail.com</a>
    </p>
  `,
  casco: `
    <p class="profile-name">Casco</p>
    <div class="profile-photo-frame" aria-hidden="true">
      <span class="photo-corner photo-corner--tl"></span>
      <span class="photo-corner photo-corner--tr"></span>
      <span class="photo-corner photo-corner--bl"></span>
      <span class="photo-corner photo-corner--br"></span>
      <img class="profile-photo profile-photo--helmet" src="./assets/images/casco.png" alt="Immagine casco" />
    </div>
    <p class="profile-bio">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
      incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
      exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    </p>
  `
};

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
  section.innerHTML = `<h1 class="slide-title">${slideData.title}</h1>`;
  slidesContainer.append(section);
  return section;
});

function appendChatMessage(role, text) {
  const msg = document.createElement("p");
  msg.className = `ai-chat-msg ai-chat-msg--${role}`;
  msg.textContent = text;
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
          likedByViewer: Boolean(item.likedByViewer)
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
    if (anchorEl && typeof anchorEl.scrollIntoView === "function") {
      anchorEl.scrollIntoView({ block: "end", behavior: "instant" });
    }
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
  const msg = document.createElement("p");
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
    msg = document.createElement("p");
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

  const fullText = text || "";
  for (let i = 0; i < fullText.length; i += 1) {
    msg.textContent += fullText[i];
    scrollAiChatToBottom(msg);
    await sleep(16);
  }

  msg.classList.remove("ai-chat-msg--typewriter");
  msg.classList.remove("ai-chat-msg--from-dots");
  msg.classList.remove("is-expanding");
  scrollAiChatToBottom(msg);
  return msg;
}

function setChatPendingState(pending) {
  isChatRequestPending = pending;
  chatInputEl.disabled = pending;
  chatSendEl.disabled = pending;
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
Prima di rispondere, usa sempre e solo il contesto del sito fornito.
Rispondi in italiano, in modo chiaro, breve e utile, con tono coerente al sito.
Non divagare: se la domanda e fuori tema, riporta gentilmente la conversazione su Intesta, progetto casco, contenuti del sito, contatti o aspetti legali del sito.
Non inventare informazioni mancanti. Se un dato non e disponibile, dichiaralo in modo trasparente.
Mantieni risposte compatte (massimo 3-4 frasi), concrete e orientate all'utente.
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
}

function openChatPanel() {
  isChatOpen = true;
  chatRootEl.classList.add("is-open");
  chatPanelEl.setAttribute("aria-hidden", "false");
  chatInputEl.focus();
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
}

function openProfilePopup(type) {
  if (popupCloseTimer !== null) {
    window.clearTimeout(popupCloseTimer);
    popupCloseTimer = null;
  }
  currentPopupMode = "profile";
  popupEl.classList.remove("is-legal-mode");
  popupCardEl.innerHTML = popupContent[type] || popupContent.tomas;
  popupEl.hidden = false;
  popupEl.classList.remove("is-closing");
  window.requestAnimationFrame(() => {
    popupEl.classList.add("is-open");
  });
  app.classList.add("is-popup-open");
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

  runChoiceAnimation(choice, () => {
    next();
  });
}

function renderControls(controlType) {
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
            <p class="targets-claim">Inventiamo un casco<br />da bici bellissimo!</p>
            <button class="targets-jump-btn" id="targets-jump-btn" type="button" aria-label="Scorri ai target profilo e casco">
              <img class="icon-svg icon-svg--down" src="./assets/images/chevrons-down.svg" alt="" aria-hidden="true" />
            </button>
          </section>
        </section>

        <section class="targets-screen targets-screen--pair" id="targets-lower">
          <button class="target-btn target-btn--profile" type="button" aria-label="Apri popup profilo">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <img class="target-image" src="./assets/images/tomas.png" alt="Ritratto di Tomas Berardi" />
          </button>
          <button class="target-btn target-btn--helmet" type="button" aria-label="Apri popup casco">
            <span class="target-corner target-corner--tl"></span>
            <span class="target-corner target-corner--tr"></span>
            <span class="target-corner target-corner--bl"></span>
            <span class="target-corner target-corner--br"></span>
            <img class="target-image target-image--helmet" src="./assets/images/casco.png" alt="Casco" />
          </button>
        </section>

        <section class="targets-screen targets-screen--pair" id="targets-upload">
          <div class="helmet-upload-form" id="helmet-upload-form">
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
                    <span class="helmet-send-popup-consent-copy">accetto e dichiaro di aver letto l'informativa sulla privacy</span>
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
              <p class="helmet-upload-copy">carica foto del casco che desideri</p>
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
                    <span class="helmet-send-popup-consent-copy">accetto e dichiaro di aver letto l'informativa sulla privacy</span>
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

            <a class="target-btn target-btn--input target-btn--download" href="./assets/images/base_casco_intesta.png" download="base_casco_intesta.png" aria-label="Scarica casco su cui disegnare">
              <span class="target-corner target-corner--tl"></span>
              <span class="target-corner target-corner--tr"></span>
              <span class="target-corner target-corner--bl"></span>
              <span class="target-corner target-corner--br"></span>
              <img class="helmet-download-bg" src="./assets/images/base_casco_intesta.png" alt="" aria-hidden="true" />
              <img class="helmet-download-icon" src="./assets/images/upload.svg" alt="" aria-hidden="true" />
              <p class="helmet-download-copy">scarica casco<br />su cui disegnare</p>
            </a>
          </div>
        </section>

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
    };
    controlsEl.onscroll = onTargetsScroll;
    window.setTimeout(onTargetsScroll, 40);

    if (targetsJumpButton instanceof HTMLButtonElement) {
      targetsJumpButton.addEventListener("click", () => {
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
    const removePopupImageEl = targets.querySelector("#helmet-remove-popup-image");
    const removePopupImageConfirmEl = targets.querySelector("#helmet-remove-popup-image-confirm");
    const removePopupImageCancelEl = targets.querySelector("#helmet-remove-popup-image-cancel");
    const removeImageEl = targets.querySelector("#helmet-remove-image");
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
      imagePreviewEl.src = previewUrl;
      imagePreviewEl.classList.remove("is-hidden");
      syncImageSendIconVariant(true);
    };

    if (fileInputEl instanceof HTMLInputElement) {
      fileInputEl.addEventListener("change", refreshPreview);
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
        closeHelmetSendPopup(sendPopupTextEl, sendTextEl);
      });
    }

    if (sendPopupTextConfirmEl instanceof HTMLButtonElement) {
      sendPopupTextConfirmEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
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
        closeHelmetSendPopup(sendPopupImageEl, sendImageEl);
      });
    }

    if (sendPopupImageConfirmEl instanceof HTMLButtonElement) {
      sendPopupImageConfirmEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
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
    if (legalDockEl) {
      const footerContact = document.createElement("div");
      footerContact.className = "targets-contact-row";
      footerContact.innerHTML = `
        <a href="tel:+393313809922">+39 331 380 99 22</a>
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

  subtitleEl.textContent = slides[index].subtitle;
  subtitleEl.classList.toggle("is-hidden", !slides[index].subtitle);
  renderControls(slides[index].control);
  announcerEl.textContent = slides[index].subtitle
    ? `${slides[index].title}, ${slides[index].subtitle}`
    : slides[index].title;
  syncChatVisibility();
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
  animateTransition();
  paint(current);
}

function next() {
  if (!popupEl.hidden) {
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
    if (Math.abs(diffY) < minDistanceFirstSlide) {
      return;
    }

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
  closeProfilePopup();
});
popupEl.addEventListener("click", (event) => {
  if (event.target === popupEl) {
    closeProfilePopup();
  }
});

chatLauncherEl.addEventListener("click", () => {
  if (isChatOpen) {
    closeChatPanel();
  } else {
    openChatPanel();
  }
});

chatCloseEl.addEventListener("click", () => {
  closeChatPanel();
});

chatFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isChatRequestPending) {
    return;
  }

  const userMessage = chatInputEl.value.trim();
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
  "Ciao! Sono l'assistente AI di Intesta. Posso aiutarti con progetto, casco, popup e contenuti del sito."
);

window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
window.addEventListener("wheel", onWheel, { passive: true });

paint(current);
}
