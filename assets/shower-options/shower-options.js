/* Presentation-only variant: retain all shared buyer values, gates, certificates and submit behavior. */
(function () {
  "use strict";
  var original = window.RENUE_VERTICALS && window.RENUE_VERTICALS.bathroom;
  if (!original) return;
  // This deferred script runs before funnel.js. Queue the global parameter before
  // its GA4 config/page_view and initial quiz_step_1, without loading another tag.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("set", { page_variant: "shower_options_v1" });
  var config = Object.assign({}, original);
  config.title = "Explore Shower & Bathroom Options | Renue Home";
  config.headline = "A better shower. A better everyday.";
  config.sub = "Tell us about your project to request a provider consultation. Free to request, with no obligation to hire.";
  // The page supplies its own support content. Avoid downloading an unused shared gallery.
  config.gallery = [];
  config.seo = null;
  config.steps = original.steps.map(function (step) { return Object.assign({}, step); });
  var copy = {
    project: { q: "What would you like to change?", sub: "Choose the project closest to what you have in mind." },
    zip: { q: "Where is your project?", sub: "Your ZIP code helps identify providers serving your area." },
    timeline: { q: "When are you hoping to start?", sub: "Choose the timing that best fits your plans." },
    owner: { q: "Do you own the home?", sub: "Our providers work with homeowners on their remodeling projects." },
    credit: { q: "How would you rate your credit?", sub: "This self-reported information helps providers review your request. Answering does not run a credit check." },
    name: { q: "Who is planning this project?", sub: "Add your name and email for a provider follow-up. Phone and project address come next." },
    contact: { q: "Where can a provider reach you?", sub: "Review the consent terms below, then send your project request." }
  };
  config.steps.forEach(function (step) {
    if (copy[step.id]) Object.assign(step, copy[step.id]);
  });
  window.RENUE_VERTICALS.bathroom = config;

  function enhance() {
    var app = document.getElementById("app");
    var card = document.getElementById("quizcard");
    var quiz = document.getElementById("quiz");
    if (!app || !card || !quiz) return;
    // Native gtag only: this is a diagnostic event, never a lead or an Ads conversion.
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_variant", { page_variant: "shower_options_v1", vertical: "bathroom" });
    }
    // Remove the shared marketing shell, leaving the original quiz DOM and listeners intact.
    Array.prototype.slice.call(app.children).forEach(function (section) {
      if (!section.classList.contains("hero")) section.remove();
    });
    var hiddenCopy = app.querySelector(".hcopy");
    if (hiddenCopy) hiddenCopy.remove();
    var previousStep = null;
    var imageChoices = [
      { image: "tub-to-shower.webp", detail: "Replace an unused tub" },
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
