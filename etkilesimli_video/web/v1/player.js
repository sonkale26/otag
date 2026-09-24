/* haluku oynatıcısı 0.4.0
 * Derleme gerektirmeyen tek dosya. Yerel önizlemede (/oynat/<id>) projeyi haluku sunucusundan
 * okur; SCORM/web paketinde window.HALUKU_PROJE verisini kullanır ve bir LMS bulursa
 * SCORM 1.2 ile ilerleme, puan ve tamamlanma bilgisini gönderir. */
(() => {
  "use strict";

  const QUESTION_BUTTON_SECONDS = 10;
  const END_GUARD_SECONDS = 0.35;
  const CROP_GRACE_MS = 4000;
  const SETTLE_MS = 3500;
  const MIN_CROP_WIDTH = 480;
  const COMPLETION_RATIO = 0.9;
  const SAVE_EVERY_MS = 10000;
  const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const TYPE_ORDER = { bookmark: 0, popup: 1, question: 2 };
  const TYPE_LABEL = { bookmark: "Yer imi", question: "Soru", popup: "Pop-up" };
  const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  const PACKAGED = Boolean(window.HALUKU_PROJE);
  // Dokunmatik cihazlara YouTube mobil oynatıcıyı verir; onun yerleşimi kırpmaya uygun değil.
  const TOUCH_UI = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
  const YT_ERRORS = {
    2: "Video kimliği geçersiz.",
    5: "Video bu tarayıcıda oynatılamıyor.",
    100: "Video bulunamadı: silinmiş ya da özel olabilir.",
    101: "Video sahibi, videonun başka sitelerde oynatılmasına izin vermiyor.",
    150: "Video sahibi, videonun başka sitelerde oynatılmasına izin vermiyor.",
    152: "YouTube bu videoyu bu sayfada oynatmadı (hata 152).",
    153: PACKAGED
      ? "YouTube oynatıcı yapılandırma hatası (153): sayfa adres bilgisini göndermiyor. Sayfayı bir LMS'ten ya da web sunucusundan açın; dosyaya çift tıklayarak açılan sayfada YouTube çalışmaz."
      : "YouTube oynatıcı yapılandırma hatası (153): sayfa adres bilgisini göndermiyor. Sayfayı http://localhost adresinden açtığınızdan emin olun."
  };

  // ---------- küçük yardımcılar ----------

  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "style") Object.assign(node.style, value);
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function clock(value, precise = false) {
    let seconds = Number.isFinite(value) && value > 0 ? value : 0;
    const tenths = precise ? Math.round(seconds * 10) % 10 : 0;
    seconds = precise ? Math.floor(Math.round(seconds * 10) / 10) : Math.floor(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, "0") + (tenths ? `.${tenths}` : "");
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
  }

  const prefs = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch { /* gizli pencere vb. */ }
    }
  };

  function isSafeLink(link) {
    return typeof link === "string" && /^https?:\/\//i.test(link);
  }

  function packBits(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    bits.forEach((bit, index) => { if (bit) bytes[index >> 3] |= 1 << (index & 7); });
    let text = "";
    bytes.forEach((byte) => { text += String.fromCharCode(byte); });
    return btoa(text);
  }

  function unpackBits(text, size) {
    const bits = new Uint8Array(size);
    try {
      const raw = atob(text);
      for (let i = 0; i < size; i++) if (raw.charCodeAt(i >> 3) & (1 << (i & 7))) bits[i] = 1;
    } catch { /* bozuk veri: sıfırdan başla */ }
    return bits;
  }

  // ---------- SCORM 1.2 ----------

  const scorm = (() => {
    let api = null;
    let finished = false;
    const startedAt = Date.now();

    function findApi(win) {
      for (let depth = 0; win && depth < 10; depth++) {
        try { if (win.API) return win.API; } catch { return null; }
        if (win.parent === win) break;
        win = win.parent;
      }
      return null;
    }

    function timespan(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(4, "0")}:${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
    }

    return {
      init() {
        try { api = findApi(window) || (window.opener ? findApi(window.opener) : null); } catch { api = null; }
        if (!api) return false;
        try {
          if (String(api.LMSInitialize("")) !== "true") { api = null; return false; }
        } catch { api = null; return false; }
        const status = this.get("cmi.core.lesson_status");
        if (!status || status === "not attempted") this.set("cmi.core.lesson_status", "incomplete");
        return true;
      },
      get(key) {
        if (!api || finished) return "";
        try { return String(api.LMSGetValue(key) ?? ""); } catch { return ""; }
      },
      set(key, value) {
        if (!api || finished) return false;
        try { return String(api.LMSSetValue(key, String(value))) === "true"; } catch { return false; }
      },
      commit() {
        if (!api || finished) return;
        try { api.LMSCommit(""); } catch { /* LMS yanıt vermedi */ }
      },
      finish(completed) {
        if (!api || finished) return;
        this.set("cmi.core.session_time", timespan((Date.now() - startedAt) / 1000));
        this.set("cmi.core.exit", completed ? "" : "suspend");
        this.commit();
        finished = true;
        try { api.LMSFinish(""); } catch { /* LMS yanıt vermedi */ }
      }
    };
  })();

  // ---------- öğe zamanlaması ----------

  class Engine {
    constructor(items, settings) {
      this.items = [...(items || [])].sort((a, b) => a.at - b.at || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
      this.settings = settings || {};
      this.answered = new Set(); // "Devam et" ile kapatılan sorular
      this.fired = new Set();    // zamanı gelmiş öğeler
      this.opened = new Set();   // düğmesine tıklanmış (ya da geçilmiş) öğeler
      this.last = -0.001;
    }

    get questions() { return this.items.filter((item) => item.type === "question"); }
    get popups() { return this.items.filter((item) => item.type === "popup"); }
    get bookmarks() { return this.items.filter((item) => item.type === "bookmark"); }

    // Zorunlu sorular ve "videoyu durdur" işaretli kartlar videoyu durdurur.
    blocks(item) {
      return item.type === "question" ? item.required !== false : Boolean(item.pause);
    }

    buttonUntil(item) {
      return item.at + (item.type === "popup" ? Math.max(1, Number(item.duration) || 8) : QUESTION_BUTTON_SECONDS);
    }

    rearmFrom(t) {
      for (const id of [...this.fired]) {
        const item = this.items.find((candidate) => candidate.id === id);
        if (item && item.at >= t) { this.fired.delete(id); this.opened.delete(id); }
      }
    }

    // Geri sarmada hedefteki ve sonrasındaki öğeler yeniden tetiklenebilsin.
    prepareSeek(t) {
      if (t >= this.last) return;
      this.rearmFrom(t - 0.05);
      this.last = t - 0.1;
    }

    // Oynatma t anına geldiğinde videoyu durdurması gereken öğeyi döndürür.
    update(t) {
      const previous = this.last;
      this.last = t;
      const delta = t - previous;
      if (delta < -0.3) {
        this.rearmFrom(t + 0.001);
        return null;
      }
      if (delta <= 0) return null;
      const crossed = (item) => item.at > previous && item.at <= t + 0.05;
      if (delta > 3) {
        if (this.settings.preventSkippingRequired) {
          const skipped = this.questions.find((q) => this.blocks(q) && !this.answered.has(q.id) && crossed(q));
          if (skipped) {
            this.fired.add(skipped.id);
            this.last = skipped.at;
            return { item: skipped, seekTo: skipped.at };
          }
        }
        for (const item of this.items) {
          if (item.type !== "bookmark" && !this.blocks(item) && item.at <= t + 0.05 && t < this.buttonUntil(item)) this.fired.add(item.id);
        }
        return null;
      }
      for (const item of this.items) {
        if (item.type === "bookmark" || !crossed(item) || this.fired.has(item.id)) continue;
        if (item.type === "question" && this.answered.has(item.id)) continue;
        this.fired.add(item.id);
        if (this.blocks(item)) {
          const late = t - item.at > 0.3;
          if (late) this.last = item.at;
          return { item, seekTo: late ? item.at : null };
        }
      }
      return null;
    }

    buttons(t) {
      return this.items.filter((item) =>
        item.type !== "bookmark" &&
        !this.blocks(item) &&
        this.fired.has(item.id) &&
        !this.opened.has(item.id) &&
        !(item.type === "question" && this.answered.has(item.id)) &&
        item.at <= t + 0.05 &&
        t < this.buttonUntil(item)
      );
    }

    seekLimit() {
      if (!this.settings.preventSkippingRequired) return Infinity;
      const pending = this.questions.find((q) => this.blocks(q) && !this.answered.has(q.id));
      return pending ? pending.at : Infinity;
    }

    activeBookmark(t) {
      let active = null;
      for (const bookmark of this.bookmarks) if (bookmark.at <= t + 0.05) active = bookmark;
      return active;
    }
  }

  // ---------- YouTube ----------

  let youTubeApi = null;
  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (youTubeApi) return youTubeApi;
    youTubeApi = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        youTubeApi = null;
        reject(new Error("YouTube oynatıcısı yüklenemedi. İnternet bağlantınızı ve YouTube erişimini kontrol edin."));
      };
      document.head.appendChild(script);
    });
    return youTubeApi;
  }

  async function createYouTubePlayer(host, videoId, handlers) {
    const YT = await loadYouTubeApi();
    host.replaceChildren();
    const iframe = document.createElement("iframe");
    const params = new URLSearchParams({
      enablejsapi: "1", origin: window.location.origin, playsinline: "1", rel: "0", iv_load_policy: "3",
      hl: "tr", cc_lang_pref: "tr", controls: "0", fs: "0", disablekb: "1"
    });
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
    iframe.title = "YouTube video oynatıcısı";
    // "fullscreen" izni verilmez: Android Chrome telefon yan çevrilince videoyu kendiliğinden tam
    // ekrana alıyor ve sorular, kartlar dışarıda kalıyordu. Tam ekranı oynatıcının kendi düğmesi yapar.
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.tabIndex = -1;
    host.appendChild(iframe);

    return new Promise((resolve) => {
      let yt = null;
      const tracks = () => {
        try { return yt.getOption("captions", "tracklist") || []; } catch { return []; }
      };
      const chooseTrack = () => {
        try {
          const list = tracks();
          const pick = list.find((track) => track.languageCode === "tr") || list[0];
          if (pick) yt.setOption("captions", "track", { languageCode: pick.languageCode });
        } catch { /* altyazı modülü henüz hazır değil */ }
      };
      const api = {
        play: () => yt.playVideo?.(),
        pause: () => yt.pauseVideo?.(),
        seek: (seconds) => yt.seekTo?.(Math.max(0, seconds), true),
        time: () => Number(yt.getCurrentTime?.()) || 0,
        duration: () => Number(yt.getDuration?.()) || 0,
        state: () => Number(yt.getPlayerState?.() ?? YT_STATE.UNSTARTED),
        setRate: (rate) => yt.setPlaybackRate?.(rate),
        mute: () => yt.mute?.(),
        unMute: () => {
          yt.unMute?.();
          yt.setVolume?.(100);
        },
        hasCaptionModule: () => {
          try { return (yt.getOptions?.() || []).includes("captions"); } catch { return false; }
        },
        captionTracks: tracks,
        chooseCaptionTrack: chooseTrack,
        captionsOn: () => {
          try { yt.loadModule("captions"); } catch { /* yok say */ }
          chooseTrack();
          setTimeout(chooseTrack, 800);
        },
        captionsOff: () => {
          try { yt.unloadModule("captions"); } catch { /* yok say */ }
        }
      };
      yt = new YT.Player(iframe, {
        events: {
          onReady: () => resolve(api),
          onStateChange: (event) => handlers.onState(event.data),
          onError: (event) => handlers.onError(YT_ERRORS[event.data] ?? `YouTube oynatıcı hatası (${event.data})`),
          onApiChange: () => handlers.onApiChange()
        }
      });
    });
  }

  // ---------- izleyici ekranı ----------

  function mountStage(project, lms) {
    const engine = new Engine(project.items, project.settings);
    const results = {}; // soru kimliği -> { correct, firstTry }
    let player = null;
    let ready = false;
    let playing = false;
    let everPlayed = false;
    let ended = false;
    let playStartedAt = 0;
    let duration = Number(project.video.duration) || 0;
    let current = 0;
    let overlay = null; // { kind: "gate" | "card" | "end" | "resume", item? }
    let ccOn = prefs.get("haluku-altyazi") === "1";
    let captionsApplied = false;
    let buttonsKey = "";
    let markersFor = 0;
    let tapTimer = 0;
    let toastTimer = 0;
    let coverage = null;
    let lastTracked = null;
    let completed = false;
    let lastSave = 0;
    let interactionIndex = 0;
    let pendingSeek = null; // YouTube yeni konumu bildirene kadar eski zamanı yok say
    let seekOnStart = null; // ilk oynatma başlamadan istenen konum (YouTube o sırada yok sayabiliyor)
    let scrub = null;       // ilerleme çubuğunda sürükleme
    let menuOpen = false;
    let swallowClick = false;
    let openSection = null;
    let activeBookmarkId = null;
    let cropAllowed = !TOUCH_UI;

    // --- video çerçevesi
    const host = h("div", { class: "video-host" });
    const poster = h("img", {
      class: "video-poster", alt: "", "aria-hidden": "true",
      src: `https://i.ytimg.com/vi/${encodeURIComponent(project.video.videoId)}/hqdefault.jpg`
    });
    poster.addEventListener("error", () => poster.remove());
    const strips = h("div", { class: "video-strips", "aria-hidden": "true" });
    const shield = h("div", { class: "video-shield", "aria-hidden": "true" });
    const bigPlay = h("button", { type: "button", class: "big-play", "aria-label": "Oynat" }, "▶");
    const pausedLayer = h("div", { class: "video-paused" }, bigPlay);
    const hotspots = h("div", { class: "hotspots" });
    const panelId = `icerik-${Math.random().toString(36).slice(2, 8)}`;
    const menuButton = h("button", {
      type: "button", class: "menu-button", "aria-expanded": "false", "aria-controls": panelId, "aria-label": "İçerik menüsü"
    }, h("span", { "aria-hidden": "true" }, "☰"), h("span", null, "İçerik"));
    const toast = h("div", { class: "video-toast", role: "status", hidden: true });
    const unmuteButton = h("button", { type: "button", class: "unmute-button" }, "🔇 Sesi aç");
    const overlayLayer = h("div", { class: "video-overlay", hidden: true });
    const tapHint = h("p", { class: "tap-hint" }, "▶ Başlatmak için videoya dokunun");
    const frame = h("div", { class: `video-frame${cropAllowed ? " is-cropped" : ""}` },
      h("p", { class: "video-placeholder" }, "Video yükleniyor…"),
      host, poster, strips, shield, pausedLayer, hotspots, menuButton, unmuteButton, tapHint, toast, overlayLayer);
    const errorBox = h("div", { class: "alert error", role: "alert", hidden: true });

    // --- kontroller
    const playButton = h("button", { type: "button", class: "control-button", disabled: true, "aria-label": "Oynat" }, "▶");
    const timeText = h("span", { class: "time-display" }, "0:00 / 0:00");
    const fill = h("div", { class: "progress-fill" });
    const markers = h("div", { class: "progress-markers" });
    const progress = h("div", { class: "progress", role: "slider", tabindex: "0", "aria-label": "Videoda konum", "aria-valuemin": "0" }, fill, markers);
    const ccButton = h("button", {
      type: "button", class: "control-button cc-button", disabled: true, "aria-pressed": String(ccOn),
      "aria-label": "Altyazı", title: "Altyazıyı aç / kapat (C)"
    }, "CC");
    const rateSelect = h("select", { "aria-label": "Oynatma hızı" }, RATES.map((rate) => h("option", { value: String(rate), selected: rate === 1 }, `${rate}x`)));
    const fullscreenButton = h("button", { type: "button", class: "control-button", "aria-label": "Tam ekran" }, "⤢");
    const controls = h("div", { class: "controls", "aria-label": "Video kontrolleri" },
      playButton, timeText, progress, ccButton, h("label", { class: "rate" }, rateSelect), fullscreenButton);

    // --- içerik paneli: masaüstünde videonun yanında, dar ekranda video üzerinde açılır menü
    const sections = [];
    const bookmarksSection = engine.bookmarks.length ? makeSection("bolumler", "Bölümler") : null;
    const questionsSection = engine.questions.length ? makeSection("sorular", "Sorular") : null;
    const popupsSection = engine.popups.length ? makeSection("kartlar", "Bilgi kartları") : null;
    const bookmarkRows = engine.bookmarks.map((bookmark) => {
      const button = h("button", { type: "button", class: "contents-item", onClick: () => fromList(() => seekTo(bookmark.at)) },
        h("span", { class: "contents-time" }, clock(bookmark.at, true)), h("span", { class: "contents-text" }, bookmark.title));
      bookmarksSection.list.append(h("li", null, button));
      return { bookmark, button };
    });
    if (bookmarksSection) bookmarksSection.count.textContent = String(bookmarkRows.length);
    for (const popup of engine.popups) {
      popupsSection.list.append(h("li", null, h("button", {
        type: "button", class: "contents-item", onClick: () => fromList(() => openCard(popup, false))
      }, h("span", { class: "contents-time" }, clock(popup.at, true)), h("span", { class: "contents-text" }, popup.title || popup.body))));
    }
    if (popupsSection) popupsSection.count.textContent = String(engine.popups.length);
    menuButton.hidden = sections.length === 0;

    const panel = h("aside", { class: "panel contents", id: panelId, "aria-label": "İçerik" },
      h("div", { class: "contents-inner" },
        h("div", { class: "contents-head" },
          h("strong", null, "İçerik"),
          h("button", { type: "button", class: "link", "aria-label": "Menüyü kapat", onClick: () => { setMenu(false); menuButton.focus(); } }, "✕")),
        sections.map((section) => section.element),
        sections.length ? null : h("p", { class: "muted contents-empty" }, "Sorular ve bilgi kartları, video oynarken videonun üzerinde düğme olarak görünecek.")));
    const stage = h("div", { class: "stage" }, h("div", { class: "stage-main" }, frame, errorBox, controls, panel));
    if (sections.length) toggleSection(sections[0].key);

    // --- olaylar
    // overflow: clip desteklemeyen tarayıcılarda taşan iframe çerçeveyi kaydırmasın.
    frame.addEventListener("scroll", () => { frame.scrollTop = 0; frame.scrollLeft = 0; });
    playButton.addEventListener("click", togglePlay);
    bigPlay.addEventListener("click", togglePlay);
    shield.addEventListener("click", togglePlay);
    ccButton.addEventListener("click", () => setCaptions(!ccOn));
    rateSelect.addEventListener("change", () => player?.setRate(Number(rateSelect.value)));
    fullscreenButton.addEventListener("click", toggleFullscreen);
    menuButton.addEventListener("click", () => setMenu(!menuOpen));
    unmuteButton.addEventListener("click", () => {
      player?.unMute();
      frame.classList.remove("is-muted-start");
    });

    progress.addEventListener("pointerdown", (event) => {
      if (!ready || (overlay && overlay.kind !== "end") || event.button > 0) return;
      const box = progress.getBoundingClientRect();
      if (!box.width) return;
      try { progress.setPointerCapture(event.pointerId); } catch { /* sentetik olay */ }
      scrub = { box };
      previewAt(event.clientX);
      event.preventDefault();
    });
    progress.addEventListener("pointermove", (event) => { if (scrub) previewAt(event.clientX); });
    progress.addEventListener("pointerup", (event) => {
      if (!scrub) return;
      const target = fractionAt(event.clientX) * duration;
      scrub = null;
      seekTo(target);
    });
    progress.addEventListener("pointercancel", () => { scrub = null; renderTime(); });
    progress.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") seekTo(current + 5);
      else if (event.key === "ArrowLeft") seekTo(current - 5);
      else if (event.key === "Home") seekTo(0);
      else return;
      event.preventDefault();
      event.stopPropagation();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenu(false);
        menuButton.focus();
        event.preventDefault();
        return;
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = event.key.toLowerCase();
      if (key === "k" || (key === " " && tag !== "BUTTON" && tag !== "A")) togglePlay();
      else if (key === "c" && !ccButton.disabled) setCaptions(!ccOn);
      else if (key === "f") toggleFullscreen();
      else if (key === "arrowright" && !overlay) seekTo(current + 5);
      else if (key === "arrowleft" && !overlay) seekTo(current - 5);
      else return;
      event.preventDefault();
    });
    // Menü açıkken dışarı dokunmak yalnızca menüyü kapatsın, videoyu oynatıp durdurmasın.
    document.addEventListener("pointerdown", (event) => {
      if (!menuOpen || panel.contains(event.target) || menuButton.contains(event.target)) return;
      setMenu(false);
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 400);
    }, true);
    document.addEventListener("click", (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);
    document.addEventListener("fullscreenchange", () => setFullscreen(document.fullscreenElement === stage));

    // --- oynatıcı
    const loadTimer = setTimeout(() => {
      if (!ready) showError("Video yüklenemedi. İnternet bağlantınızı ve YouTube erişimini kontrol edin.");
    }, 20000);
    createYouTubePlayer(host, project.video.videoId, { onState, onError: showError, onApiChange })
      .then((created) => {
        clearTimeout(loadTimer);
        player = created;
        ready = true;
        if (player.duration()) duration = player.duration();
        ccButton.disabled = false;
        refreshPlayState();
        renderTime();
        renderQuestions();
        if (lms) {
          const resumeAt = restoreFromLms();
          renderQuestions();
          renderMarkers();
          if (resumeAt > 5 && (!duration || resumeAt < duration - 5)) showResume(resumeAt);
        }
        setInterval(tick, 150);
      })
      .catch((error) => {
        clearTimeout(loadTimer);
        showError(error.message);
      });

    if (lms) {
      interactionIndex = Math.max(0, Number(lms.get("cmi.interactions._count")) || 0);
      const leave = () => { saveProgress(); lms.finish(completed); };
      window.addEventListener("pagehide", leave);
      window.addEventListener("beforeunload", leave);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveProgress(); });
    }

    renderQuestions();
    return stage;

    // ---------- içerik paneli ----------

    function makeSection(key, title) {
      const count = h("span", { class: "acc-count" });
      const head = h("button", { type: "button", class: "acc-head", "aria-expanded": "false" },
        h("span", { class: "acc-chevron", "aria-hidden": "true" }, "▸"), h("span", null, title), count);
      const list = h("ol", { class: "contents-list" });
      const body = h("div", { class: "acc-body" }, list);
      const element = h("section", { class: "acc" }, head, body);
      head.addEventListener("click", () => toggleSection(key));
      const section = { key, element, head, body, list, count };
      sections.push(section);
      return section;
    }

    // Aynı anda tek bölüm açık kalır; açık bölüm panelin kalan yüksekliğini kullanır.
    function toggleSection(key) {
      openSection = openSection === key ? null : key;
      for (const section of sections) {
        const open = section.key === openSection;
        section.element.classList.toggle("is-open", open);
        section.head.setAttribute("aria-expanded", String(open));
      }
      requestAnimationFrame(scrollActiveIntoView);
    }

    function setMenu(open) {
      menuOpen = open && sections.length > 0;
      stage.classList.toggle("menu-open", menuOpen);
      menuButton.setAttribute("aria-expanded", String(menuOpen));
      if (menuOpen) {
        const target = sections.find((section) => section.key === openSection)?.head ?? sections[0].head;
        requestAnimationFrame(() => {
          target.focus({ preventScroll: true });
          scrollActiveIntoView();
        });
      }
    }

    function fromList(action) {
      if (!ready) return;
      if (overlay && overlay.kind !== "end") {
        toastMessage("Önce açık olan kartı kapatın.");
        return;
      }
      if (overlay) { ended = false; setOverlay(null); }
      setMenu(false);
      action();
    }

    function scrollActiveIntoView() {
      if (!bookmarksSection || openSection !== "bolumler") return;
      const row = bookmarkRows.find((candidate) => candidate.bookmark.id === activeBookmarkId);
      if (!row) return;
      const body = bookmarksSection.body.getBoundingClientRect();
      const item = row.button.getBoundingClientRect();
      if (!body.height) return;
      if (item.top < body.top) bookmarksSection.body.scrollTop -= body.top - item.top + 8;
      else if (item.bottom > body.bottom) bookmarksSection.body.scrollTop += item.bottom - body.bottom + 8;
    }

    // ---------- durum ----------

    function onState(state) {
      const wasPlaying = playing;
      playing = state === YT_STATE.PLAYING;
      if (playing) {
        if (!wasPlaying) playStartedAt = Date.now();
        if (seekOnStart !== null) {
          if (Math.abs(player.time() - seekOnStart) > 1.5) seekPlayer(seekOnStart);
          seekOnStart = null;
        }
        everPlayed = true;
        ended = false;
        clearTimeout(tapTimer);
        frame.classList.remove("needs-tap");
        frame.classList.add("has-played");
      }
      if (state === YT_STATE.ENDED) showEnd();
      if (wasPlaying && state === YT_STATE.PAUSED) saveProgress();
      refreshPlayState();
    }

    function onApiChange() {
      if (!player || !player.hasCaptionModule()) return;
      if (!ccOn) player.captionsOff();
      else if (!captionsApplied) {
        captionsApplied = true;
        player.chooseCaptionTrack();
      }
    }

    function tick() {
      if (!player) return;
      const d = player.duration();
      if (d) duration = d;
      updateCrop();
      const t = player.time();
      if (pendingSeek) {
        if (Math.abs(t - pendingSeek.t) < 1.5 || Date.now() - pendingSeek.at > 2000) pendingSeek = null;
        else { renderTime(); return; }
      }
      current = t;
      renderTime();
      if (overlay) {
        if (overlay.kind !== "resume" && player.state() === YT_STATE.PLAYING) player.pause();
        renderButtons();
        return;
      }
      if (playing && duration && t >= duration - END_GUARD_SECONDS) {
        player.pause();
        showEnd();
        return;
      }
      if (playing) trackCoverage(t);
      const hit = engine.update(t);
      if (hit) {
        player.pause();
        if (hit.seekTo != null) seekPlayer(hit.seekTo);
        openGate(hit.item);
      }
      renderButtons();
      renderActiveBookmark();
      if (lms && playing && Date.now() - lastSave > SAVE_EVERY_MS) saveProgress();
    }

    function togglePlay() {
      if (!player || !ready) return;
      if (frame.classList.contains("is-muted-start")) {
        player.unMute();
        frame.classList.remove("is-muted-start");
      }
      if (overlay) {
        if (overlay.kind === "gate") {
          const item = overlay.item;
          if (item.type === "question") { openCard(item, true); return; }
          engine.opened.add(item.id);
          setOverlay(null);
          player.play();
        }
        return;
      }
      if (playing) { player.pause(); return; }
      if (ended || (duration && current >= duration - END_GUARD_SECONDS - 0.1)) {
        ended = false;
        engine.prepareSeek(0);
        seekPlayer(0);
      }
      player.play();
      armTapFallback();
    }

    function seekPlayer(t) {
      player.seek(t);
      current = t;
      pendingSeek = { t, at: Date.now() };
      if (!everPlayed) seekOnStart = t;
      renderTime();
    }

    // Tarayıcı sesli oynatmayı engellerse (iOS vb.) video sessiz başlar ve "Sesi aç" düğmesi çıkar;
    // o da olmazsa YouTube'un kendi oynat düğmesi açığa çıkarılır.
    function armTapFallback() {
      if (everPlayed) return;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        if (everPlayed || overlay) return;
        player.mute();
        player.play();
        frame.classList.add("is-muted-start");
        tapTimer = setTimeout(() => {
          if (!everPlayed && !overlay) frame.classList.add("needs-tap");
        }, 2500);
      }, 2000);
    }

    function seekTo(target) {
      if (!player || !ready || !Number.isFinite(target)) return;
      if (overlay && overlay.kind !== "end") return;
      if (overlay) { ended = false; setOverlay(null); }
      const limit = engine.seekLimit();
      let t = Math.max(0, Math.min(target, duration || target));
      if (t > limit) {
        t = limit;
        toastMessage("Bu noktadaki soruyu cevaplamadan ileri geçilemez.");
      }
      engine.prepareSeek(t);
      seekPlayer(t);
    }

    function fractionAt(clientX) {
      const box = scrub?.box ?? progress.getBoundingClientRect();
      return box.width ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0;
    }

    function previewAt(clientX) {
      const fraction = fractionAt(clientX);
      fill.style.width = `${fraction * 100}%`;
      timeText.textContent = `${clock(fraction * duration)} / ${clock(duration)}`;
    }

    function setCaptions(on) {
      ccOn = on;
      prefs.set("haluku-altyazi", on ? "1" : "0");
      ccButton.setAttribute("aria-pressed", String(on));
      if (player) {
        if (on) {
          captionsApplied = true;
          player.captionsOn();
          setTimeout(() => {
            if (ccOn && player.captionTracks().length === 0) {
              toastMessage("Bu videoda altyazı bulunmuyor.");
              setCaptions(false);
            }
          }, 3000);
        } else {
          captionsApplied = false;
          player.captionsOff();
        }
      }
      updateCrop();
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }
      const fallback = () => setFullscreen(!stage.classList.contains("is-fullscreen"));
      if (!stage.requestFullscreen) {
        fallback();
        return;
      }
      stage.requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          // Telefonda tam ekran yatay açılsın (destekleyen tarayıcılarda).
          if (!TOUCH_UI) return;
          try { screen.orientation?.lock?.("landscape")?.catch(() => undefined); } catch { /* desteklenmiyor */ }
        })
        .catch(fallback);
    }

    function setFullscreen(on) {
      if (!on && TOUCH_UI) {
        try { screen.orientation?.unlock?.(); } catch { /* desteklenmiyor */ }
      }
      stage.classList.toggle("is-fullscreen", on);
      fullscreenButton.textContent = on ? "⤡" : "⤢";
      fullscreenButton.setAttribute("aria-label", on ? "Tam ekrandan çık" : "Tam ekran");
    }

    // ---------- görünüm ----------

    function refreshPlayState() {
      playButton.textContent = playing ? "❚❚" : "▶";
      playButton.setAttribute("aria-label", playing ? "Duraklat" : "Oynat");
      playButton.disabled = !ready;
      frame.classList.toggle("is-playing", playing);
      frame.classList.toggle("is-paused", ready && !playing && !overlay);
      updateCrop();
    }

    // YouTube'un başlık ve alt çubuğu iframe'in kenarlarında durur; masaüstünde iframe'i
    // çerçeveden taşırıp kırpınca görünmezler. Altyazı da alt kenarda olduğu için altyazı açıkken
    // ve video oynarken kırpma kaldırılır. Dar masaüstü çerçevesinde çubuklar koyu şeritlerle örtülür.
    // Dokunmatik cihazlarda şerit kullanılmaz: görüntüyü karartıyordu; mobil oynatıcı zaten sade.
    function updateCrop() {
      if (!TOUCH_UI && frame.isConnected) cropAllowed = frame.clientWidth >= MIN_CROP_WIDTH;
      const sincePlay = Date.now() - playStartedAt;
      const crop = cropAllowed && (!ccOn || !playing || sincePlay < CROP_GRACE_MS);
      const cover = !TOUCH_UI && !cropAllowed && (playing ? sincePlay < SETTLE_MS : everPlayed);
      if (frame.classList.contains("is-cropped") !== crop) frame.classList.toggle("is-cropped", crop);
      if (frame.classList.contains("show-strips") !== cover) frame.classList.toggle("show-strips", cover);
    }

    function renderTime() {
      if (!scrub) {
        timeText.textContent = `${clock(current)} / ${clock(duration)}`;
        fill.style.width = duration ? `${Math.min(100, (current / duration) * 100)}%` : "0%";
      }
      progress.setAttribute("aria-valuemax", String(Math.round(duration)));
      progress.setAttribute("aria-valuenow", String(Math.round(current)));
      progress.setAttribute("aria-valuetext", clock(current));
      if (duration && duration !== markersFor) {
        markersFor = duration;
        renderMarkers();
      }
    }

    function renderMarkers() {
      if (!duration) return;
      markers.replaceChildren(...engine.items.map((item) => h("span", {
        class: `progress-marker type-${item.type}${item.type === "question" && results[item.id] ? " is-done" : ""}`,
        style: { left: `${Math.min(100, (item.at / duration) * 100)}%` },
        title: `${clock(item.at, true)} · ${TYPE_LABEL[item.type]}`
      })));
    }

    function renderActiveBookmark() {
      const active = engine.activeBookmark(current);
      const id = active ? active.id : null;
      if (id === activeBookmarkId) return;
      activeBookmarkId = id;
      for (const row of bookmarkRows) row.button.classList.toggle("is-active", row.bookmark === active);
      scrollActiveIntoView();
    }

    function renderQuestions() {
      if (!questionsSection) return;
      const questions = engine.questions;
      questionsSection.count.textContent = `${questions.filter((q) => results[q.id]).length}/${questions.length}`;
      questionsSection.list.replaceChildren(...questions.map((question) => {
        const result = results[question.id];
        const status = !result ? "cevaplanmadı" : result.firstTry ? "ilk denemede doğru" : result.correct ? "tekrar denemede doğru" : "yanlış";
        const state = !result ? "" : result.correct ? " is-correct" : " is-wrong";
        return h("li", null, h("button", {
          type: "button", class: `contents-item question-link${state}`, title: question.prompt,
          onClick: () => fromList(() => openCard(question, false))
        },
        h("span", { class: "contents-time" }, clock(question.at, true)),
        h("span", { class: "question-status", "aria-hidden": "true" }, !result ? "•" : result.correct ? "✓" : "✗"),
        h("span", { class: "contents-text" }, question.prompt),
        h("span", { class: "sr-only" }, ` (${status})`)));
      }));
    }

    function renderButtons() {
      const list = overlay || !ready ? [] : engine.buttons(current);
      const key = list.map((item) => item.id).join("|");
      if (key === buttonsKey) return;
      buttonsKey = key;
      hotspots.replaceChildren(...list.map((item) => {
        const isQuestion = item.type === "question";
        const remaining = Math.max(0.5, engine.buttonUntil(item) - current);
        return h("button", {
          type: "button", class: `hotspot type-${item.type}`,
          "aria-label": isQuestion ? "Soruyu aç" : `Bilgi kartını aç: ${item.title || ""}`,
          onClick: () => openCard(item, false)
        },
        h("span", { class: "hotspot-icon", "aria-hidden": "true" }, isQuestion ? "?" : "i"),
        h("span", { class: "hotspot-label" }, isQuestion ? "Soru" : item.title || "Bilgi"),
        h("span", { class: "hotspot-timer", style: { animationDuration: `${remaining}s` } }));
      }));
    }

    function setOverlay(state, content, focusTarget) {
      overlay = state;
      frame.classList.toggle("has-overlay", Boolean(state));
      frame.classList.toggle("has-card", Boolean(state) && state.kind !== "gate");
      if (state) {
        setMenu(false);
        overlayLayer.className = `video-overlay is-${state.kind}`;
        overlayLayer.replaceChildren(content);
        overlayLayer.hidden = false;
      } else {
        overlayLayer.replaceChildren();
        overlayLayer.hidden = true;
      }
      buttonsKey = "-";
      renderButtons();
      refreshPlayState();
      if (focusTarget) requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
    }

    function toastMessage(message) {
      toast.textContent = message;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
    }

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    // ---------- katmanlar ----------

    function openGate(item) {
      const isQuestion = item.type === "question";
      const button = h("button", { type: "button", class: `gate-button type-${item.type}`, onClick: () => openCard(item, true) },
        h("span", { class: "hotspot-icon", "aria-hidden": "true" }, isQuestion ? "?" : "i"),
        h("span", null, isQuestion ? "Soruyu cevapla" : item.title || "Bilgi kartını aç"));
      const hint = isQuestion
        ? "Devam etmek için bu soruyu cevaplayın."
        : "Kartı açmak için tıklayın ya da ▶ ile devam edin.";
      setOverlay({ kind: "gate", item }, h("div", { class: "overlay-gate" }, button, h("p", { class: "gate-hint" }, hint)), button);
    }

    function openCard(item, resumeAfter) {
      const resume = resumeAfter || playing;
      player?.pause();
      engine.opened.add(item.id);
      const close = (answered) => {
        if (answered) engine.answered.add(item.id);
        setOverlay(null);
        renderQuestions();
        renderMarkers();
        saveProgress();
        if (resume) player?.play();
      };
      const card = item.type === "question"
        ? questionCard(item, () => close(true), () => close(false), () => rewatch(item))
        : popupCard(item, () => close(false));
      setOverlay({ kind: "card", item }, card.element, card.focus);
    }

    function rewatch(question) {
      setOverlay(null);
      engine.prepareSeek(question.retryFrom);
      seekPlayer(question.retryFrom);
      player.play();
    }

    function questionCard(question, onContinue, onClose, onRewatch) {
      const multiple = question.kind === "multiple";
      const required = question.required !== false;
      let chosen = [];
      const heading = h("h2", { tabindex: "-1" }, "Soru");
      const answerButton = h("button", { type: "button", class: "primary", disabled: true }, "Cevapla");
      const options = question.options.map((option) => {
        const input = h("input", { type: multiple ? "checkbox" : "radio", name: `soru-${question.id}` });
        const label = h("label", { class: "option" }, input, h("span", null, option.text));
        input.addEventListener("change", () => {
          chosen = multiple
            ? input.checked ? [...chosen, option.id] : chosen.filter((id) => id !== option.id)
            : [option.id];
          for (const row of options) row.label.classList.toggle("is-chosen", chosen.includes(row.option.id));
          answerButton.disabled = chosen.length === 0;
        });
        return { option, input, label };
      });
      const fieldset = h("fieldset", null, h("legend", { class: "sr-only" }, "Seçenekler"), options.map((row) => row.label));
      const hint = multiple ? h("p", { class: "muted" }, "Birden fazla doğru cevap olabilir.") : null;
      const answerRow = h("div", { class: "actions" }, answerButton);
      const feedback = h("div", { role: "status", hidden: true });

      answerButton.addEventListener("click", () => {
        const expected = question.options.filter((option) => option.correct).map((option) => option.id).sort();
        const picked = [...chosen].sort();
        const correct = picked.length === expected.length && picked.every((id, index) => id === expected[index]);
        recordAnswer(question, picked, correct);
        fieldset.disabled = true;
        for (const row of options) {
          row.label.classList.toggle("is-correct", correct && Boolean(row.option.correct));
          row.label.classList.toggle("is-wrong", !correct && chosen.includes(row.option.id));
        }
        showFeedback(correct);
      });

      function showFeedback(correct) {
        answerRow.hidden = true;
        if (hint) hint.hidden = true;
        const text = correct ? question.feedbackCorrect : question.feedbackWrong;
        const actions = h("div", { class: "actions" });
        if (!correct) {
          actions.append(h("button", { type: "button", onClick: resetAnswer }, "Tekrar dene"));
          if (question.retryFrom != null) {
            actions.append(h("button", { type: "button", onClick: onRewatch }, `İlgili kısmı tekrar izle (${clock(question.retryFrom, true)})`));
          }
        }
        const next = h("button", { type: "button", class: "primary", onClick: onContinue }, "Devam et");
        actions.append(next);
        feedback.className = `feedback ${correct ? "ok" : "bad"}`;
        feedback.replaceChildren(h("strong", null, correct ? "Doğru!" : "Yanlış."), text ? h("p", null, text) : null, actions);
        feedback.hidden = false;
        next.focus({ preventScroll: true });
      }

      function resetAnswer() {
        chosen = [];
        fieldset.disabled = false;
        for (const row of options) {
          row.input.checked = false;
          row.label.classList.remove("is-chosen", "is-correct", "is-wrong");
        }
        answerButton.disabled = true;
        answerRow.hidden = false;
        if (hint) hint.hidden = false;
        feedback.hidden = true;
        feedback.replaceChildren();
      }

      const head = h("div", { class: "card-head" }, heading,
        required ? null : h("button", { type: "button", class: "link", "aria-label": "Soruyu kapat", onClick: onClose }, "✕"));
      const element = h("section", { class: "card overlay-card question-card", role: "dialog", "aria-label": "Soru" },
        head, h("p", { class: "prompt" }, question.prompt), fieldset, hint, answerRow, feedback);
      return { element, focus: heading };
    }

    function popupCard(popup, onContinue) {
      const heading = h("h2", { tabindex: "-1" }, popup.title || "Bilgi");
      const element = h("section", { class: "card overlay-card popup-card", role: "dialog", "aria-label": popup.title || "Bilgi kartı" },
        heading,
        h("p", { class: "popup-body" }, popup.body),
        isSafeLink(popup.link)
          ? h("p", null, h("a", { href: popup.link, target: "_blank", rel: "noopener noreferrer" }, "Bağlantıyı aç ↗"))
          : null,
        h("div", { class: "actions" }, h("button", { type: "button", class: "primary", onClick: onContinue }, "Devam et")));
      return { element, focus: heading };
    }

    function showEnd() {
      if (overlay && overlay.kind === "end") return;
      ended = true;
      saveProgress();
      const questions = engine.questions;
      const answered = questions.filter((q) => results[q.id]).length;
      const firstTry = questions.filter((q) => results[q.id]?.firstTry).length;
      const again = h("button", { type: "button", class: "primary" }, "Baştan izle");
      again.addEventListener("click", () => {
        ended = false;
        setOverlay(null);
        engine.prepareSeek(0);
        seekPlayer(0);
        player.play();
      });
      const summary = questions.length
        ? `${questions.length} sorudan ${answered} tanesini cevapladınız; ${firstTry} tanesini ilk denemede doğru bildiniz.`
        : "İzlediğiniz için teşekkürler.";
      const lmsNote = !lms ? null : completed
        ? "İlerlemeniz kaydedildi; etkinlik tamamlandı."
        : `İlerlemeniz kaydedildi. Etkinliğin tamamlanmış sayılması için videonun en az %${Math.round(COMPLETION_RATIO * 100)}'ını izleyin.`;
      setOverlay({ kind: "end" }, h("section", { class: "card overlay-card end-card" },
        h("h2", { tabindex: "-1" }, "Video bitti"),
        h("p", null, summary),
        lmsNote ? h("p", { class: "muted" }, lmsNote) : null,
        h("div", { class: "actions" }, again)), again);
    }

    function showResume(at) {
      const resume = h("button", { type: "button", class: "primary" }, `${clock(at)} noktasından devam et`);
      const restart = h("button", { type: "button" }, "Baştan başla");
      resume.addEventListener("click", () => {
        setOverlay(null);
        engine.last = at;
        lastTracked = null;
        seekPlayer(at);
        player.play();
        armTapFallback();
      });
      restart.addEventListener("click", () => {
        setOverlay(null);
        seekPlayer(0);
        player.play();
        armTapFallback();
      });
      setOverlay({ kind: "resume" }, h("section", { class: "card overlay-card resume-card" },
        h("h2", { tabindex: "-1" }, "Kaldığınız yerden devam edin"),
        h("p", null, `Bu videoyu daha önce ${clock(at)} noktasına kadar izlemiştiniz.`),
        h("div", { class: "actions" }, resume, restart)), resume);
    }

    // ---------- cevaplar ve LMS ----------

    function recordAnswer(question, picked, correct) {
      const first = !results[question.id];
      results[question.id] = first ? { correct, firstTry: correct } : { ...results[question.id], correct };
      if (lms && first) {
        const prefix = `cmi.interactions.${interactionIndex++}.`;
        lms.set(`${prefix}id`, `soru_${question.id}`.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 255));
        lms.set(`${prefix}type`, "choice");
        lms.set(`${prefix}time`, new Date().toTimeString().slice(0, 8));
        lms.set(`${prefix}correct_responses.0.pattern`, question.options.filter((option) => option.correct).map((option) => option.id).join(","));
        lms.set(`${prefix}student_response`, picked.join(","));
        lms.set(`${prefix}result`, correct ? "correct" : "wrong");
        lms.set(`${prefix}weighting`, "1");
      }
      if (lms) {
        const questions = engine.questions;
        const firstTry = questions.filter((q) => results[q.id]?.firstTry).length;
        lms.set("cmi.core.score.min", "0");
        lms.set("cmi.core.score.max", "100");
        lms.set("cmi.core.score.raw", String(Math.round((firstTry / questions.length) * 100)));
      }
      renderQuestions();
      renderMarkers();
      saveProgress();
    }

    function trackCoverage(t) {
      if (!lms || !duration) return;
      const size = Math.max(1, Math.ceil(duration));
      if (!coverage || coverage.length !== size) {
        const next = new Uint8Array(size);
        if (coverage) next.set(coverage.subarray(0, Math.min(size, coverage.length)));
        coverage = next;
      }
      const previous = lastTracked;
      lastTracked = t;
      const to = Math.min(size - 1, Math.floor(t));
      if (previous === null || t < previous || t - previous > 2) {
        coverage[to] = 1;
        return;
      }
      for (let second = Math.floor(previous); second <= to; second++) coverage[second] = 1;
    }

    function coverageRatio() {
      if (!coverage || !coverage.length) return 0;
      let watched = 0;
      for (const bit of coverage) watched += bit;
      return watched / coverage.length;
    }

    function saveProgress() {
      if (!lms) return;
      lastSave = Date.now();
      lms.set("cmi.core.lesson_location", String(Math.floor(current)));
      const answers = {};
      for (const [id, result] of Object.entries(results)) answers[id] = [result.firstTry ? 1 : 0, result.correct ? 1 : 0];
      const full = JSON.stringify({ v: 1, a: answers, d: [...engine.answered], c: coverage ? packBits(coverage) : "", n: coverage ? coverage.length : 0 });
      lms.set("cmi.suspend_data", full.length <= 4096 ? full : JSON.stringify({ v: 1, a: answers, d: [...engine.answered] }));
      if (!completed && coverageRatio() >= COMPLETION_RATIO) {
        completed = true;
        lms.set("cmi.core.lesson_status", "completed");
      }
      lms.commit();
    }

    function restoreFromLms() {
      const status = lms.get("cmi.core.lesson_status");
      completed = status === "completed" || status === "passed";
      let saved = null;
      try { saved = JSON.parse(lms.get("cmi.suspend_data") || "null"); } catch { saved = null; }
      if (saved && saved.v === 1) {
        for (const [id, pair] of Object.entries(saved.a || {})) results[id] = { firstTry: Boolean(pair[0]), correct: Boolean(pair[1]) };
        for (const id of saved.d || []) engine.answered.add(id);
        if (saved.c && saved.n) coverage = unpackBits(saved.c, saved.n);
      }
      return Number(lms.get("cmi.core.lesson_location")) || 0;
    }
  }

  // ---------- sayfalar ----------

  async function startPreview(root) {
    const id = decodeURIComponent(window.location.pathname.split("/")[2] ?? "");
    const title = h("h1", null, "Önizleme");
    const slot = h("p", { class: "muted" }, "Yükleniyor…");
    const download = (kind, label, hint) => h("a", {
      class: "button", href: `/api/projeler/${encodeURIComponent(id)}/${kind}`, download: "", title: hint
    }, label);
    root.replaceChildren(h("div", { class: "page player-page" },
      h("header", { class: "topbar" },
        h("a", { href: `/duzenle/${encodeURIComponent(id)}`, class: "back" }, "← Editöre dön"),
        title,
        h("span", { class: "muted" }, "İzleyici önizlemesi"),
        download("scorm", "SCORM paketi ↓", "Moodle gibi bir LMS'e yüklenebilen SCORM 1.2 paketi"),
        download("web", "Web sayfası ↓", "Web sitesinde yayınlanabilen tek dosyalık HTML sayfası")),
      slot));
    let project;
    try {
      const response = await fetch(`/api/projeler/${encodeURIComponent(id)}`, { headers: { "X-Haluku": "1" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.hata ?? `Hata (${response.status})`);
      project = body.project;
    } catch (error) {
      const message = error instanceof TypeError
        ? "haluku sunucusuna ulaşılamadı. Claude Desktop açık mı (ya da baslat.bat çalışıyor mu)?"
        : error.message;
      slot.replaceWith(h("div", { class: "alert error", role: "alert" }, message));
      return;
    }
    title.textContent = project.title;
    document.title = `${project.title} · haluku`;
    slot.replaceWith(mountStage(project, null));
  }

  // Dosyaya çift tıklanarak açılan sayfada (file://) YouTube oynatmaz; bunu anlaşılır biçimde söyle.
  function fileNotice(project) {
    const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(project.video.videoId)}`;
    return h("section", { class: "card file-notice" },
      h("h2", null, "Bu sayfa bir web adresinden açılmalı"),
      h("p", null, "YouTube, bilgisayardaki bir dosyaya çift tıklanarak açılan sayfalarda video oynatmıyor (YouTube'un “hata 153” uyarısı bundan kaynaklanır). Aynı dosya bir web adresinden açıldığında çalışır:"),
      h("ul", null,
        h("li", null, "LMS'te (Moodle vb.): SCORM paketini SCORM etkinliği olarak yükleyin."),
        h("li", null, "Web'de: web sayfası dosyasını kurumunuzun web sunucusuna ya da GitHub Pages, Netlify gibi bir barındırma hizmetine yükleyip bağlantısını paylaşın; başka bir sayfaya iframe ile de gömebilirsiniz."),
        h("li", null, "Kendi bilgisayarınızda denemek için haluku editöründeki “Önizle” düğmesini kullanın.")),
      h("p", null, h("a", { href: watch, target: "_blank", rel: "noopener noreferrer" }, "Videoyu YouTube'da aç ↗")));
  }

  function startPackage(root, project) {
    document.title = project.title || "haluku";
    const header = h("header", { class: "topbar" }, h("h1", null, project.title || ""));
    if (window.location.protocol === "file:") {
      root.replaceChildren(h("div", { class: "page player-page is-package" }, header, fileNotice(project)));
      return;
    }
    const lms = scorm.init() ? scorm : null;
    root.replaceChildren(h("div", { class: "page player-page is-package" }, header, mountStage(project, lms)));
  }

  const root = document.getElementById("app");
  if (PACKAGED) startPackage(root, window.HALUKU_PROJE);
  else startPreview(root);
})();
