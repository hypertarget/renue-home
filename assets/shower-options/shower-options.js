/* Presentation-only variant: retain all shared buyer values, gates, certificates and submit behavior. */
(function () {
  "use strict";
  var original = window.RENUE_VERTICALS && window.RENUE_VERTICALS.bathroom;
  if (!original) return;
  // An ad angle changes only the introduction. It never supplies a form answer.
  var angles = {
    general: {
      title: "Free Quotes for Your Tub or Shower Project | Renue Home",
      main: "Ready to replace", accent: "your tub or shower?",
      imageTag: "A new shower, planned around your space."
    },
    tub: {
      title: "Free Quotes for Tub-to-Shower Conversions | Renue Home",
      main: "Only use your tub", accent: "for showers?",
      imageTag: "Explore a tub-to-shower conversion.",
      planning: "Make room for the shower you want.",
      priorities: [
        ["A shower in place of your tub", "Discuss removing your existing tub and installing a shower that fits the space."],
        ["Finishes that fit your style", "Explore wall surfaces, fixtures and storage. Compare the care each material needs."],
        ["A quote for your actual project", "Ask the provider what is included, what needs to change and how long the work could take."]
      ]
    },
    shower: {
      title: "Free Quotes for Shower Replacement | Renue Home",
      main: "Ready to replace", accent: "your outdated shower?",
      imageTag: "A fresh look for the shower you use every day.",
      planning: "What would you change about your shower?",
      priorities: [
        ["A look that feels like your home", "Discuss wall finishes, glass, hardware and how the new shower fits the rest of your bathroom."],
        ["Materials and upkeep", "Compare surfaces and cleaning requirements before choosing a design."],
        ["Comfort and practical details", "Plan storage, fixtures, entry height and any seating around how you use the shower."]
      ]
    },
    remodel: {
      title: "Free Quotes for Bathroom Remodeling | Renue Home",
      main: "Ready to update", accent: "your whole bathroom?",
      imageTag: "Bring your bathroom plans together.",
      image: "full-bathroom.webp",
      imageAlt: "AI-generated bathroom design with a shower and coordinated vanity finishes",
      planning: "Bring your bathroom plans together.",
      priorities: [
        ["Decide what you want to change", "Tell the provider which parts of your bathroom need an update and what you would like to keep."],
        ["Coordinate the room", "Discuss the shower or tub, vanity, flooring and fixtures. Confirm which services are available for your project."],
        ["Understand the full scope", "Review the materials, installation work, timeline and price before deciding whether to move forward."]
      ]
    }
  };
  var requestedAngle = new URLSearchParams(window.location.search).get("angle");
  var angle = Object.prototype.hasOwnProperty.call(angles, requestedAngle) ? requestedAngle : "general";
  var intro = angles[angle];
  var variant = "shower_options_v2";
  // This deferred script runs before funnel.js. Queue the global parameter before
  // its GA4 config/page_view and initial quiz_step_1, without loading another tag.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("set", { page_variant: variant, page_angle: angle });
  var config = Object.assign({}, original);
  config.title = intro.title;
  config.headline = intro.main + " " + intro.accent;
  config.sub = "Request a free quote. A provider can call to discuss your project and price. No obligation to hire.";
  // The page supplies its own support content. Avoid downloading an unused shared gallery.
  config.gallery = [];
  config.seo = null;
  config.steps = original.steps.map(function (step) { return Object.assign({}, step); });
  var copy = {
    project: { q: "What project would you like quoted?", sub: "Choose the closest match to start." },
    zip: { q: "Where is your project?", sub: "Your ZIP code helps identify providers serving your area." },
    timeline: { q: "When are you hoping to start?", sub: "Choose the timing that best fits your plans." },
    owner: { q: "Do you own the home?", sub: "Our providers work with homeowners on their remodeling projects." },
    credit: { q: "How would you rate your credit?", sub: "This self-reported information helps providers review your request. Answering does not run a credit check." },
    name: { q: "Who is requesting the quote?", sub: "Add your name and email for a provider follow-up. Phone and project address come next." },
    contact: { q: "Where can a provider reach you?", sub: "Review the consent terms below, then send your project request." }
  };
  config.steps.forEach(function (step) {
    if (copy[step.id]) Object.assign(step, copy[step.id]);
  });
  window.RENUE_VERTICALS.bathroom = config;

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node && value) node.textContent = value;
  }
  setText("so-heading-main", intro.main);
  setText("so-heading-accent", intro.accent);
  setText("so-image-tag", intro.imageTag);
  setText("so-planning-title", intro.planning);
  if (intro.image) {
    var heroImage = document.querySelector(".so-hero-art > img");
    if (heroImage) {
      heroImage.src = "/assets/shower-options/" + intro.image;
      heroImage.alt = intro.imageAlt;
      heroImage.width = 640;
      heroImage.height = 360;
    }
  }
  if (intro.priorities) {
    Array.prototype.forEach.call(document.querySelectorAll("#so-priorities > div"), function (row, index) {
      var item = intro.priorities[index];
      if (!item) return;
      row.querySelector("dt").textContent = item[0];
      row.querySelector("dd").textContent = item[1];
    });
  }

  function enhance() {
    var app = document.getElementById("app");
    var card = document.getElementById("quizcard");
    var quiz = document.getElementById("quiz");
    if (!app || !card || !quiz) return;
    // Native gtag only: this is a diagnostic event, never a lead or an Ads conversion.
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_variant", { page_variant: variant, page_angle: angle, vertical: "bathroom" });
    }
    // Remove the shared marketing shell, leaving the original quiz DOM and listeners intact.
    Array.prototype.slice.call(app.children).forEach(function (section) {
      if (!section.classList.contains("hero")) section.remove();
    });
    var hiddenCopy = app.querySelector(".hcopy");
    if (hiddenCopy) hiddenCopy.remove();
    var previousStep = null;
    var imageChoices = [
      { image: "tub-to-shower.webp", detail: "Replace a tub with a shower" },
      { image: "shower-replacement.webp", detail: "New or replacement shower" },
      { image: "full-bathroom.webp", detail: "A more complete update" }
    ];
    var labels = { f_zip: "Project ZIP code", f_first: "First name", f_last: "Last name", f_email: "Email address", f_phone: "Phone number", f_addr: "Project street address" };
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function decorate() {
      observer.disconnect();
      var progress = card.querySelector(".pct");
      var step = progress ? Number((progress.textContent.match(/Step (\d+)/) || [])[1]) : null;
      var first = step === 1;
      card.classList.toggle("so-project-step", first);
      document.body.classList.toggle("so-after-start", !first);
      var chat = card.querySelector(".qrow");
      if (chat) chat.remove();
      var cues = card.querySelector(".trustcues");
      if (cues) cues.remove();
      if (first) {
        Array.prototype.forEach.call(card.querySelectorAll("[data-pick]"), function (button, index) {
          var choice = imageChoices[index];
          if (!choice || button.querySelector(".so-choice-image")) return;
          var image = document.createElement("img");
          image.className = "so-choice-image";
          image.src = "/assets/shower-options/" + choice.image;
          image.alt = "";
          image.width = 640;
          image.height = 360;
          image.decoding = "async";
          var detail = document.createElement("span");
          detail.className = "so-choice-detail";
          detail.textContent = choice.detail;
          button.appendChild(image);
          button.appendChild(detail);
        });
        if (!card.querySelector(".so-choice-note")) {
          var note = document.createElement("p");
          note.className = "so-choice-note";
          note.textContent = "Images are AI-generated inspiration. Services and availability vary.";
          card.appendChild(note);
        }
      }
      Array.prototype.forEach.call(card.querySelectorAll("input[id]"), function (input) {
        var text = labels[input.id];
        if (!text || card.querySelector('label[for="' + input.id + '"]')) return;
        var label = document.createElement("label");
        label.htmlFor = input.id;
        label.textContent = text;
        input.parentNode.insertBefore(label, input);
      });
      var heading = card.querySelector(".q");
      if (heading) {
        heading.setAttribute("role", "heading");
        heading.setAttribute("aria-level", "2");
        heading.setAttribute("tabindex", "-1");
      }
      var error = card.querySelector(".err");
      if (error) error.setAttribute("role", "alert");
      if (previousStep !== null && step !== previousStep) {
        window.requestAnimationFrame(function () {
          if (heading) heading.focus({ preventScroll: true });
          quiz.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
        });
      }
      previousStep = step;
      observer.observe(card, { childList: true });
    }
    // Shared renderStep replaces the card's direct children. No polling, submissions or extra analytics.
    var observer = new MutationObserver(decorate);
    decorate();
  }
  if (document.readyState === "complete") enhance();
  else document.addEventListener("DOMContentLoaded", enhance, { once: true });
})();
