/* ANOMALOUS redesign - shared interactions. No dependencies. */
(function () {
  "use strict";
  var FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbzqxH0u2D4HabAzGGGaOj8gyRElbUPfr8ftrwkDzuIh-tNZ-64TCfHUkneNv4jwA8k8zg/exec";
  var FORM_TOKEN = "5b6c23719188da0d5dacbc295763ddae77166a87c022df41";
  function postForm(data) {
    if (!FORM_ENDPOINT || FORM_ENDPOINT.indexOf("__ANOMALOUS") === 0) return;
    data.token = FORM_TOKEN;
    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(data) }).catch(function () {});
  }
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Mobile menu */
  var toggle = $("#navToggle"), nav = $("#nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.innerHTML = open ? "&times;" : "&#9776;";
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.innerHTML = "&#9776;"; }
    });
  }

  /* Scroll reveal */
  var els = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add("in"); }); }

  /* Count-up stats */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count")), dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var start = null, dur = 1300;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var stats = $(".stats");
  if (stats) {
    if ("IntersectionObserver" in window) {
      var so = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { $$("[data-count]").forEach(countUp); so.disconnect(); }
        });
      }, { threshold: 0.4 });
      so.observe(stats);
    } else { $$("[data-count]").forEach(countUp); }
  }

  /* Scrollspy */
  var links = $$(".nav a"), sections = links.map(function (a) {
    var h = a.getAttribute("href") || "";
    if (h.charAt(0) !== "#") return null; /* page links are not in-page sections */
    try { return document.querySelector(h); } catch (e) { return null; }
  });
  function spy() {
    var y = window.scrollY + 140, current = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) current = i; });
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
  }
  window.addEventListener("scroll", spy, { passive: true }); spy();

  /* Portfolio filter */
  $$(".filters button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      $$(".filters button").forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      var f = btn.getAttribute("data-filter");
      $$(".pcard").forEach(function (card) {
        card.style.display = (f === "all" || card.getAttribute("data-brokerage") === f) ? "" : "none";
      });
    });
  });

  /* Portfolio modal (reels play in-page, HLS via hls.js when needed) */
  var modal = $("#clientModal");
  if (modal) {
    var mName = $("#mName"), mBroker = $("#mBroker"), mVideo = $("#mVideo");
    var hls = null;
    function stopReel() {
      if (mVideo) { mVideo.pause(); mVideo.removeAttribute("src"); mVideo.load(); }
      if (hls) { hls.destroy(); hls = null; }
    }
    function closeModal() {
      stopReel();
      modal.hidden = true; document.body.style.overflow = "";
    }
    function playReel(src) {
      if (!mVideo || !src) return;
      if (/\.m3u8($|\?)/.test(src) && window.Hls && Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(mVideo);
      } else {
        /* MP4 files play directly; Safari also plays HLS natively. */
        mVideo.src = src;
      }
    }
    $$(".pcard").forEach(function (card) {
      card.addEventListener("click", function () {
        mName.textContent = card.getAttribute("data-name");
        mBroker.textContent = card.getAttribute("data-brokerage-label");
        modal.hidden = false; document.body.style.overflow = "hidden";
        playReel(card.getAttribute("data-video"));
      });
    });
    $$("[data-close-modal]").forEach(function (b) {
      b.addEventListener("click", closeModal);
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  }

  /* Booking picker (getstarted) — date + time slots, posts type=booking.
     Call hours set by Sandy Nov 27, 2026: Discovery calls, 30 minutes,
     Mon-Fri, noon to 4pm ET. days: 0=Sunday..6=Saturday. */
  var BOOK_HOURS = { days: [1, 2, 3, 4, 5], start: 12 * 60, end: 16 * 60, slotMinutes: 30 };
  var bookForm = $("#bookForm");
  if (bookForm) {
    var datesEl = $("#bookDates"), slotsEl = $("#bookSlots"), noteEl = $("#bookNote");
    var selDate = null, selTime = null;
    var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function fmtTime(mins) {
      var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? "PM" : "AM", hh = h % 12;
      if (hh === 0) hh = 12;
      return hh + ":" + (m < 10 ? "0" : "") + m + " " + ap;
    }
    function fmtDate(d) {
      return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
    }
    function buildDates() {
      datesEl.innerHTML = "";
      var today = new Date(); today.setHours(0, 0, 0, 0);
      for (var i = 0; i < 14; i++) {
        var d = new Date(today.getTime() + i * 86400000);
        if (BOOK_HOURS.days.indexOf(d.getDay()) < 0) continue;
        var b = document.createElement("button");
        b.type = "button"; b.className = "date-chip";
        b.innerHTML = "<b>" + DAYS[d.getDay()] + "</b><span>" + MONTHS[d.getMonth()] + " " + d.getDate() + "</span>";
        (function (dd, btn) {
          btn.addEventListener("click", function () {
            selDate = dd; selTime = null;
            $$(".date-chip", datesEl).forEach(function (c) { c.classList.remove("on"); });
            btn.classList.add("on");
            buildSlots();
          });
        })(d, b);
        datesEl.appendChild(b);
      }
      var first = datesEl.querySelector(".date-chip");
      if (first) first.click();
    }
    function buildSlots() {
      slotsEl.innerHTML = "";
      if (!selDate) return;
      var now = new Date();
      var isToday = selDate.toDateString() === now.toDateString();
      for (var t = BOOK_HOURS.start; t + BOOK_HOURS.slotMinutes <= BOOK_HOURS.end; t += BOOK_HOURS.slotMinutes) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "slot"; b.textContent = fmtTime(t);
        var slotDate = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), Math.floor(t / 60), t % 60);
        if (isToday && slotDate.getTime() <= now.getTime() + 30 * 60000) b.disabled = true;
        (function (tt, btn) {
          btn.addEventListener("click", function () {
            selTime = tt;
            $$(".slot", slotsEl).forEach(function (s) { s.classList.remove("on"); });
            btn.classList.add("on");
          });
        })(t, b);
        slotsEl.appendChild(b);
      }
    }
    buildDates();
    bookForm.addEventListener("submit", function (e) {
      e.preventDefault();
      function f(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
      var name = f("bName"), email = f("bEmail"), phone = f("bPhone"), want = f("bWant"), msg = f("bMsg");
      if (!selDate || selTime === null) {
        if (noteEl) { noteEl.textContent = "Pick a day and a time first."; noteEl.hidden = false; }
        return;
      }
      if (!name || !email || email.indexOf("@") < 0) {
        if (noteEl) { noteEl.textContent = "Add your name and a valid email so we can confirm."; noteEl.hidden = false; }
        return;
      }
      postForm({ type: "booking", date: fmtDate(selDate), time: fmtTime(selTime) + " ET",
        name: name, email: email, phone: phone, want: want, message: msg });
      bookForm.hidden = true;
      var done = $("#bookDone"), doneText = $("#bookDoneText");
      if (doneText) doneText.textContent = name.split(" ")[0] + ", you asked for " + fmtDate(selDate) + " at " + fmtTime(selTime) + " Eastern.";
      if (done) done.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* Quiz wizard (5 scripts page) */
  var quiz = $("#quiz");
  if (quiz) {
    var steps = $$(".qstep", quiz), bar = $("#qbar"), cur = 0;
    var total = steps.length;
    function show(i, scroll) {
      steps.forEach(function (s, k) { s.classList.toggle("on", k === i); });
      cur = i;
      if (bar) bar.style.width = Math.round(((i) / total) * 100) + "%";
      if (scroll !== false) window.scrollTo({ top: quiz.offsetTop - 90, behavior: "smooth" });
    }
    $$("[data-next]", quiz).forEach(function (b) {
      b.addEventListener("click", function () {
        var step = steps[cur];
        var req = $$("[required]", step);
        var ok = true;
        req.forEach(function (f) {
          if (!f.value || !f.value.trim()) { ok = false; f.style.borderColor = "var(--red)"; f.focus(); }
          else { f.style.borderColor = ""; }
        });
        if (!ok) return;
        if (cur === total - 2) finish();
        else if (cur < total - 1) show(cur + 1);
      });
    });
    $$("[data-back]", quiz).forEach(function (b) {
      b.addEventListener("click", function () { if (cur > 0) show(cur - 1); });
    });
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    var q6 = document.getElementById("q6"), qStart = document.getElementById("qStart");
    if (q6 && qStart) q6.addEventListener("change", function () {
      qStart.textContent = q6.value.trim() || "this week";
    });
    function finish() {
      if (bar) bar.style.width = "100%";
      var dream = val("q1") || "your dream customer";
      var action = val("q2") || "reach out";
      var vibe = val("q3") || "real and direct";
      var flex = val("q4") || "your proudest win";
      var setup = val("q5") || "your current setup";
      var name = val("qName") || "you";
      var scripts = [
        { t: "1. The dream customer call-out", h: "Talk straight to " + dream + ".", b: "Open on their exact problem, in their words. Name the result they want, then show you have done it before. End by asking them to " + action + "." },
        { t: "2. The flex story", h: "Tell the story of " + flex + ".", b: "Start at the hard part, not the win. Walk through what you did differently, then land the result. Proof beats promises, and this one is yours." },
        { t: "3. The vibe check", h: "Show the world the " + vibe + " version of your brand.", b: "Film the way you actually work, not the way you think a brand should look. One honest moment of your process, in your own voice, does more than a polished ad." },
        { t: "4. The setup tour", h: "Your setup is the content: " + setup + ".", b: "Show people where the work happens. A quick tour of " + setup + " makes filming feel doable for you and real for them. Keep it under 30 seconds." },
        { t: "5. The action closer", h: "One video, one job: get them to " + action + ".", b: "No second ask. Say what happens when they " + action + ", and what it costs them to wait. Close on your face, looking at the camera." }
      ];
      var out = $("#scriptResults");
      var html = "<p class=\"lede\" style=\"margin-bottom:20px\">" + name.split(" ")[0] + ", here are your five. Each one is built from your answers, ready to film.</p>";
      scripts.forEach(function (s, i) {
        html += "<div class=\"script-card\" style=\"opacity:0;transform:translateY(10px);transition:opacity .5s ease " + (i * 0.18) + "s,transform .5s ease " + (i * 0.18) + "s\">" +
          "<span class=\"chip\">Script " + (i + 1) + "</span><h4>" + s.t + "</h4>" +
          "<p class=\"hook\">" + s.h + "</p><p>" + s.b + "</p></div>";
      });
      html += "<p class=\"fine\">Full scripts with word-for-word lines go to " + (val("qEmail") || "your email") + ". Your outlines are below, and the complete versions are on their way.</p>";
      var outlinesText = scripts.map(function (s) { return s.t + "\n" + s.h + "\n" + s.b; }).join("\n\n");
      postForm({ type: "scripts", name: val("qName"), email: val("qEmail"), phone: val("qPhone"),
        answers: { dreamCustomer: dream, action: action, vibe: vibe, flexStory: flex, setup: setup },
        outlines: outlinesText });
      out.innerHTML = html;
      steps.forEach(function (s) { s.classList.remove("on"); });
      $("#qDone").classList.add("on");
      requestAnimationFrame(function () {
        $$(".script-card", out).forEach(function (c) { c.style.opacity = "1"; c.style.transform = "none"; });
      });
      window.scrollTo({ top: out.offsetTop - 90, behavior: "smooth" });
    }
    show(0, false);
  }

  /* Lightbox (phase diagrams, team cards, GaryVee photo) */
  var lb = $("#lightbox"), lbImg = $("#lbImg");
  function openLb(src, alt) {
    if (!lb || !lbImg) return;
    lbImg.src = src; lbImg.alt = alt || "";
    lb.hidden = false; document.body.style.overflow = "hidden";
  }
  function closeLb() {
    if (!lb) return;
    lb.hidden = true; lbImg.src = ""; document.body.style.overflow = "";
  }
  $$("[data-lb]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      openLb(el.getAttribute("data-lb"), el.getAttribute("alt"));
    });
  });
  if (lb) {
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.id === "lbClose") closeLb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) closeLb(); });
  }

  /* Conversion estimator */
  var est = $("#estimator");
  if (est) {
    var views = $("#eViews"), ctr = $("#eCtr"), lcv = $("#eLcv"), qual = $("#eQual"), close = $("#eClose"), rev = $("#eRev");
    var oViews = $("#oViews"), oCtr = $("#oCtr"), oLcv = $("#oLcv"), oQual = $("#oQual"), oClose = $("#oClose"), oRev = $("#oRev");
    var rClicks = $("#rClicks"), rLeads = $("#rLeads"), rQual = $("#rQual"), rDeals = $("#rDeals"), rMoney = $("#rMoney"), rNote = $("#rNote");
    function num(el, d) { var v = parseFloat(el.value); return isNaN(v) ? d : v; }
    function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
    function calc() {
      var v = num(views, 10000), c = num(ctr, 2), l = num(lcv, 20), q = num(qual, 50), cl = num(close, 3), r = num(rev, 15000);
      oViews.textContent = v.toLocaleString("en-US");
      oCtr.textContent = c + "%"; oLcv.textContent = l + "%"; oQual.textContent = q + "%";
      oClose.textContent = cl + " of 10"; oRev.textContent = "$" + r.toLocaleString("en-US");
      var clicks = v * c / 100, leads = clicks * l / 100, qualified = leads * q / 100, deals = qualified * cl / 10, cash = deals * r;
      rClicks.textContent = Math.round(clicks).toLocaleString("en-US");
      rLeads.textContent = Math.round(leads).toLocaleString("en-US");
      rQual.textContent = Math.round(qualified).toLocaleString("en-US");
      rDeals.textContent = deals.toFixed(1);
      rMoney.textContent = money(cash);
      var oV2 = document.getElementById("oViews2"), rM2 = document.getElementById("rMoney2");
      if (oV2) oV2.textContent = v.toLocaleString("en-US");
      if (rM2) rM2.textContent = rMoney.textContent;
      var niche = (document.getElementById("eNiche") || {}).value || "your niche";
      rNote.textContent = "Estimate for " + niche + ", per month, at your numbers. Change any slider and the funnel updates.";
    }
    [views, ctr, lcv, qual, close, rev].forEach(function (el) { el.addEventListener("input", calc); });
    var nicheEl = document.getElementById("eNiche");
    if (nicheEl) nicheEl.addEventListener("input", calc);
    calc();
    var sendBtn = document.getElementById("sendEstimates");
    if (sendBtn) sendBtn.addEventListener("click", function () {
      var n = document.getElementById("sendNote");
      var name = (document.getElementById("cName") || {}).value || "";
      var email = (document.getElementById("cEmail") || {}).value || "";
      var phone = (document.getElementById("cPhone") || {}).value || "";
      if (!email || email.indexOf("@") < 0) {
        if (n) { n.textContent = "Add a valid email so we can send your breakdown."; n.hidden = false; }
        return;
      }
      postForm({ type: "conversion", name: name, email: email, phone: phone,
        estimates: { views: num(views, 10000), clickRate: num(ctr, 2), landingConversion: num(lcv, 20),
          qualifiedRate: num(qual, 50), closeRate: num(close, 3), revenuePerDeal: num(rev, 15000),
          monthlyRevenue: (document.getElementById("rMoney") || {}).textContent || "" },
        answers: { niche: (document.getElementById("eNiche") || {}).value || "" } });
      if (n) { n.textContent = "Sent. Your breakdown is on its way to " + email + "."; n.hidden = false; }
    });
  }
})();
