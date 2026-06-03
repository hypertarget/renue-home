/* Renue Home — shared engine: header/footer/sticky injection + config-driven quiz. */
(function(){
  "use strict";

  /* ===== Config (edit when live services are ready) ===== */
  var PHONE_NUMBER = window.RENUE_PHONE || "";              // e.g. "(844) 555-0199" (Ringba/Retreaver). Empty = placeholder UI.
  var NON_CONSENT_PHONE = window.RENUE_NONCONSENT_PHONE || ""; // line for info without consenting to automated calls.
  var SUBMIT_ENDPOINT = "/api/submit";
  var BUYER_CAP = 4;
  // TrustedForm: on by default (set window.RENUE_TRUSTEDFORM=false to disable). Captures a
  // tamper-proof consent certificate URL that materially raises lead value + TCPA defensibility.
  var TRUSTEDFORM = (window.RENUE_TRUSTEDFORM !== false);
  var RF = { active:false, idx:0, data:{}, cfg:null }; // quiz state for browser-back support

  function injectTrustedForm(){
    if(!TRUSTEDFORM || window.__rf_tf) return; window.__rf_tf = true;
    try{
      var tf = document.createElement("script");
      tf.async = true;
      tf.src = (("https:"===document.location.protocol)?"https":"http") +
        "://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&ping_field=xxTrustedFormPingUrl&l=" +
        (new Date().getTime()) + Math.random();
      var s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(tf, s);
    }catch(e){}
  }

  var telHref = function(n){ return "tel:+1" + (n||"").replace(/\D/g,""); };

  var LOGO = '<svg viewBox="0 0 64 64" fill="none" aria-label="Renue Home"><defs><linearGradient id="rg" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#14B8A6"/><stop offset="1" stop-color="#7ED957"/></linearGradient></defs><path d="M11 28.5 L32 9 L53 28.5" stroke="url(#rg)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 27 V51 a3 3 0 0 0 3 3 H46 a3 3 0 0 0 3-3 V27" stroke="url(#rg)" stroke-width="4.5" stroke-linejoin="round"/><path d="M25 49 V31 H35 a6 6 0 0 1 0 12 H27 M34 43 L41 50" stroke="url(#rg)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var CK = '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="#14B8A6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6z"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="#14B8A6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" fill="#14B8A6" stroke="none"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  // Friendly concierge avatar (brand gradient) for the conversational quiz framing.
  var AVATAR = '<span class="qavatar"><svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="av" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse"><stop stop-color="#14B8A6"/><stop offset="1" stop-color="#7ED957"/></linearGradient></defs><circle cx="24" cy="24" r="24" fill="url(#av)"/><circle cx="24" cy="19" r="7" fill="#fff"/><path d="M11 40c1.5-7 6.8-11 13-11s11.5 4 13 11" fill="#fff"/></svg><span class="qonline"></span></span>';

  var NAV = [["Bathroom","/bathroom"],["Windows","/windows"],["Roofing","/roofing"],["HVAC","/hvac"],["Kitchen","/kitchen"]];

  /* Conversational helper line shown under each question (per-step override wins). */
  function helperFor(step, idx, total){
    if(step.helper) return step.helper;
    if(step.type==="zip" || step.type==="address") return "We use this only to match you with pros near you — never shared publicly.";
    if(step.type==="contact") return "Last step! Where should we send your free quotes? Your info is kept private.";
    if(idx===0) return "Hi! I’ll help you get matched in about 60 seconds — no obligation. Let’s start:";
    if(idx>=total-2) return "Almost there — just a couple more quick questions.";
    if(step.type==="multi") return "Pick anything that applies, or skip. There are no wrong answers.";
    return "Great — thanks! Next quick question:";
  }

  function phoneCTA(cls){
    if(PHONE_NUMBER) return '<a class="'+cls+'" href="'+telHref(PHONE_NUMBER)+'"><small>CALL NOW</small>'+PHONE_NUMBER+'</a>';
    return '<span class="'+cls+'" style="opacity:.55" title="Phone number coming soon"><small>CALL NOW</small>(XXX) XXX-XXXX</span>';
  }

  /* ===== Header ===== */
  function header(){
    var h=document.createElement("header"); h.className="site";
    var ctaHref = (window.RENUE_PAGE==="vertical") ? "#quiz" : "/#projects";
    var ctaTxt = (window.RENUE_PAGE==="vertical") ? "Get Free Quote" : "Start My Home Project";
    h.innerHTML='<div class="wrap bar"><a class="logo" href="/">'+LOGO+'<span class="word"><span class="r">RENUE</span><span class="h">H O M E</span></span></a>'+
      '<nav>'+NAV.map(function(n){return '<a class="navlink" href="'+n[1]+'">'+n[0]+'</a>';}).join('')+
      phoneCTA("phone")+
      '<a class="btn btn-grad" style="padding:11px 18px;font-size:14px" href="'+ctaHref+'">'+ctaTxt+'</a></nav></div>';
    return h;
  }

  /* ===== Footer ===== */
  function footer(){
    var f=document.createElement("footer"); f.className="site";
    var nonconsent = NON_CONSENT_PHONE
      ? 'To request information without consenting to automated calls or texts, call '+NON_CONSENT_PHONE+'.'
      : 'To request information without consenting to automated calls or texts, call (XXX) XXX-XXXX.';
    f.innerHTML='<div class="wrap"><div class="ftop">'+
      '<div class="fbrand">'+LOGO+'<span><span class="r">RENUE</span> <span class="h">HOME</span></span></div>'+
      '<nav><a href="/locations">Service Areas</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a><a href="/ccpa">CCPA</a><a href="/partners">Marketing Partners</a><a href="/do-not-sell">Do Not Sell or Share My Personal Information</a></nav>'+
      '</div>'+
      '<p class="disc">Renue Home is an advertising marketplace and matching service for homeowners seeking home improvement services. Renue Home is not a provider, manufacturer, installer, or contractor. Information submitted may be shared with independent home improvement professionals or companies in your area. Renue Home does not endorse, warrant, or guarantee the services or products of any individual company. '+nonconsent+'</p>'+
      '<div class="copy">&copy; '+new Date().getFullYear()+' Renue Home &middot; Fresh Starts. Better Homes. &middot; <span class="dom">RENUEHOME.COM</span></div>'+
      '</div>';
    return f;
  }

  /* ===== Sticky mobile CTA ===== */
  function sticky(){
    var s=document.createElement("div"); s.className="sticky";
    var qHref = (window.RENUE_PAGE==="vertical") ? "#quiz" : "/#projects";
    var qTxt = (window.RENUE_PAGE==="vertical") ? "Get Free Quote" : "Start My Project";
    var call = PHONE_NUMBER ? '<a class="btn btn-call" href="'+telHref(PHONE_NUMBER)+'">Call Now</a>'
                            : '<a class="btn btn-call" href="'+qHref+'">Call Now</a>';
    s.innerHTML=call+'<a class="btn btn-grad" href="'+qHref+'">'+qTxt+'</a>';
    return s;
  }

  /* ===== Quiz engine (vertical pages) ===== */
  function buildVertical(){
    var cfg = (window.RENUE_VERTICALS||{})[window.RENUE_VERTICAL];
    var app = document.getElementById("app");
    if(!cfg || !app) return;
    var city = window.RENUE_CITY || null; // {name:"Austin, TX", metro:"Austin", state:"TX"}

    var headline = cfg.headline, sub = cfg.sub, title = cfg.title;
    var eyebrow = SHIELD+' Trusted • Local • Renue';
    if(city){
      headline = cfg.name+' Pros in '+city.metro+', '+city.state;
      sub = 'Compare free, no-obligation '+cfg.word+' quotes from vetted '+city.metro+'-area professionals. Takes under a minute.';
      title = cfg.name+' Quotes in '+city.metro+', '+city.state+' — Renue Home';
      eyebrow = SHIELD+' Serving '+city.metro+' & nearby areas';
    }
    document.title = title || ("Renue Home — "+cfg.name);

    app.innerHTML =
      '<section class="hero"><div class="wrap hero-grid">'+
        '<div><span class="eyebrow">'+eyebrow+'</span>'+
          '<h1 class="head">'+headline+'</h1>'+
          '<p class="lead">'+sub+'</p>'+
          '<div class="trustline">'+
            '<span>'+CK+' Free, no-obligation quotes</span>'+
            '<span>'+CK+' Local professionals</span>'+
            '<span>'+CK+' Takes under 60 seconds</span></div></div>'+
        '<div id="quiz"><div class="card" id="quizcard"></div></div>'+
      '</div></section>'+
      supportHtml(cfg, city);

    RF.active = true; RF.cfg = cfg;
    injectTrustedForm();
    try{ history.replaceState({rf:0}, ""); }catch(e){}
    renderStep(cfg, 0, {});
    var qc = document.getElementById("quiz");
    if(qc) qc.addEventListener("focusin", function(){ document.body.classList.add("quiz-engaged"); });
    wireFaq();
  }

  function supportHtml(cfg, city){
    var area = city ? (city.metro+', '+city.state) : "your area";
    var faqs = (cfg.faqs||[]).map(function(f){
      return '<details><summary>'+f.q+'</summary><div class="a">'+f.a+'</div></details>';
    }).join('');
    var benefits = (cfg.benefits||["Free, no-obligation quotes","Vetted local professionals","Fast matching","Compare multiple options","Simple, transparent process","Multiple project types"]).map(function(b){
      return '<div class="benefit">'+CK+'<span>'+b+'</span></div>';
    }).join('');
    return '<section><div class="wrap center"><div class="seclabel">How it works</div>'+
        '<h2 class="sec-h">Three simple steps</h2>'+
        '<div class="steps" style="margin-top:24px">'+
          '<div class="step"><div class="num">1</div><h3>Tell us about your project</h3><p>Answer a few quick questions about your '+cfg.word+' project.</p></div>'+
          '<div class="step"><div class="num">2</div><h3>Get matched with local pros</h3><p>We connect you with vetted professionals serving '+area+'.</p></div>'+
          '<div class="step"><div class="num">3</div><h3>Compare &amp; choose</h3><p>Review your options and pick what works for you. No obligation.</p></div>'+
        '</div></div></section>'+
      seoHtml(cfg, city)+
      galleryHtml(cfg)+
      '<section style="background:var(--soft)"><div class="wrap center"><div class="seclabel">Why compare with Renue Home</div>'+
        '<h2 class="sec-h">'+cfg.benefitsHead+'</h2><div class="benefits" style="margin-top:22px">'+benefits+'</div></div></section>'+
      '<section><div class="wrap"><div class="center"><div class="seclabel">Questions</div><h2 class="sec-h">'+cfg.name+(city?' FAQs in '+city.metro:' FAQs')+'</h2></div>'+
        '<div class="faq" style="margin-top:24px">'+faqs+'</div></div></section>'+
      '<section class="band cta-band"><div class="wrap"><h2 class="sec-h">Ready to compare your '+cfg.word+' options'+(city?' in '+city.metro:'')+'?</h2>'+
        '<p class="sec-sub">Free, no-obligation, and takes under a minute.</p>'+
        '<a class="btn btn-grad btn-lg" href="#quiz">Get My Free Quote</a></div></section>';
  }

  /* SEO content block: intro + cost factors + options/types. Drawn from cfg.seo. */
  function seoHtml(cfg, city){
    var seo = cfg.seo; if(!seo) return "";
    var area = city ? (city.metro+', '+city.state) : "your area";
    var lead = (seo.lead||[]).map(function(p){
      return '<p>'+p.replace(/\{area\}/g, area).replace(/\{metro\}/g, city?city.metro:"your area")+'</p>';
    }).join('');
    var factors = (seo.factors||[]).map(function(f){
      return '<div class="factor"><h3>'+f.h+'</h3><p>'+f.p+'</p></div>';
    }).join('');
    var typesList = (seo.types||[]).map(function(t){
      return '<div class="ptype">'+CK+'<div><strong>'+t.h+'</strong><span>'+t.p+'</span></div></div>';
    }).join('');
    var heading = city ? (cfg.name+' in '+city.metro+', '+city.state) : seo.heading;
    return '<section><div class="wrap seo-wrap">'+
        '<div class="seclabel">'+(seo.label||'Project guide')+'</div>'+
        '<h2 class="sec-h">'+heading+'</h2>'+
        '<div class="seo-body">'+lead+'</div>'+
        (factors?'<h3 class="seo-sub">What affects the cost</h3><div class="factors">'+factors+'</div>':'')+
        (typesList?'<h3 class="seo-sub">Popular options</h3><div class="ptypes">'+typesList+'</div>':'')+
        '<p class="seo-cta"><a class="btn btn-grad" href="#quiz">See your '+cfg.word+' options &rsaquo;</a></p>'+
      '</div></section>';
  }

  /* Project gallery: styled, captioned tiles. Real photos drop into /assets/<vertical>/N.jpg;
     until then a tasteful labelled placeholder renders (no broken images, nothing fake-claimed). */
  function galleryHtml(cfg){
    var g = cfg.gallery; if(!g || !g.length) return "";
    var v = window.RENUE_VERTICAL;
    var tiles = g.map(function(cap, i){
      var src = "/assets/"+v+"/"+(i+1)+".jpg";
      return '<figure class="gtile g'+((i%5)+1)+'">'+
        '<img src="'+src+'" alt="'+esc(cap)+'" loading="lazy" '+
          'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'noimg\')">'+
        '<figcaption>'+cap+'</figcaption></figure>';
    }).join('');
    return '<section style="background:var(--soft)"><div class="wrap"><div class="center">'+
        '<div class="seclabel">Project inspiration</div>'+
        '<h2 class="sec-h">'+cfg.name+' projects &amp; ideas</h2></div>'+
        '<div class="gallery">'+tiles+'</div>'+
        '<p class="gnote center">Examples of the kinds of '+cfg.word+' projects local pros in our network take on.</p>'+
      '</div></section>';
  }

  function renderStep(cfg, idx, data){
    var steps = cfg.steps;
    var card = document.getElementById("quizcard");
    if(!card) return;
    RF.idx = idx; RF.data = data; RF.cfg = cfg;
    var total = steps.length;
    var pctNum = Math.round((idx/total)*100);
    var step = steps[idx];
    var h = '<div class="progress"><div class="ptrack"><div class="pfill" style="width:'+pctNum+'%"></div></div><div class="pct">Step '+(idx+1)+' of '+total+'</div></div>';
    if(idx>0) h += '<button class="back" type="button" data-back="1">&lsaquo; Back</button>';
    h += '<div class="qrow">'+AVATAR+'<div class="qbubble">'+helperFor(step, idx, total)+'</div></div>';
    h += '<div class="q">'+step.q+'</div>'+(step.sub?'<p class="qsub">'+step.sub+'</p>':'');

    if(step.type==="zip"){
      h+='<div class="field"><input id="f_zip" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="ZIP Code" value="'+(data.zip||'')+'"></div>'+
         '<button class="btn btn-grad btn-lg" type="button" data-zip="1">Continue &rsaquo;</button>';
    } else if(step.type==="single"){
      h+='<div class="opts">'+step.options.map(function(o,i){return '<button class="opt" type="button" data-pick="'+i+'"><span>'+o+'</span><span class="dot"></span></button>';}).join('')+'</div>';
    } else if(step.type==="multi"){
      h+='<div class="opts" id="multi">'+step.options.map(function(o,i){return '<button class="opt" type="button" data-multi="'+i+'"><span>'+o+'</span><span class="dot"></span></button>';}).join('')+'</div>'+
         '<button class="btn btn-grad btn-lg" style="margin-top:12px" type="button" data-multinext="1">Continue &rsaquo;</button>';
    } else if(step.type==="address"){
      h+='<div class="field"><input id="f_addr" placeholder="Street address" value="'+(data.address||'')+'"></div>'+
         '<button class="btn btn-grad btn-lg" type="button" data-addr="1">Continue &rsaquo;</button>';
    } else if(step.type==="contact"){
      h+='<div class="two"><div class="field"><input id="f_first" placeholder="First name" value="'+(data.first||'')+'"></div>'+
         '<div class="field"><input id="f_last" placeholder="Last name" value="'+(data.last||'')+'"></div></div>'+
         '<div class="field"><input id="f_email" type="email" inputmode="email" placeholder="Email address" value="'+(data.email||'')+'"></div>'+
         '<div class="field"><input id="f_phone" type="tel" inputmode="tel" placeholder="Phone number" value="'+(data.phone||'')+'"></div>'+
         '<input type="hidden" name="xxTrustedFormCertUrl" id="xxTrustedFormCertUrl">'+
         '<input type="hidden" name="xxTrustedFormPingUrl" id="xxTrustedFormPingUrl">'+
         '<button class="btn btn-grad btn-lg" type="button" data-submit="1">Get My Free Quote &rsaquo;</button>'+
         '<p class="consent">By submitting, I consent to receive calls, texts, and emails from Renue Home and/or its <a href="/partners">home improvement partners</a> (up to '+BUYER_CAP+' companies) at the number/email provided, including by automated technology or prerecorded/artificial voice, even if I am on a Do Not Call list. Consent is not a condition of purchase. Message/data rates may apply. I can revoke consent at any time. See our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms</a>.</p>';
    }

    h += '<div class="err" id="err"></div>'+
      '<div class="trustcues">'+
        '<span>'+LOCK+' 256-bit SSL secured</span>'+
        '<span>'+SHIELD+' Your info is private</span>'+
        '<span>'+CK+' No spam — ever</span>'+
        (TRUSTEDFORM?'<span>'+CK+' TrustedForm&reg; verified</span>':'')+
      '</div>';
    card.innerHTML = h;

    // wire
    var back = card.querySelector("[data-back]"); if(back) back.onclick=function(){ if(history.state && typeof history.state.rf==="number" && history.state.rf>0){ history.back(); } else { renderStep(cfg, idx-1, data); } };
    var errEl = function(m){ var e=document.getElementById("err"); if(e) e.textContent=m||""; };
    var next = function(nd){ document.body.classList.add("quiz-engaged"); var d=Object.assign({}, data, nd||{}); if(idx<total-1){ try{ history.pushState({rf:idx+1}, ""); }catch(e){} renderStep(cfg, idx+1, d); } else doSubmit(cfg, d); };

    if(step.type==="single"){
      Array.prototype.forEach.call(card.querySelectorAll("[data-pick]"), function(b){
        b.onclick=function(){ var v=step.options[+b.getAttribute("data-pick")]; var nd={}; nd[step.id]=v; setTimeout(function(){ next(nd); },140); b.classList.add("sel"); };
      });
    }
    if(step.type==="multi"){
      var chosen=[];
      Array.prototype.forEach.call(card.querySelectorAll("[data-multi]"), function(b){
        b.onclick=function(){ var v=step.options[+b.getAttribute("data-multi")]; b.classList.toggle("sel"); var k=chosen.indexOf(v); if(k>-1) chosen.splice(k,1); else chosen.push(v); };
      });
      card.querySelector("[data-multinext]").onclick=function(){ var nd={}; nd[step.id]=chosen.join(", "); next(nd); };
    }
    if(step.type==="zip"){
      card.querySelector("[data-zip]").onclick=function(){ var el=document.getElementById("f_zip"); var v=(el.value||"").trim(); if(!/^\d{5}$/.test(v)){ el.classList.add("bad"); return errEl("Please enter a valid 5-digit ZIP code."); } next({zip:v}); };
    }
    if(step.type==="address"){
      card.querySelector("[data-addr]").onclick=function(){ var el=document.getElementById("f_addr"); var v=(el.value||"").trim(); if(v.length<5){ el.classList.add("bad"); return errEl("Please enter your project address."); } next({address:v}); };
    }
    if(step.type==="contact"){
      card.querySelector("[data-submit]").onclick=function(btn){ submitContact(cfg, idx, data, this); };
    }
  }

  function submitContact(cfg, idx, data, btn){
    var first=val("f_first"), last=val("f_last"), email=val("f_email"), phone=val("f_phone");
    var err=function(m,id){ var e=document.getElementById("err"); if(e)e.textContent=m; if(id){var x=document.getElementById(id); if(x)x.classList.add("bad");} };
    document.getElementById("err").textContent="";
    if(!first){ return err("Please enter your first name.","f_first"); }
    if(!last){ return err("Please enter your last name.","f_last"); }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ return err("Please enter a valid email address.","f_email"); }
    if(phone.replace(/\D/g,"").length<10){ return err("Please enter a valid phone number.","f_phone"); }
    if(btn.dataset.busy==="1") return; // double-submit guard
    btn.dataset.busy="1"; btn.disabled=true; btn.textContent="Submitting…";
    var lead = Object.assign({}, data, {first:first,last:last,email:email,phone:phone,vertical:window.RENUE_VERTICAL,consent:true,ts:Date.now()});
    lead.xxTrustedFormCertUrl = val("xxTrustedFormCertUrl");
    lead.xxTrustedFormPingUrl = val("xxTrustedFormPingUrl");
    lead.consentText = "By submitting, I consent to receive calls, texts, and emails from Renue Home and/or its home improvement partners (up to "+BUYER_CAP+" companies)...";
    lead.pageUrl = location.href;
    if(window.RENUE_CITY) lead.city = window.RENUE_CITY.name;
    doSubmit(cfg, lead, btn);
  }

  function doSubmit(cfg, lead, btn){
    var finish=function(callNumber){
      RF.active=false;
      var quiz=document.getElementById("quiz");
      quiz.innerHTML='<div class="card"><div class="thanks show"><div class="big"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>'+
        '<div class="q">You’re all set'+(lead.first?', '+esc(lead.first):'')+'!</div>'+
        '<p class="qsub">Your request has been received. A trusted local pro will reach out shortly to discuss your '+cfg.word+' project.</p>'+
        (callNumber?'<div class="callrow"><a class="btn btn-grad btn-lg" href="'+telHref(callNumber)+'">📞 Call now to speak to a specialist</a></div>':'')+
        '<div class="trustcues" style="margin-top:16px"><span>Trusted. Local. Renue.</span></div></div></div>';
      try{ if(window.gtag) gtag('event','generate_lead',{items:[{item_category:window.RENUE_VERTICAL}]}); }catch(e){}
      try{ if(window.fbq) fbq('track','Lead'); }catch(e){}
      window.scrollTo({top:0,behavior:"smooth"});
    };
    var fail=function(){
      var e=document.getElementById("err");
      if(e) e.textContent="Sorry — something went wrong submitting your request. Please try again.";
      if(btn){ btn.disabled=false; btn.dataset.busy=""; btn.textContent="Get My Free Quote ›"; }
    };
    fetch(SUBMIT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(lead)})
      .then(function(r){ if(!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function(j){ finish(j&&j.callNumber?j.callNumber:PHONE_NUMBER); })
      .catch(fail);
  }

  function wireFaq(){ /* native <details>; nothing needed */ }
  function val(id){ var e=document.getElementById(id); return e?(e.value||"").trim():""; }
  function esc(s){ return (s||"").replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}); }

  /* ===== Boot ===== */
  function boot(){
    document.body.insertBefore(header(), document.body.firstChild);
    if(window.RENUE_PAGE==="vertical") buildVertical();
    document.body.appendChild(footer());
    document.body.appendChild(sticky());
    window.addEventListener("popstate", function(e){
      if(!RF.active || !RF.cfg) return;
      var t = (e.state && typeof e.state.rf === "number") ? e.state.rf : null;
      if(t === null) return;
      renderStep(RF.cfg, t, RF.data);
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
