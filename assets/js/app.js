"use strict";

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
const CHOICE_SWEEP_DOT_GROWTH_PX = 0.24;

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
  app.classList.remove("is-choice-sweep", "is-choice-sweep-right", "is-choice-sweep-left");
  app.style.removeProperty("--choice-sweep-progress");
  app.style.removeProperty("--choice-sweep-color");
  app.style.removeProperty("--choice-sweep-dot-radius");
}

function startChoiceDotSweep(choice) {
  clearChoiceDotSweep();
  const directionClass = choice === "yes" ? "is-choice-sweep-right" : "is-choice-sweep-left";
  const sweepColor = choice === "yes" ? "#39b86a" : "#e14a4a";
  const startAt = performance.now();
  const dotRadiusValue = window.getComputedStyle(document.documentElement).getPropertyValue("--dot-radius");
  const baseDotRadius = Number.parseFloat(dotRadiusValue) || 1.7;

  app.classList.add("is-choice-sweep", directionClass);
  app.style.setProperty("--choice-sweep-color", sweepColor);
  app.style.setProperty("--choice-sweep-progress", "0%");
  app.style.setProperty("--choice-sweep-dot-radius", `${baseDotRadius.toFixed(3)}px`);

  const animate = (now) => {
    const rawProgress = Math.min((now - startAt) / CHOICE_ANIMATION_MS, 1);
    const easedProgress = 1 - (1 - rawProgress) ** 3;
    const dotGrow = Math.sin(rawProgress * Math.PI) * CHOICE_SWEEP_DOT_GROWTH_PX;

    app.style.setProperty("--choice-sweep-progress", `${(easedProgress * 100).toFixed(2)}%`);
    app.style.setProperty("--choice-sweep-dot-radius", `${(baseDotRadius + dotGrow).toFixed(3)}px`);
    if (rawProgress < 1) {
      choiceSweepRafId = window.requestAnimationFrame(animate);
      return;
    }
    app.style.setProperty("--choice-sweep-dot-radius", `${baseDotRadius.toFixed(3)}px`);
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
      <div class="target-btn target-btn--empty" aria-hidden="true">
        <span class="target-corner target-corner--tl"></span>
        <span class="target-corner target-corner--tr"></span>
        <span class="target-corner target-corner--bl"></span>
        <span class="target-corner target-corner--br"></span>
      </div>
      <div class="target-btn target-btn--empty" aria-hidden="true">
        <span class="target-corner target-corner--tl"></span>
        <span class="target-corner target-corner--tr"></span>
        <span class="target-corner target-corner--bl"></span>
        <span class="target-corner target-corner--br"></span>
      </div>
      <div class="target-btn target-btn--wide target-btn--empty" aria-hidden="true">
        <span class="target-corner target-corner--tl"></span>
        <span class="target-corner target-corner--tr"></span>
        <span class="target-corner target-corner--bl"></span>
        <span class="target-corner target-corner--br"></span>
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

appendChatMessage(
  "assistant",
  "Ciao! Sono l'assistente AI di Intesta. Posso aiutarti con progetto, casco, popup e contenuti del sito."
);

window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
window.addEventListener("wheel", onWheel, { passive: true });

paint(current);
