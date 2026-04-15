"use strict";

const slides = [
  { title: "CIAO!", subtitle: "Ho una missione per te", control: "down" },
  { title: "Sei uno studente?", subtitle: "", control: "choice" },
  { title: "Hai una bici?", subtitle: "", control: "choice" },
  { title: "Utilizzi un casco?", subtitle: "", control: "choice" },
  { title: "Neanche io.", subtitle: "chi sono?", control: "dot" }
];
const HELMET_SLIDE_INDEX = 3;
const FINAL_SLIDE_INDEX = slides.length - 1;

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
let wheelLocked = false;
let isChoiceAnimating = false;
let hasHelmet = false;

const slideEls = slides.map(({ title }) => {
  const section = document.createElement("section");
  section.className = "slide";
  section.innerHTML = `<h1 class="slide-title">${title}</h1>`;
  slidesContainer.append(section);
  return section;
});

function setChoiceAnimationState(choice, enabled) {
  const noClass = "is-selecting-no";
  const yesClass = "is-selecting-yes";

  app.classList.remove(noClass, yesClass);
  if (enabled) {
    app.classList.add(choice === "no" ? noClass : yesClass);
  }
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
  button.classList.add("is-picked");

  window.setTimeout(() => {
    button.classList.remove("is-picked");
    setChoiceAnimationState(choice, false);
    isChoiceAnimating = false;
    onDone();
  }, 240);
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
  controlsEl.innerHTML = "";
  controlsEl.classList.toggle("is-choice", controlType === "choice");

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

  const button = document.createElement("button");
  button.className = "nav-btn nav-btn--dot";
  button.type = "button";
  button.setAttribute("aria-label", "Fine del percorso");
  button.innerHTML = `
    <img
      class="icon-svg icon-svg--down"
      src="./assets/images/cerchio-e-punto.svg"
      alt=""
      aria-hidden="true"
    />
  `;
  controlsEl.append(button);
}

function paint(index) {
  const finalTitle = hasHelmet ? "Non sarà mai come questo" : "Neanche io.";
  const finalTitleEl = slideEls[FINAL_SLIDE_INDEX]?.querySelector(".slide-title");
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
  const touch = event.changedTouches[0];
  const diffX = touch.clientX - touchStartX;
  const diffY = touch.clientY - touchStartY;
  const minDistance = 32;
  const minDistanceFirstSlide = 18;

  if (current === 0) {
    if (
      Math.abs(diffY) < minDistanceFirstSlide ||
      Math.abs(diffY) < Math.abs(diffX)
    ) {
      return;
    }

    // First slide accepts both vertical directions.
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
  if (current !== 0 || wheelLocked) {
    return;
  }

  if (Math.abs(event.deltaY) > 8) {
    wheelLocked = true;
    next();
    window.setTimeout(() => {
      wheelLocked = false;
    }, 350);
  }
}

document.addEventListener("keydown", (event) => {
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

window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchend", onTouchEnd, { passive: true });
window.addEventListener("wheel", onWheel, { passive: true });

paint(current);
