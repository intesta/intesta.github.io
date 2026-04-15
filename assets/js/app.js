"use strict";

const slides = [
  { title: "CIAO!", subtitle: "Ho una missione per te", control: "down" },
  { title: "Sei uno studente?", subtitle: "", control: "choice" },
  { title: "Hai una bici?", subtitle: "", control: "choice" },
  { title: "Utilizzi un casco?", subtitle: "", control: "choice" },
  { title: "Neanche io.", subtitle: "chi sono?", control: "dot" }
];

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
`;

const slidesContainer = app.querySelector(".slides");
const subtitleEl = app.querySelector("#slide-subtitle");
const announcerEl = app.querySelector("#slide-announcer");
const controlsEl = app.querySelector("#slide-controls");

if (!slidesContainer || !subtitleEl || !announcerEl || !controlsEl) {
  throw new Error("Slider markup not initialized.");
}

let current = 0;
let touchStartX = 0;
let touchStartY = 0;
let isAnimating = false;

const slideEls = slides.map(({ title }) => {
  const section = document.createElement("section");
  section.className = "slide";
  section.innerHTML = `<h1 class="slide-title">${title}</h1>`;
  slidesContainer.append(section);
  return section;
});

function renderControls(controlType) {
  controlsEl.innerHTML = "";

  if (controlType === "down") {
    const button = document.createElement("button");
    button.className = "nav-btn nav-btn--down";
    button.type = "button";
    button.setAttribute("aria-label", "Scorri alla slide successiva");
    button.innerHTML = `<i class="feather-arrow-down" aria-hidden="true"></i>`;
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
        <i class="feather-x-circle" aria-hidden="true"></i>
      </button>
      <button class="choice-btn choice-btn--yes" type="button" aria-label="Sì, continua">
        <i class="feather-check-circle" aria-hidden="true"></i>
      </button>
    `;

    choices.querySelectorAll(".choice-btn").forEach((button) => {
      button.addEventListener("click", () => {
        next();
      });
    });

    controlsEl.append(choices);
    return;
  }

  const button = document.createElement("button");
  button.className = "nav-btn nav-btn--dot";
  button.type = "button";
  button.setAttribute("aria-label", "Fine del percorso");
  button.innerHTML = `<span class="nav-btn-core"></span>`;
  controlsEl.append(button);
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

  current = safeIndex;
  animateTransition();
  paint(current);
}

function next() {
  if (current < slides.length - 1) {
    goTo(current + 1);
  }
}

function onTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function onTouchEnd(event) {
  const touch = event.changedTouches[0];
  const diffX = touch.clientX - touchStartX;
  const diffY = touch.clientY - touchStartY;
  const minDistance = 32;

  if (Math.abs(diffX) < minDistance || Math.abs(diffX) < Math.abs(diffY)) {
    return;
  }

  if (diffX < 0) {
    next();
  } else {
    goTo(current - 1);
  }

}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    next();
  } else if (event.key === "ArrowLeft") {
    goTo(current - 1);
  }
});

app.addEventListener("touchstart", onTouchStart, { passive: true });
app.addEventListener("touchend", onTouchEnd, { passive: true });

paint(current);
