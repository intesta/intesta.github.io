"use strict";

if (window.location.hash === "#/admin") {
  document.body.classList.add("admin-mode");

  const adminRoot = document.querySelector("#app");
  if (!adminRoot) {
    throw new Error("Missing #app container.");
  }

  const ADMIN_API_BASE = "https://foxly.it/intesta_api/public/admin";
  const adminState = {
    authenticated: false,
    loading: true,
    view: "review",
    pendingCount: 0,
    currentReview: null,
    submissions: [],
    submissionsLoaded: false,
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
    const requestOptions = {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {})
    };

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

  async function refreshCurrentReview() {
    const { response, payload } = await adminRequest("/review/next");
    if (response.ok && payload?.result === 1) {
      adminState.currentReview = payload.item || null;
      return;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
    }
  }

  async function refreshSubmissionsList() {
    const { response, payload } = await adminRequest("/submissions");
    if (response.ok && payload?.result === 1) {
      adminState.submissions = Array.isArray(payload.items) ? payload.items : [];
      adminState.submissionsLoaded = true;
      return;
    }
    if (response.status === 401) {
      adminState.authenticated = false;
    }
  }

  async function loadAdminData() {
    await refreshPendingCount();
    await refreshCurrentReview();
    if (adminState.view === "list") {
      await refreshSubmissionsList();
    }
  }

  function reviewItemsMarkup() {
    if (!adminState.currentReview || !Array.isArray(adminState.currentReview.items)) {
      return `<p class="admin-empty">Nessun dispositivo in attesa di approvazione.</p>`;
    }
    return adminState.currentReview.items.map((item) => {
      const description = item.description ? `<p class="admin-item-text">${escapeHtml(item.description)}</p>` : "";
      const image = item.imageUrl ? `<img class="admin-item-image" src="${escapeHtml(item.imageUrl)}" alt="Foto inviata dispositivo" loading="lazy" />` : "";
      return `
        <article class="admin-item-block">
          <p class="admin-item-type">${item.type === "image" ? "Foto" : "Descrizione"} • ${escapeHtml(item.status || "")}</p>
          ${description}
          ${image}
          <p class="admin-item-date">${escapeHtml(formatDateTime(item.createdAt))}</p>
        </article>
      `;
    }).join("");
  }

  function listMarkup() {
    if (!adminState.submissionsLoaded) {
      return `<p class="admin-empty">Tocca "Aggiorna elenco" per caricare tutti gli invii.</p>`;
    }
    if (adminState.submissions.length === 0) {
      return `<p class="admin-empty">Nessun invio trovato.</p>`;
    }
    return adminState.submissions.map((item) => {
      const statusClass = `admin-status admin-status--${escapeHtml(item.status || "pending")}`;
      const description = item.description ? `<p class="admin-list-text">${escapeHtml(item.description)}</p>` : "";
      const image = item.imageUrl ? `<img class="admin-list-image" src="${escapeHtml(item.imageUrl)}" alt="Foto inviata" loading="lazy" />` : "";
      return `
        <article class="admin-list-card">
          <div class="admin-list-head">
            <p class="admin-list-device">Dispositivo ${escapeHtml(item.deviceCode || "")}</p>
            <span class="${statusClass}">${escapeHtml(item.status || "-")}</span>
          </div>
          <p class="admin-list-meta">${item.type === "image" ? "Foto" : "Descrizione"} • ${escapeHtml(formatDateTime(item.createdAt))}</p>
          ${description}
          ${image}
        </article>
      `;
    }).join("");
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
          <h1 class="admin-title">Moderazione invii</h1>
          <p class="admin-pending">Dispositivi da approvare: <strong>${adminState.pendingCount}</strong></p>
          <div class="admin-actions">
            <button class="admin-btn ${adminState.view === "review" ? "admin-btn--primary" : "admin-btn--ghost"}" id="admin-view-review" type="button">Approva</button>
            <button class="admin-btn ${adminState.view === "list" ? "admin-btn--primary" : "admin-btn--ghost"}" id="admin-view-list" type="button">Tutti gli invii</button>
            <button class="admin-btn admin-btn--ghost" id="admin-logout" type="button">Logout</button>
          </div>
        </header>
        <main class="admin-main">
          ${adminState.view === "review"
            ? `
              <section class="admin-review-view">
                <p class="admin-hint">Swipe a sinistra per rifiutare, a destra per approvare.</p>
                <article class="admin-review-card" id="admin-review-card">
                  <p class="admin-review-device">Dispositivo: ${escapeHtml(adminState.currentReview?.deviceCode || "-")}</p>
                  ${reviewItemsMarkup()}
                </article>
                <div class="admin-decision-actions">
                  <button class="admin-btn admin-btn--danger" id="admin-reject" type="button" ${adminState.currentReview ? "" : "disabled"}>Rifiuta</button>
                  <button class="admin-btn admin-btn--success" id="admin-approve" type="button" ${adminState.currentReview ? "" : "disabled"}>Approva</button>
                </div>
              </section>
            `
            : `
              <section class="admin-list-view">
                <button class="admin-btn admin-btn--ghost" id="admin-refresh-list" type="button">Aggiorna elenco</button>
                <div class="admin-list-wrap">${listMarkup()}</div>
              </section>
            `}
        </main>
      </section>
    `;

    const reviewButton = document.querySelector("#admin-view-review");
    const listButton = document.querySelector("#admin-view-list");
    const logoutButton = document.querySelector("#admin-logout");
    const approveButton = document.querySelector("#admin-approve");
    const rejectButton = document.querySelector("#admin-reject");
    const refreshListButton = document.querySelector("#admin-refresh-list");

    if (reviewButton instanceof HTMLButtonElement) {
      reviewButton.addEventListener("click", async () => {
        adminState.view = "review";
        adminState.loading = true;
        renderAdmin();
        await refreshPendingCount();
        await refreshCurrentReview();
        adminState.loading = false;
        renderAdmin();
      });
    }
    if (listButton instanceof HTMLButtonElement) {
      listButton.addEventListener("click", async () => {
        adminState.view = "list";
        adminState.loading = true;
        renderAdmin();
        await refreshPendingCount();
        await refreshSubmissionsList();
        adminState.loading = false;
        renderAdmin();
      });
    }
    if (logoutButton instanceof HTMLButtonElement) {
      logoutButton.addEventListener("click", async () => {
        await adminRequest("/logout", { method: "POST" });
        adminState.authenticated = false;
        adminState.submissionsLoaded = false;
        adminState.currentReview = null;
        adminState.error = "";
        renderAdmin();
      });
    }

    async function submitDecision(action) {
      if (!adminState.currentReview || adminState.requestPending) {
        return;
      }
      adminState.requestPending = true;
      try {
        await adminRequest("/review/decision", {
          method: "POST",
          body: {
            deviceId: adminState.currentReview.deviceId,
            action
          }
        });
        await refreshPendingCount();
        await refreshCurrentReview();
        if (adminState.view === "list" && adminState.submissionsLoaded) {
          await refreshSubmissionsList();
        }
      } finally {
        adminState.requestPending = false;
        renderAdmin();
      }
    }

    if (approveButton instanceof HTMLButtonElement) {
      approveButton.addEventListener("click", () => {
        void submitDecision("approve");
      });
    }
    if (rejectButton instanceof HTMLButtonElement) {
      rejectButton.addEventListener("click", () => {
        void submitDecision("reject");
      });
    }
    if (refreshListButton instanceof HTMLButtonElement) {
      refreshListButton.addEventListener("click", async () => {
        adminState.loading = true;
        renderAdmin();
        await refreshSubmissionsList();
        adminState.loading = false;
        renderAdmin();
      });
    }

    const reviewCard = document.querySelector("#admin-review-card");
    if (reviewCard instanceof HTMLElement && adminState.currentReview) {
      let startX = 0;
      let active = false;
      let currentDelta = 0;

      const onPointerDown = (event) => {
        active = true;
        startX = event.clientX;
        currentDelta = 0;
        reviewCard.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        if (!active) {
          return;
        }
        currentDelta = event.clientX - startX;
        reviewCard.style.transform = `translateX(${currentDelta}px) rotate(${(currentDelta / 18).toFixed(2)}deg)`;
      };
      const onPointerUp = async (event) => {
        if (!active) {
          return;
        }
        active = false;
        reviewCard.releasePointerCapture(event.pointerId);
        const threshold = 110;
        if (currentDelta > threshold) {
          reviewCard.style.transform = "translateX(120vw) rotate(14deg)";
          await submitDecision("approve");
          return;
        }
        if (currentDelta < -threshold) {
          reviewCard.style.transform = "translateX(-120vw) rotate(-14deg)";
          await submitDecision("reject");
          return;
        }
        reviewCard.style.transform = "";
      };

      reviewCard.addEventListener("pointerdown", onPointerDown);
      reviewCard.addEventListener("pointermove", onPointerMove);
      reviewCard.addEventListener("pointerup", (event) => {
        void onPointerUp(event);
      });
      reviewCard.addEventListener("pointercancel", () => {
        active = false;
        reviewCard.style.transform = "";
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
  { title: "Neanche io.", subtitle: "chi sono?", control: "dot-next" },
  { title: "", subtitle: "", control: "targets" }
];
const HELMET_SLIDE_INDEX = 3;
const OUTRO_SLIDE_INDEX = 4;
const TARGETS_SLIDE_INDEX = 5;
const POPUP_ANIMATION_MS = 320;
const TARGETS_TRANSITION_MS = 560;
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
      <img class="icon-svg icon-svg--choice" src="./assets/images/x.svg" alt="" aria-hidden="true" />
    </button>
    <div class="profile-popup-body">
      <article class="profile-card" aria-label="Profilo di Tomas Berardi">
        <p class="profile-name">Tomas._.Berardi</p>
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
  <section class="ai-chat" id="ai-chat" aria-label="Chat assistente AI">
    <button class="ai-chat-launcher" id="ai-chat-launcher" type="button" aria-label="Apri chat assistente">
      <img class="icon-svg icon-svg--down" src="./assets/images/cerchio-e-punto.svg" alt="" aria-hidden="true" />
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

let current = 0;
let touchStartX = 0;
let touchStartY = 0;
let isAnimating = false;
let wheelLocked = false;
let isChoiceAnimating = false;
let choiceSweepRafId = null;
let hasHelmet = false;
let popupCloseTimer = null;
let currentPopupMode = "profile";
let targetsTransitionTimer = null;
let isChatOpen = false;
let isChatRequestPending = false;
let fetchedGeminiApiKey = "";
let typingIndicatorEl = null;
let persistedDeviceCode = "";
let isDeviceLocked = false;
let lockedContribution = null;
let toastTimerId = null;

const CHAT_SITE_CONTEXT = `
Sito: Intesta (presentazione mobile-first in italiano).
Autore/progetto: Tomas Berardi, studente ISIA (Design del prodotto e della comunicazione), progetto tesi sul tema dell'utilizzo del casco tra i giovani.
Obiettivo del sito: coinvolgere utenti giovani, presentare il progetto, invitare a interagire con i contenuti e a contattare il progetto.
Tono del sito: diretto, semplice, umano, contemporaneo, frasi brevi, senza tecnicismi inutili.
Contenuti principali: percorso a slide, sezioni profilo/casco, contatti, pagine legali (privacy e cookie).
Vincoli: niente divagazioni su temi non collegati al progetto/sito; niente invenzioni di dati, prezzi, policy o funzionalita non presenti.
`;

const popupContent = {
  tomas: `
    <p class="profile-name">Tomas._.Berardi</p>
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
  CK: { href: "./cookie.html", title: "Cookie tecnici" }
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
  const shouldShow = isLastSlide && popupEl.hidden;
  chatRootEl.classList.toggle("is-available", shouldShow);

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

  if (current === HELMET_SLIDE_INDEX) {
    hasHelmet = choice === "yes";
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

  if (controlType === "dot-next") {
    const button = document.createElement("button");
    button.className = "nav-btn nav-btn--dot";
    button.type = "button";
    button.setAttribute("aria-label", "Apri la slide successiva");
    button.innerHTML = `
      <img
        class="icon-svg icon-svg--down"
        src="./assets/images/cerchio-e-punto.svg"
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

  if (controlType === "targets") {
    const targets = document.createElement("div");
    targets.className = "target-grid";
    targets.innerHTML = `
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
            placeholder="descrivi il casco che desideri"
            aria-label="Descrizione casco"
          ></textarea>
          <button class="helmet-send-btn helmet-send-btn--text" id="helmet-send-text" type="button" aria-label="Invia descrizione">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 20L21 12L3 4L3 10L15 12L3 14L3 20Z"></path>
            </svg>
          </button>
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
          <p class="helmet-upload-meta">1 file • max ${formatBytes(HELMET_UPLOAD_MAX_BYTES)} • JPG/PNG/GIF/WEBP</p>
          <img class="helmet-upload-preview is-hidden" id="helmet-image-preview" alt="Anteprima immagine casco caricata" />
          <button class="helmet-send-btn helmet-send-btn--image" id="helmet-send-image" type="button" aria-label="Invia foto">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 20L21 12L3 4L3 10L15 12L3 14L3 20Z"></path>
            </svg>
          </button>
        </label>
      </div>
    `;

    const profileTarget = targets.querySelector(".target-btn--profile");
    const helmetTarget = targets.querySelector(".target-btn--helmet");
    if (profileTarget instanceof HTMLElement) {
      profileTarget.addEventListener("click", () => {
        openProfilePopup("tomas");
      });
    }
    if (helmetTarget instanceof HTMLElement) {
      helmetTarget.addEventListener("click", () => {
        openProfilePopup("casco");
      });
    }

    const descriptionEl = targets.querySelector("#helmet-description");
    const fileInputEl = targets.querySelector("#helmet-image");
    const imagePreviewEl = targets.querySelector("#helmet-image-preview");
    const sendTextEl = targets.querySelector("#helmet-send-text");
    const sendImageEl = targets.querySelector("#helmet-send-image");
    const descriptionBoxEl = targets.querySelector(".target-btn--description");
    const uploadBoxEl = targets.querySelector(".target-btn--upload");
    let previewUrl = "";

    const applyLockedState = (contributionBundle) => {
      if (contributionBundle && typeof contributionBundle === "object") {
        lockedContribution = {
          text: contributionBundle.text || (lockedContribution ? lockedContribution.text : null),
          image: contributionBundle.image || (lockedContribution ? lockedContribution.image : null)
        };
      }
      const hasTextLock = Boolean(lockedContribution && lockedContribution.text);
      const hasImageLock = Boolean(lockedContribution && lockedContribution.image);
      isDeviceLocked = hasTextLock && hasImageLock;

      if (descriptionEl instanceof HTMLTextAreaElement) {
        descriptionEl.disabled = hasTextLock;
        descriptionEl.readOnly = hasTextLock;
      }
      if (sendTextEl instanceof HTMLButtonElement) {
        sendTextEl.disabled = hasTextLock;
        sendTextEl.classList.toggle("is-hidden", hasTextLock);
      }
      if (descriptionBoxEl instanceof HTMLElement) {
        descriptionBoxEl.classList.toggle("is-text-locked", hasTextLock);
      }
      if (hasTextLock && descriptionEl instanceof HTMLTextAreaElement) {
        descriptionEl.value = lockedContribution.text.description || "";
      }

      if (fileInputEl instanceof HTMLInputElement) {
        fileInputEl.disabled = hasImageLock;
      }
      if (sendImageEl instanceof HTMLButtonElement) {
        sendImageEl.disabled = hasImageLock;
        sendImageEl.classList.toggle("is-hidden", hasImageLock);
      }
      if (uploadBoxEl instanceof HTMLElement) {
        uploadBoxEl.classList.toggle("is-image-locked", hasImageLock);
      }
      if (hasImageLock && imagePreviewEl instanceof HTMLImageElement) {
        const imageUrl = lockedContribution.image.previewUrl || buildContributionImageUrl(lockedContribution.image.imagePath || "");
        if (imageUrl) {
          imagePreviewEl.src = imageUrl;
          imagePreviewEl.classList.remove("is-hidden");
        }
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
        return;
      }
      const validationError = validateHelmetUploadFile(file);
      if (validationError) {
        fileInputEl.value = "";
        imagePreviewEl.src = "";
        imagePreviewEl.classList.add("is-hidden");
        showUploadToast(validationError, "error");
        return;
      }
      previewUrl = URL.createObjectURL(file);
      imagePreviewEl.src = previewUrl;
      imagePreviewEl.classList.remove("is-hidden");
    };

    if (fileInputEl instanceof HTMLInputElement) {
      fileInputEl.addEventListener("change", refreshPreview);
    }

    if (sendTextEl instanceof HTMLButtonElement && descriptionEl instanceof HTMLTextAreaElement) {
      sendTextEl.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (lockedContribution && lockedContribution.text) {
          showUploadToast("Descrizione gia inviata da questo dispositivo.", "error");
          return;
        }
        const description = descriptionEl.value.trim();
        if (!description) {
          showUploadToast("Scrivi una descrizione prima di inviare.", "error");
          return;
        }

        sendTextEl.disabled = true;
        descriptionEl.disabled = true;

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
            },
            image: null
          });
          showUploadToast("Descrizione inviata correttamente.", "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invio non riuscito.";
          showUploadToast(message, "error");
        } finally {
          if (!(lockedContribution && lockedContribution.text)) {
            sendTextEl.disabled = false;
            descriptionEl.disabled = false;
          }
        }
      });
    }

    if (
      sendImageEl instanceof HTMLButtonElement &&
      fileInputEl instanceof HTMLInputElement &&
      imagePreviewEl instanceof HTMLImageElement
    ) {
      sendImageEl.addEventListener("click", async (event) => {
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

        sendImageEl.disabled = true;
        fileInputEl.disabled = true;

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
            text: null,
            image: {
              imagePath: "",
              previewUrl: imagePreviewEl.src || ""
            }
          });
          showUploadToast("Foto inviata correttamente.", "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invio non riuscito.";
          showUploadToast(message, "error");
        } finally {
          if (!(lockedContribution && lockedContribution.image)) {
            sendImageEl.disabled = false;
            fileInputEl.disabled = false;
          }
        }
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
  const finalTitle = hasHelmet ? "Non sarà mai come questo" : "Neanche io.";
  const finalTitleEl = slideEls[OUTRO_SLIDE_INDEX]?.querySelector(".slide-title");
  if (finalTitleEl instanceof HTMLElement) {
    finalTitleEl.textContent = finalTitle;
  }

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
  current = safeIndex;
  animateTransition();
  paint(current);

  if (targetsTransitionTimer !== null) {
    window.clearTimeout(targetsTransitionTimer);
    targetsTransitionTimer = null;
  }
  app.classList.remove("is-dot-to-targets");

  if (previous === OUTRO_SLIDE_INDEX && safeIndex === TARGETS_SLIDE_INDEX) {
    app.classList.add("is-dot-to-targets");
    targetsTransitionTimer = window.setTimeout(() => {
      app.classList.remove("is-dot-to-targets");
      targetsTransitionTimer = null;
    }, TARGETS_TRANSITION_MS);
  }
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
