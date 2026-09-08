/* ============================================================
   Çöz-Öğren — çalışma zamanı motoru
   Veri: window.EO_DATA (data.js)   Çizim: EO.mount(data, root, opts)
   ============================================================ */
(function (global) {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Oyunlaştırma ayarları
  var ROZET_PUANI = 25;              // her rozetin getirdiği puan
  var SERI_ESIGI = 5;                // "İstikrar" rozeti için üst üste doğru sayısı
  var SERI_GOSTERIM_ESIGI = 2;       // seri çipinin görünmeye başladığı sayı
  var YUKSEK_BASARI = 0.85;          // "hatasıza yakın" dönütü eşiği
  var ORTA_BASARI = 0.6;             // "tamamladınız" dönütü eşiği
  var YUKSEK_SKOR = 80;              // sonuç halkasının altına döndüğü yüzde

  // Bildirim süreleri (ms)
  var ROZET_GOSTERIM = 5000;
  var ROZET_KISA_GOSTERIM = 2200;
  var ROZET_ACELE = 1400;
  var ROZET_GECIS = 400;

  var KIND_LABEL = {
    cards: 'Kart destesi',
    quiz: 'Test',
    crossword: 'Bulmaca',
    match: 'Eşleştirme',
    study: 'Dene-Öğren'
  };

  // ---------- yardımcılar ----------
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /** Yazar metinlerinde <strong>, <em>, <br> gibi basit etiketlere izin verilir. */
  function rich(s) {
    return esc(s).replace(/&lt;(\/?)(b|i|u|strong|em|br|span|sup|sub|mark|small)((\s|\/)[^&]*?)?&gt;/gi,
      function (m) { return m.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('eo:' + k) || 'null');
      localStorage.setItem('eo:' + k, JSON.stringify(v));
    } catch (e) { /* depolama kapalıysa ilerleme yalnızca oturumda tutulur */ }
    return null;
  }

  /** FNV-1a: kısa, çakışması düşük bir imza üretir. */
  function hash32(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  /**
   * İlerleme/rozet anahtarı. Aynı paket yeniden açıldığında öğrenci kaldığı
   * yerden devam etsin diye içeriğe göre belirlenir; farklı bir paket ise
   * başlıkları aynı olsa bile ayrı bir alan kullanır.
   */
  function courseKey(data) {
    var meta = data.meta || {};
    var sig = (meta.title || '') + '|' + (meta.subtitle || '') + '|';
    (data.lessons || []).forEach(function (l) {
      sig += (l.kind || '') + ':' + (l.title || '') + '[';
      (l.activities || []).forEach(function (a) {
        sig += (a.title || '') + '#' + ((a.items || []).length) + ';';
      });
      sig += ']';
    });
    return 'prog:' + (meta.id ? meta.id + ':' : '') + hash32(sig);
  }

  /* ---------- Yeniden boyutlanma ----------
     Etkinlikler her bölüm geçişinde yeniden çizildiği için, her çizimde
     window'a dinleyici eklemek onları biriktirir ve kopmuş DOM'u canlı tutar.
     Tek bir dinleyici tutup abone listesini her çizimde sıfırlıyoruz. */
  var boyutAboneleri = [];
  var boyutBagli = false, boyutTimer = null;

  function onResize(fn) {
    boyutAboneleri.push(fn);
    if (boyutBagli) return;
    boyutBagli = true;
    window.addEventListener('resize', function () {
      clearTimeout(boyutTimer);
      boyutTimer = setTimeout(function () {
        boyutAboneleri.slice().forEach(function (f) {
          try { f(); } catch (e) { /* kopmuş bileşen */ }
        });
      }, 140);
    });
  }
  function boyutAbonelikleriniTemizle() { boyutAboneleri.length = 0; }

  /* ---------- Tema ---------- */
  var TEMA_ICON = {
    dark: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    light: '<path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4z"/>'
  };

  function sistemKaranlik() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }

  /** Seçilen temayı belgeye uygular. mod: 'light' | 'dark' | 'auto' */
  function temaUygula(mod) {
    var etkin = mod === 'auto' ? (sistemKaranlik() ? 'dark' : 'light') : mod;
    document.documentElement.setAttribute('data-theme', etkin);
    return etkin;
  }

  function temaOku() {
    var kayit = store('tema');
    if (kayit === 'light' || kayit === 'dark') return kayit;
    // Gömülü önizlemede tema dışarıdan verilebilir
    if (global.EO_TEMA === 'light' || global.EO_TEMA === 'dark') return global.EO_TEMA;
    return 'auto';
  }

  // Kullanıcı seçim yapmadıysa sistem tercihini izle
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var dinle = function () { if (temaOku() === 'auto') temaUygula('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', dinle);
    else if (mq.addListener) mq.addListener(dinle);
  } catch (e) { /* eski tarayıcı */ }

  // ============================================================
  // Oyunlaştırma: puan, seviye, rozet
  // ============================================================
  var LEVELS = [
    { min: 0, name: 'Başlangıç', mark: 'I' },
    { min: 120, name: 'Öğrenen', mark: 'II' },
    { min: 300, name: 'Uygulayan', mark: 'III' },
    { min: 540, name: 'Yetkin', mark: 'IV' },
    { min: 850, name: 'Uzman', mark: 'V' }
  ];

  var ICONS = {
    step: '<path d="M12 3l2.6 5.5 6 .9-4.3 4.3 1 6L12 17l-5.3 2.7 1-6L3.4 9.4l6-.9z"/>',
    cards: '<rect x="3" y="6" width="12" height="14" rx="1.5"/><path d="M8 4h11a1.5 1.5 0 0 1 1.5 1.5V17"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.4l2.6 2.6 4.6-5.4"/>',
    puzzle: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    match: '<path d="M10 14a4 4 0 0 1 0-5.7l2-2a4 4 0 0 1 5.7 5.7l-1 1"/><path d="M14 10a4 4 0 0 1 0 5.7l-2 2a4 4 0 0 1-5.7-5.7l1-1"/>',
    streak: '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-1.7.7-3.2 1.6-4.4.3 1.4 1.1 2.2 2 2.2 1.4 0 1.4-2.6 1.4-6.8z"/>',
    perfect: '<path d="M5 4h14v9a7 7 0 0 1-14 0z"/><path d="M9 21h6M12 20v-4"/>',
    crown: '<path d="M4 8l4 3.5L12 5l4 6.5L20 8l-1.5 11h-13z"/>'
  };

  var BADGES = [
    { id: 'ilk-adim', icon: 'step', name: 'İlk Adım', desc: 'İlk etkinliği tamamladınız.' },
    { id: 'kart-ustasi', icon: 'cards', name: 'Kavram Ustası', desc: 'Tüm kart destelerini bitirdiniz.' },
    { id: 'test-tamam', icon: 'quiz', name: 'Sınav Disiplini', desc: 'Tüm testleri tamamladınız.' },
    { id: 'bulmaca', icon: 'puzzle', name: 'Çözümleyici', desc: 'Bir bulmacayı tamamen çözdünüz.' },
    { id: 'eslestirme', icon: 'match', name: 'Bağlantı Kuran', desc: 'Bir eşleştirmenin tamamını doğru yaptınız.' },
    { id: 'seri', icon: 'streak', name: 'İstikrar', desc: 'Bir testte üst üste 5 doğru yanıt verdiniz.' },
    { id: 'kusursuz', icon: 'perfect', name: 'Kusursuz', desc: 'Bir testi hatasız tamamladınız.' },
    { id: 'set-tamam', icon: 'crown', name: 'Set Tamamlandı', desc: 'Tüm bölümleri bitirdiniz.' }
  ];

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function levelOf(points) {
    var lv = LEVELS[0], i;
    for (i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) lv = LEVELS[i];
    var next = LEVELS[LEVELS.indexOf(lv) + 1] || null;
    return { level: lv, next: next, index: LEVELS.indexOf(lv) };
  }

  function trNum(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Etkinlik tipine göre kazanılan puanı hesaplar. */
  function pointsFor(kind, score) {
    var base = { cards: 20, quiz: 30, crossword: 35, match: 25, study: 30 }[kind] || 20;
    return Math.round(base + base * (typeof score === 'number' ? Math.max(0, Math.min(1, score)) : 0));
  }


  // ============================================================
  // Çoktan seçmeli soru arayüzü
  // Hem Yanıtla-Öğren hem Dene-Öğren aynı bileşeni kullanır.
  // ============================================================

  /** Şıkların gösterim sırasını karıştırır; doğru yanıt hep aynı harfte olmasın. */
  function sirayiKaristir(soru) {
    return shuffle((soru.options || []).map(function (_, i) { return i; }));
  }
  function tumSiralar(sorular) {
    return sorular.map(sirayiKaristir);
  }

  /**
   * Şık listesini çizer.
   * @param {object} ayar - soru, sira, secili, kilitli, verilenYanit, secildi
   */
  function seceneklerCiz(ayar) {
    var kutu = el('div', 'eo-options');
    ayar.sira.forEach(function (gercek, gosterim) {
      var dugme = el('button', 'eo-opt');
      dugme.type = 'button';
      dugme.innerHTML = '<span class="eo-bubble">' + (LETTERS[gosterim] || gosterim + 1) + '</span>' +
        '<span>' + rich((ayar.soru.options || [])[gercek]) + '</span>';

      if (ayar.kilitli) {
        dugme.disabled = true;
        if (gercek === ayar.soru.answer) dugme.classList.add('is-ok');
        else if (gercek === ayar.verilenYanit) dugme.classList.add('is-no');
      } else if (ayar.secili === gercek) {
        dugme.classList.add('is-picked');
        dugme.setAttribute('aria-pressed', 'true');
      }

      dugme.addEventListener('click', function () {
        if (ayar.kilitli) return;
        ayar.secildi(ayar.secili === gercek ? null : gercek);   // aynı şıkka basınca seçim kalkar
      });
      kutu.appendChild(dugme);
    });
    return kutu;
  }

  /** Yanıt onaylandıktan sonra gösterilen geri bildirim kutusu. */
  function donutCiz(soru, verilenYanit, sira) {
    var dogruMu = verilenYanit === soru.answer;
    var kutu = el('div', 'eo-feedback ' + (dogruMu ? 'is-ok' : 'is-no'));
    kutu.appendChild(el('div', 'eo-fb-title', dogruMu
      ? 'Tebrikler, yanıtınız doğru!'
      : 'Yanıtınız yanlış! Doğru yanıt: ' + (LETTERS[sira.indexOf(soru.answer)] || '')));
    kutu.appendChild(el('div', '', rich(soru.explanation || (dogruMu
      ? 'Doğru seçeneği işaretlediniz.'
      : 'Doğru seçenek yukarıda yeşille gösterilmiştir.'))));
    return kutu;
  }

  /** "Yanıtı onayla" düğmesi; seçim yoksa kilitli olur. */
  function onayDugmesi(secili, onaylandi) {
    var dugme = el('button', 'eo-btn accent', 'Yanıtı onayla');
    dugme.type = 'button';
    dugme.disabled = secili == null;
    dugme.addEventListener('click', function () {
      if (secili != null) onaylandi(secili);
    });
    return dugme;
  }

  // ---------- 1) Tıkla-Öğren ----------
  function renderCards(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = act.items || [];
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu destede henüz kart yok.')); return; }

    var grid = el('div', 'eo-cards');
    var flipped = 0;
    var buttons = [];

    items.forEach(function (it, i) {
      var btn = el('button', 'eo-card');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        '<div class="eo-card-inner">' +
          '<div class="eo-face eo-face-front">' +
            '<span class="eo-card-idx">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="eo-term">' + rich(it.term) + '</span>' +
            '<span class="eo-hint">açıklama için tıklayın</span>' +
          '</div>' +
          '<div class="eo-face eo-face-back"><p>' + rich(it.definition) + '</p></div>' +
        '</div>';
      btn.addEventListener('click', function () {
        var now = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', now ? 'false' : 'true');
        if (!now && !btn.dataset.seen) { btn.dataset.seen = '1'; flipped++; count(); }
      });
      buttons.push(btn);
      grid.appendChild(btn);
    });

    var bar = el('div', 'eo-actions');
    var meta = el('span', 'eo-counter');
    var flipAll = el('button', 'eo-btn ghost sm', 'Tümünü çevir');
    var reset = el('button', 'eo-btn ghost sm', 'Baştan');
    flipAll.type = reset.type = 'button';

    flipAll.addEventListener('click', function () {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', 'true');
        if (!b.dataset.seen) { b.dataset.seen = '1'; flipped++; }
      });
      count();
    });
    reset.addEventListener('click', function () {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); delete b.dataset.seen; });
      flipped = 0; count();
    });

    function count() {
      meta.innerHTML = '<b>' + flipped + '</b> / ' + items.length + ' kart görüldü';
      if (flipped >= items.length) done(1);
    }
    count();

    bar.appendChild(meta);
    bar.appendChild(el('span', 'eo-spacer'));
    bar.appendChild(reset);
    bar.appendChild(flipAll);

    host.appendChild(grid);
    host.appendChild(bar);
  }

  // ---------- 2) Yanıtla-Öğren ----------
  function renderQuiz(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (q) { return q && q.question; });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu testte henüz soru yok.')); return; }

    var idx = 0;
    var answers = new Array(items.length).fill(null);
    var picked = null;                       // onaylanmamış seçim (gerçek şık sırası)
    var streak = 0;
    var siralar = tumSiralar(items);
    var stage = el('div');
    host.appendChild(stage);

    function rail() {
      var r = el('div', 'eo-rail');
      items.forEach(function (_, i) {
        var d = el('span', 'eo-dot');
        if (answers[i] != null) d.classList.add(answers[i] === items[i].answer ? 'is-ok' : 'is-no');
        if (i === idx) d.classList.add('is-current');
        r.appendChild(d);
      });
      return r;
    }

    function drawQuestion() {
      stage.innerHTML = '';
      var q = items[idx];

      var top = el('div', 'eo-quiz-top');
      top.appendChild(el('span', 'eo-counter', '<b>' + (idx + 1) + '</b> / ' + items.length + ' soru'));
      if (streak >= SERI_GOSTERIM_ESIGI) top.appendChild(el('span', 'eo-streak', 'üst üste ' + streak + ' doğru'));
      top.appendChild(el('span', 'eo-spacer'));
      top.appendChild(rail());
      stage.appendChild(top);

      stage.appendChild(el('p', 'eo-qtext', rich(q.question)));

      var locked = answers[idx] != null;
      var sira = siralar[idx];
      stage.appendChild(seceneklerCiz({
        soru: q, sira: sira, secili: picked, kilitli: locked, verilenYanit: answers[idx],
        secildi: function (yeni) { picked = yeni; drawQuestion(); }
      }));

      if (locked) stage.appendChild(donutCiz(q, answers[idx], sira));

      var bar = el('div', 'eo-actions');
      var prev = el('button', 'eo-btn ghost sm', '← Önceki');
      prev.type = 'button';
      prev.disabled = idx === 0;
      prev.addEventListener('click', function () { idx--; picked = null; drawQuestion(); });
      bar.appendChild(prev);
      bar.appendChild(el('span', 'eo-spacer'));

      if (!locked) {
        bar.appendChild(onayDugmesi(picked, function (yanit) {
          answers[idx] = yanit;
          if (yanit === q.answer) {
            streak++;
            if (streak >= SERI_ESIGI && opts_ctx.award) opts_ctx.award('seri');
          } else { streak = 0; }
          picked = null;
          drawQuestion();
        }));
      } else {
        var next = el('button', 'eo-btn', idx === items.length - 1 ? 'Sonucu gör' : 'Sonraki →');
        next.type = 'button';
        next.addEventListener('click', function () {
          if (idx === items.length - 1) drawResult();
          else { idx++; picked = null; drawQuestion(); }
        });
        bar.appendChild(next);
      }
      stage.appendChild(bar);
    }

    function drawResult() {
      stage.innerHTML = '';
      var correct = answers.filter(function (a, i) { return a === items[i].answer; }).length;
      var pct = Math.round(correct / items.length * 100);
      done(correct / items.length);
      if (pct === 100 && opts_ctx.award) opts_ctx.award('kusursuz');

      var box = el('div', 'eo-result');
      var ring = el('div', 'eo-score-ring' + (pct >= YUKSEK_SKOR ? ' is-high' : ''), '<span>%' + pct + '</span>');
      ring.style.setProperty('--pct', pct + '%');
      box.appendChild(ring);
      box.appendChild(el('h4', '', items.length + ' sorudan ' + correct + ' doğru'));
      box.appendChild(el('p', '', pct >= YUKSEK_SKOR ? 'Konuya hâkimsiniz. Yanlış yanıtladığınız soruların açıklamalarını gözden geçirip diğer etkinliklere geçebilirsiniz.'
        : pct >= 50 ? 'İyi bir başlangıç. Aşağıdaki listeden yanlış yanıtlarınızı inceleyip testi yeniden çözün.'
        : 'Konuyu Dene-Öğren modülünden tekrar edip testi yeniden çözmenizi öneririz.'));

      var review = el('div', 'eo-review');
      items.forEach(function (q, i) {
        var ok = answers[i] === q.answer;
        var row = el('div', 'eo-review-item ' + (ok ? 'ok' : 'no'));
        row.appendChild(el('span', 'eo-mark', ok ? '✓' : '✕'));
        var body = el('div');
        body.appendChild(el('div', '', rich(q.question)));
        body.appendChild(el('small', '', 'Doğru yanıt: ' +
          (LETTERS[siralar[i].indexOf(q.answer)] || '') + ') ' + esc((q.options || [])[q.answer] || '')));
        row.appendChild(body);
        review.appendChild(row);
      });
      box.appendChild(review);

      var bar = el('div', 'eo-actions');
      bar.appendChild(el('span', 'eo-spacer'));
      var again = el('button', 'eo-btn accent', 'Testi yeniden çöz');
      again.type = 'button';
      again.addEventListener('click', function () {
        answers = new Array(items.length).fill(null);
        siralar = tumSiralar(items);          // yeniden çözerken sıra da yeniden karışır
        idx = 0; streak = 0; picked = null; drawQuestion();
      });
      bar.appendChild(again);
      bar.appendChild(el('span', 'eo-spacer'));
      box.appendChild(bar);

      stage.appendChild(box);
    }

    drawQuestion();
  }

  // ---------- 3) Bul-Öğren ----------
  function renderCrossword(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (w) { return w && w.answer && w.clue; });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu bulmacada henüz kelime yok.')); return; }

    var board = el('div');
    host.appendChild(board);
    var api = global.EOCrossword.render(board, items);

    var msg = el('div');
    host.appendChild(msg);

    var bar = el('div', 'eo-actions');
    var status = el('span', 'eo-counter', api.model.placed.length + ' kelime');
    var check = el('button', 'eo-btn accent', 'Kontrol et');
    var reveal = el('button', 'eo-btn ghost sm', 'Çözümü göster');
    var clear = el('button', 'eo-btn ghost sm', 'Temizle');
    check.type = reveal.type = clear.type = 'button';
    // Yardım düğmeleri ilk denemeden önce görünmez; önce öğrenci denesin
    reveal.style.display = clear.style.display = 'none';

    check.addEventListener('click', function () {
      var r = api.check();
      status.innerHTML = '<b>' + r.solvedWords + '</b> / ' + r.words + ' kelime doğru';
      msg.innerHTML = '';
      if (r.cells.solved) {
        msg.appendChild(el('div', 'eo-cwdone', 'Tebrikler, bulmacayı tamamladınız!'));
        reveal.style.display = clear.style.display = 'none';
        done(1);
      } else {
        reveal.style.display = clear.style.display = '';
        msg.appendChild(el('div', 'eo-hintline', r.cells.filled < r.cells.total
          ? 'Boş kalan hücreler var. Doğru harfler yeşil, yanlışlar kırmızı işaretlendi.'
          : 'Yanlış harfler kırmızı işaretlendi; düzeltip yeniden kontrol edin.'));
      }
    });
    reveal.addEventListener('click', function () {
      api.reveal();
      status.textContent = 'Çözüm gösterildi';
      msg.innerHTML = '';
      done(0);
    });
    clear.addEventListener('click', function () {
      api.clear();
      status.textContent = api.model.placed.length + ' kelime';
      msg.innerHTML = '';
    });

    bar.appendChild(status);
    bar.appendChild(el('span', 'eo-spacer'));
    bar.appendChild(clear);
    bar.appendChild(reveal);
    bar.appendChild(check);
    host.appendChild(bar);

    if (api && api.model && api.model.skipped.length) {
      host.appendChild(el('p', 'eo-hintline',
        'Bağlantı kurulamadığı için eklenmeyen kelimeler: ' + api.model.skipped.map(esc).join(', ')));
    }
  }

  // ---------- 4) Eşleştir-Öğren ----------

  /** Sürüklenebilir açıklama çipi. Tıklama davranışı çağırana bırakılır. */
  function acikllamaCipiOlustur(item, sira, tiklandi, secimiVer) {
    var cip = el('button', 'eo-chip');
    cip.type = 'button';
    cip.draggable = true;
    cip.dataset.id = sira;
    cip.innerHTML = rich(item.definition);

    cip.addEventListener('click', function () { tiklandi(cip); });
    cip.addEventListener('dragstart', function (e) {
      secimiVer(cip);
      cip.classList.add('is-dragging');
      try { e.dataTransfer.setData('text/plain', String(sira)); } catch (err) { /* eski tarayıcı */ }
      e.dataTransfer.effectAllowed = 'move';
    });
    cip.addEventListener('dragend', function () { cip.classList.remove('is-dragging'); });
    return cip;
  }

  function renderMatch(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (p) { return p && p.term && p.definition; });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu etkinlikte henüz eşleştirme yok.')); return; }

    var yonerge = el('p', 'eo-hintline', '');
    host.appendChild(yonerge);

    var wrap = el('div', 'eo-match');
    var leftCol = el('div', 'eo-match-col eo-match-pool');
    leftCol.appendChild(el('h4', '', 'Açıklamalar'));
    var pool = el('div', 'eo-pool');
    leftCol.appendChild(pool);

    var rightCol = el('div', 'eo-match-col');
    var sagBaslik = el('h4', '', 'Kavramlar');
    rightCol.appendChild(sagBaslik);
    var slots = el('div', 'eo-pool');
    rightCol.appendChild(slots);

    wrap.appendChild(leftCol);
    wrap.appendChild(rightCol);
    host.appendChild(wrap);

    var selected = null;
    var acikSlot = null;      // dar ekranda açıklama listesinin açıldığı kutu

    /** Dar ekranda iki sütun arasında gidip gelmek yerine liste kutunun altında açılır. */
    function darMi() { return wrap.clientWidth < 620; }
    function bosMetin() { return darMi() ? 'dokunun, açıklamalar açılsın' : 'buraya bırakın'; }
    function bosMetinleriTazele() {
      drops.forEach(function (d) {
        if (d.drop.dataset.filled == null) d.drop.textContent = bosMetin();
      });
    }

    function listeyiKapat() {
      if (!acikSlot) return;
      leftCol.appendChild(pool);
      acikSlot.classList.remove('is-open');
      acikSlot = null;
      wrap.classList.remove('is-picking');
    }

    function listeyiAc(slot) {
      if (acikSlot === slot) { listeyiKapat(); return; }
      listeyiKapat();
      if (!pool.children.length) return;
      acikSlot = slot;
      slot.appendChild(pool);
      slot.classList.add('is-open');
      wrap.classList.add('is-picking');
      pool.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function makeChip(item, i) {
      return acikllamaCipiOlustur(item, i, function (cip) {
        if (acikSlot && acikSlot._yerlestir) {          // dar ekran: seçilen açıklama doğrudan kutuya
          selected = cip;
          acikSlot._yerlestir(cip);
          return;
        }
        if (selected === cip) { cip.classList.remove('is-selected'); selected = null; return; }
        if (selected) selected.classList.remove('is-selected');
        selected = cip; cip.classList.add('is-selected');
      }, function (cip) { selected = cip; });
    }

    shuffle(items.map(function (it, i) { return { it: it, i: i }; }))
      .forEach(function (o) { pool.appendChild(makeChip(o.it, o.i)); });

    var drops = [];

    /** Bir kavram kutusu: başlık + bırakma alanı + yerleştirme davranışı. */
    function kavramKutusuOlustur(item, i) {
      var slot = el('div', 'eo-slot');
      slot.appendChild(el('div', 'eo-slot-term', rich(item.term)));
      var drop = el('div', 'eo-drop', bosMetin());
      drop.dataset.id = i;
      drop.tabIndex = 0;

      function place(chip) {
        if (!chip) return;
        if (drop.dataset.filled) returnChip(drop);
        drop.textContent = '';
        drop.appendChild(chip);
        chip.classList.remove('is-selected');
        drop.dataset.filled = chip.dataset.id;
        drop.classList.add('filled');
        selected = null;
        slot.classList.remove('is-ok', 'is-no');
        listeyiKapat();
        update();
      }
      slot._yerlestir = place;
      function onActivate() {
        if (drop.dataset.filled) { returnChip(drop); return; }
        if (selected && !darMi()) { place(selected); return; }
        if (darMi()) { listeyiAc(slot); return; }
        if (selected) place(selected);
      }
      drop.addEventListener('click', onActivate);
      drop.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('is-over');
        place(selected);
      });

      slot.appendChild(drop);
      slots.appendChild(slot);
      drops.push({ drop: drop, slot: slot, id: i });
    }

    items.forEach(kavramKutusuOlustur);

    function returnChip(drop) {
      var chip = drop.querySelector('.eo-chip');
      if (chip) { chip.classList.remove('is-selected'); pool.appendChild(chip); }
      drop.textContent = bosMetin();
      delete drop.dataset.filled;
      drop.classList.remove('filled');
      drop.parentElement.classList.remove('is-ok', 'is-no');
      update();
    }

    var status = el('span', 'eo-counter');
    var wrongTries = 0;
    function update() {
      var filled = drops.filter(function (d) { return d.drop.dataset.filled != null; }).length;
      status.innerHTML = '<b>' + filled + '</b> / ' + items.length + ' eşleştirildi';
      check.disabled = filled !== items.length;
      wrap.classList.toggle('is-dar', darMi());
      if (!pool.children.length) listeyiKapat();
    }
    onResize(function () { listeyiKapat(); update(); bosMetinleriTazele(); yonergeYaz(); });

    var bar = el('div', 'eo-actions');
    var reset = el('button', 'eo-btn ghost sm', 'Baştan');
    var reveal = el('button', 'eo-btn ghost sm', 'Çözümü göster');
    var check = el('button', 'eo-btn accent sm', 'Eşleştirmeleri kontrol et');
    reset.type = check.type = reveal.type = 'button';
    reveal.style.display = 'none';        // iki yanlış denemeden sonra açılır

    check.addEventListener('click', function () {
      var ok = 0;
      drops.forEach(function (d) {
        var correct = d.drop.dataset.filled === String(d.id);
        d.slot.classList.toggle('is-ok', correct);
        d.slot.classList.toggle('is-no', !correct);
        if (correct) ok++;
      });
      if (ok === items.length) {
        status.innerHTML = '<b>' + ok + '</b> / ' + items.length + ' doğru — tamamlandı';
        reveal.style.display = 'none';
        done(1);
        return;
      }
      wrongTries++;
      status.innerHTML = '<b>' + ok + '</b> / ' + items.length + ' doğru' +
        (wrongTries < 2 ? ' — yanlışları düzeltip yeniden deneyin' : '');
      if (wrongTries >= 2) reveal.style.display = '';
    });

    reveal.addEventListener('click', function () {
      // Her açıklamayı doğru kavramın kutusuna yerleştirir
      drops.forEach(function (d) {
        if (d.drop.dataset.filled != null) returnChip(d.drop);
      });
      drops.forEach(function (d) {
        var chip = pool.querySelector('.eo-chip[data-id="' + d.id + '"]');
        if (!chip) return;
        d.drop.textContent = '';
        d.drop.appendChild(chip);
        d.drop.dataset.filled = String(d.id);
        d.drop.classList.add('filled');
        d.slot.classList.add('is-ok');
        d.slot.classList.remove('is-no');
      });
      status.textContent = 'Çözüm gösterildi';
      reveal.style.display = 'none';
      check.disabled = true;
      done(0);
    });

    reset.addEventListener('click', function () {
      listeyiKapat();
      drops.forEach(function (d) { if (d.drop.dataset.filled != null) returnChip(d.drop); });
      Array.prototype.slice.call(pool.children).forEach(function (c) { c.classList.remove('is-selected'); });
      selected = null;
      update();
    });

    bar.appendChild(status);
    bar.appendChild(el('span', 'eo-spacer'));
    bar.appendChild(reset);
    bar.appendChild(reveal);
    bar.appendChild(check);
    host.appendChild(bar);

    function yonergeYaz() {
      yonerge.textContent = darMi()
        ? 'Kavramın altındaki alana dokunun; açıklamalar orada açılır ve seçtiğinizi yerleştirir.'
        : 'Açıklamayı seçip karşısındaki kavram kutusuna tıklayın; sürükleyip bırakabilirsiniz de.';
    }
    yonergeYaz();
    bosMetinleriTazele();
    update();
  }

  // ---------- 5) Dene-Öğren ----------
  function renderStudy(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (m) { return m && (m.title || m.theory); });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu modülde henüz bölüm yok.')); return; }

    var idx = 0;
    var answers = new Array(items.length).fill(null);
    var picked = null;                       // onaylanmamış seçim (gerçek şık sırası)
    var siralar = tumSiralar(items);
    var stage = el('div', 'eo-study');
    host.appendChild(stage);

    function draw() {
      stage.innerHTML = '';
      if (idx >= items.length) return drawDone();
      var m = items[idx];

      var nav = el('div', 'eo-study-nav');
      items.forEach(function (x, i) {
        var s = el('button', 'eo-step', String(i + 1).padStart(2, '0'));
        s.type = 'button';
        if (i === idx) s.setAttribute('aria-current', 'true');
        if (answers[i] != null) s.classList.add('done');
        s.addEventListener('click', function () { idx = i; picked = null; draw(); });
        nav.appendChild(s);
      });
      stage.appendChild(nav);

      if (m.category) stage.appendChild(el('div', 'eo-cat', esc(m.category)));
      stage.appendChild(el('h4', '', rich(m.title)));
      if (m.theory) stage.appendChild(el('p', 'eo-theory', rich(m.theory)));

      if (m.keyPoints && m.keyPoints.length) {
        var ul = el('ul', 'eo-keys');
        m.keyPoints.forEach(function (k, i) {
          var li = el('li', '', rich(k));
          li.setAttribute('data-n', String(i + 1).padStart(2, '0'));
          ul.appendChild(li);
        });
        stage.appendChild(ul);
      }

      if (m.question) {
        var qb = el('div', 'eo-quizbox');
        qb.appendChild(el('div', 'eo-qlabel', 'Kontrol sorusu'));
        qb.appendChild(el('p', 'eo-qtext', rich(m.question)));
        var locked = answers[idx] != null;
        var sira = siralar[idx];
        qb.appendChild(seceneklerCiz({
          soru: m, sira: sira, secili: picked, kilitli: locked, verilenYanit: answers[idx],
          secildi: function (yeni) { picked = yeni; draw(); }
        }));

        if (locked) qb.appendChild(donutCiz(m, answers[idx], sira));
        stage.appendChild(qb);
      }

      var bar = el('div', 'eo-actions');
      var prev = el('button', 'eo-btn ghost sm', '← Önceki');
      prev.type = 'button'; prev.disabled = idx === 0;
      prev.addEventListener('click', function () { idx--; picked = null; draw(); });
      bar.appendChild(prev);
      bar.appendChild(el('span', 'eo-spacer'));

      if (m.question && answers[idx] == null) {
        bar.appendChild(onayDugmesi(picked, function (yanit) {
          answers[idx] = yanit; picked = null; draw();
        }));
      } else {
        var next = el('button', 'eo-btn', idx === items.length - 1 ? 'Modülü bitir' : 'Sonraki bölüm →');
        next.type = 'button';
        next.addEventListener('click', function () { idx++; picked = null; draw(); });
        bar.appendChild(next);
      }
      stage.appendChild(bar);
    }

    function drawDone() {
      var withQ = items.filter(function (m) { return !!m.question; });
      var correct = items.filter(function (m, i) { return m.question && answers[i] === m.answer; }).length;
      done(withQ.length ? correct / withQ.length : 1);
      stage.innerHTML = '';
      var d = el('div', 'eo-done');
      d.appendChild(el('div', 'eo-stamp', '✓'));
      d.appendChild(el('h4', '', 'Modül tamamlandı'));
      d.appendChild(el('p', '', withQ.length
        ? items.length + ' bölümü bitirdiniz, ' + withQ.length + ' kontrol sorusundan ' + correct + ' tanesini doğru yanıtladınız.'
        : items.length + ' bölümü bitirdiniz.'));
      var bar = el('div', 'eo-actions');
      bar.appendChild(el('span', 'eo-spacer'));
      var again = el('button', 'eo-btn accent', 'Baştan başla');
      again.type = 'button';
      again.addEventListener('click', function () {
        idx = 0; picked = null; answers = new Array(items.length).fill(null);
        siralar = tumSiralar(items);
        draw();
      });
      bar.appendChild(again);
      bar.appendChild(el('span', 'eo-spacer'));
      d.appendChild(bar);
      stage.appendChild(d);
    }

    draw();
  }

  var RENDERERS = {
    cards: renderCards,
    quiz: renderQuiz,
    crossword: renderCrossword,
    match: renderMatch,
    study: renderStudy
  };


  /**
   * Öğrencinin ilerleme, puan ve rozet verisi. Yalnızca durumu tutar ve
   * saklar; çizimden haberi yoktur. Değişiklikte `degisti` geri çağrısını
   * tetikler, rozet kazanıldığında `rozetKazanildi` çağrılır.
   */
  function oyunDurumu(data, lessons, geriCagri) {
    var anahtar = courseKey(data);
    var kayit = store(anahtar) || {};
    var tamamlanan = kayit.done || kayit;            // eski biçimle uyum
    if (typeof tamamlanan !== 'object' || tamamlanan === null) tamamlanan = {};

    var durum = {
      puan: kayit.points || 0,
      rozetler: kayit.badges || {},
      etkinlikPuani: kayit.pts || {},
      toplamEtkinlik: 0
    };

    lessons.forEach(function (ders) {
      (ders.activities || []).forEach(function (etkinlik) {
        if ((etkinlik.items || []).length) durum.toplamEtkinlik++;
      });
    });

    function sakla() {
      store(anahtar, {
        done: tamamlanan, points: durum.puan,
        badges: durum.rozetler, pts: durum.etkinlikPuani
      });
    }

    function tamamlandiMi(anahtarAdi) { return !!tamamlanan[anahtarAdi]; }
    function tamamlananSayisi() { return Object.keys(tamamlanan).length; }
    function yuzde() {
      return durum.toplamEtkinlik ? Math.round(tamamlananSayisi() / durum.toplamEtkinlik * 100) : 0;
    }

    /** Bir bölümün kaç etkinliğinin bittiğini döndürür. */
    function dersDurumu(dersSirasi, ders) {
      var dolular = (ders.activities || []).filter(function (a) { return (a.items || []).length; });
      var biten = dolular.filter(function (_, i) { return tamamlandiMi(dersSirasi + ':' + i); }).length;
      return { toplam: dolular.length, biten: biten, bitti: dolular.length > 0 && biten >= dolular.length };
    }

    function rozetVer(id) {
      if (durum.rozetler[id]) return;
      var rozet = BADGES.filter(function (x) { return x.id === id; })[0];
      if (!rozet) return;
      durum.rozetler[id] = Date.now();
      durum.puan += ROZET_PUANI;
      sakla();
      if (geriCagri.rozetKazanildi) geriCagri.rozetKazanildi(rozet, id);
    }

    /** Bölüm ve set bitişi gibi eşiklerde kazanılan rozetler. */
    function esikleriDenetle() {
      if (durum.toplamEtkinlik > 0 && tamamlananSayisi() >= durum.toplamEtkinlik) rozetVer('set-tamam');
      lessons.forEach(function (ders, i) {
        if (!dersDurumu(i, ders).bitti) return;
        if (ders.kind === 'cards') rozetVer('kart-ustasi');
        if (ders.kind === 'quiz') rozetVer('test-tamam');
      });
    }

    function etkinligiBitir(anahtarAdi, puan, tur, basari) {
      if (tamamlanan[anahtarAdi]) return;
      tamamlanan[anahtarAdi] = 1;
      durum.etkinlikPuani[anahtarAdi] = puan;
      durum.puan += puan;
      sakla();
      rozetVer('ilk-adim');
      if (tur === 'crossword' && basari === 1) rozetVer('bulmaca');
      if (tur === 'match' && basari === 1) rozetVer('eslestirme');
      esikleriDenetle();
      if (geriCagri.degisti) geriCagri.degisti();
    }

    function sifirla() {
      tamamlanan = {};
      durum.puan = 0; durum.rozetler = {}; durum.etkinlikPuani = {};
      sakla();
      if (geriCagri.degisti) geriCagri.degisti();
    }

    /** Doğruluk oranı: tamamlama için verilen taban puan iki taraftan da düşülür. */
    function basariOrani() {
      var kazanilan = 0, enYuksek = 0, taban = 0;
      lessons.forEach(function (ders, i) {
        (ders.activities || []).filter(function (a) { return (a.items || []).length; })
          .forEach(function (_, ai) {
            var k = i + ':' + ai;
            if (!tamamlandiMi(k)) return;
            kazanilan += durum.etkinlikPuani[k] || 0;
            enYuksek += pointsFor(ders.kind, 1);
            taban += pointsFor(ders.kind, 0);
          });
      });
      if (enYuksek - taban <= 0) return 0;
      return Math.max(0, Math.min(1, (kazanilan - taban) / (enYuksek - taban)));
    }

    return {
      durum: durum,
      tamamlandiMi: tamamlandiMi,
      tamamlananSayisi: tamamlananSayisi,
      yuzde: yuzde,
      dersDurumu: dersDurumu,
      rozetVer: rozetVer,
      etkinligiBitir: etkinligiBitir,
      sifirla: sifirla,
      basariOrani: basariOrani
    };
  }


  /**
   * Kenar çubuğundaki üç bilgi paneli: rütbe, ilerleme ve rozet vitrini.
   * Yalnızca çizimden sorumludur; veriyi `oyun` nesnesinden okur.
   */
  function kenarPanelleri(side, oyun, olaylar) {
    var rutbe = el('div', 'eo-rank');
    rutbe.innerHTML =
      '<div class="eo-rank-top">' +
        '<div class="eo-rank-seal" data-seal>I</div>' +
        '<div class="eo-rank-info">' +
          '<div class="eo-rank-name" data-lvname>Başlangıç</div>' +
          '<div class="eo-rank-pts" data-pts>0 puan</div>' +
        '</div>' +
      '</div>' +
      '<div class="eo-rank-track" data-track><i data-lvfill></i></div>';
    side.appendChild(rutbe);

    var ilerleme = el('div', 'eo-progress');
    ilerleme.innerHTML =
      '<div class="eo-prog-top"><span>Tamamlama Durumu</span><b data-pct>%0</b></div>' +
      '<div class="eo-prog-track"><i data-fill></i></div>' +
      '<div class="eo-prog-meta"><span data-meta></span>' +
      '<button type="button" class="eo-prog-reset" data-reset>sıfırla</button></div>';
    side.appendChild(ilerleme);
    ilerleme.querySelector('[data-reset]').addEventListener('click', function () {
      oyun.sifirla();
      if (olaylar.sifirlandi) olaylar.sifirlandi();
    });

    var rozetKutusu = el('div', 'eo-badges');
    rozetKutusu.innerHTML = '<h4>Rozetler <span data-bcount></span></h4>' +
      '<div class="eo-badge-grid" data-bgrid></div>';
    side.appendChild(rozetKutusu);

    function rutbeCiz() {
      var puan = oyun.durum.puan;
      var lv = levelOf(puan);
      rutbe.querySelector('[data-seal]').textContent = lv.level.mark;
      rutbe.querySelector('[data-lvname]').textContent = 'Seviye ' + (lv.index + 1) + ' · ' + lv.level.name;
      rutbe.querySelector('[data-pts]').textContent = trNum(puan) + ' puan';

      var oran = 100, sonraki = 'En üst rütbeye ulaştınız';
      if (lv.next) {
        var aralik = lv.next.min - lv.level.min;
        oran = Math.max(0, Math.min(100, Math.round((puan - lv.level.min) / aralik * 100)));
        sonraki = lv.next.name + ' rütbesine ' + trNum(lv.next.min - puan) + ' puan';
      }
      rutbe.querySelector('[data-lvfill]').style.width = oran + '%';
      // Bilgi ayrı bir satır kaplamasın; çubuğun kendisi zaten ilerlemeyi gösteriyor
      var cubuk = rutbe.querySelector('[data-track]');
      cubuk.title = sonraki;
      cubuk.setAttribute('aria-label', sonraki);
    }

    function ilerlemeCiz() {
      var biten = oyun.tamamlananSayisi();
      var toplam = oyun.durum.toplamEtkinlik;
      var oran = oyun.yuzde();
      ilerleme.querySelector('[data-pct]').textContent = '%' + oran;
      ilerleme.querySelector('[data-fill]').style.width = oran + '%';
      ilerleme.querySelector('[data-meta]').textContent = biten + ' / ' + toplam + ' etkinlik tamamlandı';
      ilerleme.classList.toggle('is-full', toplam > 0 && biten >= toplam);
    }

    function rozetCiz(yeniId) {
      var izgara = rozetKutusu.querySelector('[data-bgrid]');
      izgara.innerHTML = '';
      BADGES.forEach(function (rozet) {
        var kazanildi = !!oyun.durum.rozetler[rozet.id];
        var hucre = el('div', 'eo-badge' + (kazanildi ? ' is-earned' : '') +
          (rozet.id === yeniId ? ' is-new' : ''), icon(rozet.icon));
        hucre.title = kazanildi ? rozet.name + ' — ' + rozet.desc : 'Kilitli: ' + rozet.desc;
        hucre.setAttribute('aria-label', hucre.title);
        izgara.appendChild(hucre);
      });
      rozetKutusu.querySelector('[data-bcount]').textContent =
        Object.keys(oyun.durum.rozetler).length + '/' + BADGES.length;
    }

    return {
      ciz: function () { rutbeCiz(); ilerlemeCiz(); rozetCiz(); },
      rozetCiz: rozetCiz
    };
  }


  // ---------- Bölüm Sonu parçaları ----------

  /* KIND_LABEL bazı türlerde bölüm başlığıyla aynı kelimeyi taşıyor (ör. study →
     "Dene-Öğren"); cevap anahtarında başlığın yanına kısa, ayrık bir tür etiketi
     koymak için Stüdyo'daki KINDS[].tag ile birebir eşleşen ayrı bir tablo. */
  var CS_TUR_ETIKETI = {
    cards: 'Kart destesi', quiz: 'Test', crossword: 'Bulmaca',
    match: 'Eşleştirme', study: 'Öğrenme modülü'
  };

  /* A4 çıktıda filigran: buraya (data:image/png;base64,... gibi) bir data URI
     yapıştırılınca cevap anahtarının her sayfasında otomatik görünür; boşken
     hiçbir şey çizilmez. Yazdırma ayarlarında "Arka plan grafikleri" açık olmalı. */
  var CA_FILIGRAN_DATAURI = 'data:image/png;base64,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';
  var CS_MONOGRAM_DATAURI = 'data:image/png;base64,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';
  var CS_BANDHDR_DATAURI = 'data:image/png;base64,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AARCAAAABEIAAAAEQgAAAARCAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAAEAgBAAAQCAEAABAIAQAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAARCAAAABEIAAAAEQgAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAAIEQAAAAgRAAAACBEAAAgAq/qAIAAIC9GL+2Av9fgAEAPR8igfLxip4AAAAASUVORK5CYII=';

  /** Cevap anahtarı: doğru cevapları işaretli, açıklamalı, kâğıda basılabilir sayfa. */
  var CEVAP_ANAHTARI_CSS =
    'body{font-family:system-ui,Arial,sans-serif;max-width:760px;margin:0 auto;padding:0 20px 40px;color:#13243d;font-size:13px;line-height:1.5;background:#fff}' +
    'h1{font-size:20px;margin:0 0 2px}' +
    '.cs-set-title{font-size:14px;font-weight:700;color:#13243d;margin:0 0 2px}' +
    '.cs-set-sub{font-size:12.5px;color:#6f7f99;margin:0}' +
    '.cs-print{position:fixed;top:182px;right:16px;background:#13243d;color:#fff;border:0;border-radius:8px;padding:9px 16px;font:inherit;font-weight:600;font-size:12px;cursor:pointer}' +
    '.cs-print:hover{background:#1d3255}' +
    'h2{font-size:14px;border-bottom:2px solid #13243d;padding-bottom:4px;margin:18px 0 3px;break-after:avoid;page-break-after:avoid}' +
    '.cs-tag{font-weight:400;font-size:9px;color:#6f7f99}' +
    'h3{font-size:11.5px;color:#3c4d68;margin:8px 0 4px;break-after:avoid;page-break-after:avoid}' +
    '.cs-list{list-style:none;margin:0;padding:0}' +
    '.cs-list>li{padding:9px 2px;margin:0;page-break-inside:avoid}' +
    '.cs-list>li:not(:first-child):not(.cs-acikli){border-top:1px solid #e2e6ee;margin-top:4px}' +
    '.cs-list>li.cs-acikli{padding:0 2px 9px;margin-top:-4px}' +
    '.cs-cards>li,.cs-match>li{display:block}' +
    '.cs-cards>li>b,.cs-match>li>b{display:block;margin:0 0 2px}' +
    '.cs-cards>li>.cs-cevap,.cs-match>li>.cs-cevap{display:block;font-weight:400;color:#3c4d68}' +
    '.cs-crossword>li{display:flex;flex-wrap:wrap;gap:4px 18px;align-items:baseline}' +
    '.cs-crossword>li>b{flex:1 1 0%;min-width:0}' +
    '.cs-crossword>li>.cs-cevap{flex:0 0 auto;font-weight:600;color:#1a6b47}' +
    '.cs-soru{font-weight:600;margin:0 0 6px}' +
    '.cs-ust{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#13243d;font-weight:700;margin:0 0 3px}' +
    '.cs-opts{list-style:none;margin:0;padding:0}' +
    '.cs-opts li{display:flex;align-items:center;gap:8px;margin-bottom:4px}' +
    '.cs-opts li.cs-dogru{color:#1a6b47;font-weight:600}' +
    '.cs-acik{margin:6px 0 0;font-size:11px;color:#3c4d68;font-style:italic}' +
    '.cs-tekkonu{font-size:12px;color:#3c4d68;font-weight:600;margin:0 0 16px}' +
    '.cs-filigran{position:fixed;inset:0;z-index:-1;pointer-events:none;background-repeat:no-repeat;background-position:center;background-size:contain;opacity:.4}' +
    '.cs-band-header{position:fixed;top:0;left:0;right:0;z-index:5;pointer-events:none;max-width:687.87px;margin:0 auto}' +
    '.cs-band-img{display:block;width:100%;height:auto}' +
    '.cs-band-footer{position:fixed;left:0;right:0;bottom:0;height:65px;z-index:5;background:#004a83;display:flex;align-items:center;gap:14px;padding-left:53px;box-sizing:border-box;pointer-events:none}' +
    '.cs-band-footer img{height:30px;width:auto;display:block}' +
    '.cs-band-org b{display:block;color:#fff;font-size:11px;font-weight:700;letter-spacing:.02em;line-height:1.35}' +
    '.cs-band-org span{display:block;color:#cfe0f0;font-size:9px;font-weight:500;letter-spacing:.02em;line-height:1.35;text-transform:uppercase}' +
    '.cs-page{position:relative;width:687.87px;height:297mm;margin:0 auto 22px;padding:125px 0 90px;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;align-content:start}' +
    '.cs-page-head{grid-column:1 / -1;margin-bottom:18px}' +
    '.cs-page:not(:last-child){page-break-after:always;break-after:page}' +
    '.cs-col{min-width:0;box-sizing:border-box}' +
    '.cs-col:first-child{padding-right:14px;border-right:1px solid #e2e6ee}' +
    '.cs-col:last-child{padding-left:14px}' +
    '.cs-pageno{position:absolute;right:-24px;bottom:26px;font-size:10px;color:#fff;z-index:6}' +
    '@media print{' +
      '@page{ margin:0 }' +
      'html{ -webkit-print-color-adjust:exact; print-color-adjust:exact }' +
      'body{padding:0}' +
      '.cs-print{display:none}' +
      '.cs-page{margin:0 auto}' +
      '.cs-band-header{max-width:none}' +
    '}';

  /** Cevap anahtarını A4 sayfalarına bölen ve her sayfaya "n / toplam" numarası ekleyen
      betik; başlıklar sayfa sonunda tek başına kalmaz. Ölçüm gerçek A4 baskı genişliğinde
      yapılır, ekran genişliğinden bağımsızdır. */
  var CS_SAYFALA_JS =
    '(function(){' +
    'var root=document.getElementById("cs-content");' +
    'if(!root)return;' +
    'var kids=Array.prototype.slice.call(root.children);' +
    'if(!kids.length)return;' +
    'var units=[];' +
    'kids.forEach(function(el){' +
      'if(el.tagName==="OL"){' +
        'Array.prototype.slice.call(el.children).forEach(function(li){units.push({type:"li",el:li,olClass:el.className});});' +
      '}else{units.push({type:el.tagName.toLowerCase(),el:el});}' +
    '});' +
    'if(!units.length)return;' +
    'var MM_PX=96/25.4;' +
    'var PAGE_FULL=297*MM_PX;' +
    'var probe=document.createElement("div");' +
    'probe.className="cs-page";' +
    'probe.style.visibility="hidden";' +
    'document.body.appendChild(probe);' +
    'var probeHead=document.createElement("div");' +
    'probeHead.innerHTML=PAGE_HEAD_HTML;' +
    'probeHead=probeHead.firstElementChild;' +
    'probe.appendChild(probeHead);' +
    'var probeCol=document.createElement("div");' +
    'probeCol.className="cs-col";' +
    'probe.appendChild(probeCol);' +
    'var probeStyle=getComputedStyle(probe);' +
    'var topPad=parseFloat(probeStyle.paddingTop)||0;' +
    'var bottomPad=parseFloat(probeStyle.paddingBottom)||0;' +
    'var headRect=probeHead.getBoundingClientRect();' +
    'var headStyle=getComputedStyle(probeHead);' +
    'var headHeight=headRect.height+(parseFloat(headStyle.marginBottom)||0);' +
    'var colWidth=probeCol.getBoundingClientRect().width;' +
    'document.body.removeChild(probe);' +
    'var PAGE_H=PAGE_FULL-topPad-bottomPad-headHeight-10;' +
    'root.innerHTML="";' +
    'var pagesArr=[];' +
    'var pageEl=null;' +
    'var colEl=null;' +
    'var colsInPage=0;' +
    'var openOl=null;' +
    'function addColumn(){' +
      'colEl=document.createElement("div");' +
      'colEl.className="cs-col";' +
      'pageEl.appendChild(colEl);' +
      'colsInPage++;' +
      'openOl=null;' +
    '}' +
    'function newPage(){' +
      'pageEl=document.createElement("div");' +
      'pageEl.className="cs-page";' +
      'var head=document.createElement("div");' +
      'head.innerHTML=PAGE_HEAD_HTML;' +
      'pageEl.appendChild(head.firstElementChild);' +
      'root.appendChild(pageEl);' +
      'pagesArr.push(pageEl);' +
      'colsInPage=0;' +
      'addColumn();' +
    '}' +
    'function newColumn(){' +
      'if(colsInPage<2){addColumn();}else{newPage();}' +
    '}' +
    'function contentBottom(){' +
      'if(!colEl.lastElementChild)return 0;' +
      'return colEl.lastElementChild.getBoundingClientRect().bottom-colEl.getBoundingClientRect().top;' +
    '}' +
    'function appendUnit(u,addedNodes){' +
      'if(u.type==="li"){' +
        'if(!openOl||openOl.className!==u.olClass){' +
          'openOl=document.createElement("ol");' +
          'openOl.className=u.olClass;' +
          'colEl.appendChild(openOl);' +
          'addedNodes.push(openOl);' +
        '}else{addedNodes.push(u.el);}' +
        'openOl.appendChild(u.el);' +
      '}else{' +
        'openOl=null;' +
        'colEl.appendChild(u.el);' +
        'addedNodes.push(u.el);' +
      '}' +
    '}' +
    'function removeNodes(nodes){' +
      'nodes.forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n);});' +
    '}' +
    'function isHeading(u){return u.type==="h2"||u.type==="h3";}' +
    'function budgetFor(col){return PAGE_H;}' +
    'newPage();' +
    'var i=0;' +
    'while(i<units.length){' +
      'var u=units[i];' +
      'if(isHeading(u)){' +
        'var j=i;' +
        'while(j<units.length&&isHeading(units[j]))j++;' +
        'var runEnd=Math.min(j,units.length-1);' +
        'var hadContentBefore=colEl.children.length>0;' +
        'var addedRun=[];' +
        'for(var k=i;k<=runEnd;k++){appendUnit(units[k],addedRun);}' +
        'var fits=contentBottom()<=budgetFor(colEl);' +
        'if(!fits&&hadContentBefore){' +
          'removeNodes(addedRun);' +
          'newColumn();' +
          'for(var k2=i;k2<j;k2++){appendUnit(units[k2],[]);}' +
          'i=j;' +
        '}else{' +
          'i=(j<units.length)?(j+1):j;' +
        '}' +
        'continue;' +
      '}' +
      'var hadContent=colEl.children.length>0;' +
      'var added=[];' +
      'appendUnit(u,added);' +
      'if(hadContent&&contentBottom()>budgetFor(colEl)){' +
        'removeNodes(added);' +
        'newColumn();' +
        'appendUnit(u,[]);' +
      '}' +
      'i++;' +
    '}' +
    'var allCols=[];' +
    'pagesArr.forEach(function(pg){' +
      'Array.prototype.forEach.call(pg.querySelectorAll(":scope > .cs-col"),function(c){allCols.push(c);});' +
    '});' +
    'for(var c=0;c<allCols.length-1;c++){' +
      'var col=allCols[c];' +
      'var last=col.lastElementChild;' +
      'while(last&&(last.tagName==="H2"||last.tagName==="H3")){' +
        'var nextCol=allCols[c+1];' +
        'nextCol.insertBefore(last,nextCol.firstElementChild||null);' +
        'last=col.lastElementChild;' +
      '}' +
    '}' +
    'var total=pagesArr.length;' +
    'pagesArr.forEach(function(pg,idx){' +
      'var pn=document.createElement("div");' +
      'pn.className="cs-pageno";' +
      'pn.textContent=(idx+1)+" / "+total;' +
      'pg.appendChild(pn);' +
    '});' +
    '})();';

  function caOge(kind, it) {
    if (kind === 'cards' || kind === 'match') {
      return '<li><b>' + esc(it.term) + '</b><span class="cs-cevap">' + esc(it.definition) + '</span></li>';
    }
    if (kind === 'crossword') {
      return '<li><b>' + esc(it.clue) + '</b><span class="cs-cevap">' + esc(it.answer) + '</span></li>';
    }
    if (kind === 'quiz' || kind === 'study') {
      var opts = (it.options || []).map(function (o, i) {
        return '<li class="' + (i === it.answer ? 'cs-dogru' : '') + '">' + (i === it.answer ? '✓ ' : '') + esc(o) + '</li>';
      }).join('');
      var ust = (kind === 'study' && (it.category || it.title))
        ? '<p class="cs-ust">' + esc([it.category, it.title].filter(Boolean).join(' · ')) + '</p>' : '';
      // Açıklama kasıtlı olarak ayrı bir <li> — soru+şıklar tek parça kalır, ama sayfa
      // sonunda yer kalmazsa yalnızca açıklama satırı bir sonraki sayfaya kayabilir.
      var kart = '<li class="cs-qkart">' + ust + '<p class="cs-soru">' + esc(it.question) + '</p><ul class="cs-opts">' + opts + '</ul></li>';
      var acik = it.explanation ? '<li class="cs-acikli"><p class="cs-acik">' + esc(it.explanation) + '</p></li>' : '';
      return kart + acik;
    }
    return '';
  }

  /** Tüm setin cevap anahtarı sayfasını üretir (yeni sekmede açılır). */
  function cevapAnahtariHtmlOgrenci(lessons, meta) {
    // Belgede tek bir konu varsa (tüm bölümlerin etkinlik başlığı aynıysa),
    // bu başlığı her bölümün altında ayrı ayrı tekrarlamak yerine sayfanın en
    // üstünde bir kez göstermek yeterlidir.
    var konuBasliklari = {};
    (lessons || []).forEach(function (l) {
      (l.activities || []).forEach(function (a) {
        if ((a.items || []).length) konuBasliklari[a.title || ''] = true;
      });
    });
    var konuAnahtarlari = Object.keys(konuBasliklari);
    var tekKonuBasligi = (konuAnahtarlari.length === 1) ? konuAnahtarlari[0] : '';

    // Tek konu başlığı artık ayrı, sadece ilk sayfada görünen bir blok değil —
    // sayfalama akışının İLK birimi olarak içeriğe (govde) dahil edilir.
    var govde = tekKonuBasligi ? ('<p class="cs-tekkonu">' + esc(tekKonuBasligi) + '</p>') : '';
    (lessons || []).forEach(function (l) {
      var acts = (l.activities || []).filter(function (a) { return (a.items || []).length; });
      if (!acts.length) return;
      govde += '<h2>' + esc(l.title || KIND_LABEL[l.kind] || '') + ' <span class="cs-tag">' + esc(CS_TUR_ETIKETI[l.kind] || '') + '</span></h2>';
      acts.forEach(function (a) {
        var konuBaslikHtml = tekKonuBasligi ? '' : ('<h3>' + esc(a.title || '') + '</h3>');
        govde += konuBaslikHtml + '<ol class="cs-list cs-' + esc(l.kind) + '">';
        a.items.forEach(function (it) { govde += caOge(l.kind, it); });
        govde += '</ol>';
      });
    });
    var baslik = esc((meta && meta.title) || 'Çöz-Öğren');
    var altBaslik = esc((meta && meta.subtitle) || '');
    var filigran = CA_FILIGRAN_DATAURI
      ? '<div class="cs-filigran" style="background-image:url(\'' + CA_FILIGRAN_DATAURI + '\')"></div>' : '';
    // Set başlığı + alt başlık şeridi HER fiziksel sayfada aynı şekilde
    // tekrarlanır; #ca-content dışında bir kere değil, CS_SAYFALA_JS tarafından
    // her ".cs-page" için ayrı ayrı eklenir (bkz. PAGE_HEAD_HTML).
    var pageHeadHtml = '<div class="cs-page-head"><p class="cs-set-title">' + baslik + '</p>' + (altBaslik ? ('<p class="cs-set-sub">' + altBaslik + '</p>') : '') + '</div>';
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + baslik + ' — Cevap Anahtarı</title><style>' + CEVAP_ANAHTARI_CSS + '</style></head>' +
      '<body>' + filigran +
      '<button class="cs-print" type="button" onclick="window.print()">Yazdır / PDF olarak kaydet</button>' +
      '<div class="cs-band-header">' +
        '<img class="cs-band-img" src="' + CS_BANDHDR_DATAURI + '" alt="">' +
      '</div>' +
      '<div class="cs-band-footer">' +
        '<img src="' + CS_MONOGRAM_DATAURI + '" alt="">' +
        '<div class="cs-band-org"><b>Anadolu Üniversitesi</b><span>Açıköğretim Fakültesi</span></div>' +
      '</div>' +
      '<div id="cs-content">' + (govde || '<p>Bu sette henüz içerik yok.</p>') + '</div>' +
      '<script>' +
        'var PAGE_HEAD_HTML=' + JSON.stringify(pageHeadHtml) + ';' +
        CS_SAYFALA_JS +
      '<\/script>' +
      '</body></html>';
  }

  /** Blob'u yeni sekmede açar (indirmeye zorlamadan) — sandbox'lı önizlemede de çalışır. */
  function belgeSekmedeAc(html) {
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /** Üst blok: tamamlanma halkası, dönüt metni ve dört rakam. */
  function ozetUstBlok(oran, donut, oyun) {
    var ust = el('div', 'eo-son-ust');
    var halka = el('div', 'eo-score-ring' + (oran >= 100 ? ' is-high' : ''), '<span>%' + oran + '</span>');
    halka.style.setProperty('--pct', oran + '%');
    ust.appendChild(halka);

    var seviye = levelOf(oyun.durum.puan);
    var yazi = el('div', 'eo-son-yazi');
    yazi.innerHTML = '<h4>' + esc(donut.baslik) + '</h4><p>' + esc(donut.metin) + '</p>';
    yazi.appendChild(el('div', 'eo-son-rakam',
      '<span><b>' + oyun.tamamlananSayisi() + ' / ' + oyun.durum.toplamEtkinlik + '</b>etkinlik</span>' +
      '<span><b>' + trNum(oyun.durum.puan) + '</b>puan</span>' +
      '<span><b>' + (seviye.index + 1) + '. seviye</b>' + esc(seviye.level.name) + '</span>' +
      '<span><b>' + Object.keys(oyun.durum.rozetler).length + ' / ' + BADGES.length + '</b>rozet</span>'));
    ust.appendChild(yazi);
    return ust;
  }

  /** Bölüm bölüm döküm; her satırdan ilgili bölüme gidilebilir. */
  function ozetDersListesi(lessons, oyun, bolumeGit) {
    var liste = el('div', 'eo-son-liste');
    lessons.forEach(function (ders, i) {
      var d = oyun.dersDurumu(i, ders);
      if (!d.toplam) return;

      var satir = el('div', 'eo-son-satir' + (d.bitti ? ' is-done' : ''));
      satir.innerHTML =
        '<span class="eo-son-mark">' + (d.bitti ? '✓' : d.biten + '/' + d.toplam) + '</span>' +
        '<span class="eo-son-ad">' + esc(ders.title) +
        '<small>' + esc(KIND_LABEL[ders.kind] || '') + ' · ' + d.biten + ' / ' + d.toplam + ' etkinlik</small></span>';

      var git = el('button', 'eo-btn ghost sm', d.bitti ? 'Yeniden' : 'Devam et');
      git.type = 'button';
      git.addEventListener('click', function () { bolumeGit(i); });
      satir.appendChild(git);
      liste.appendChild(satir);
    });
    return liste;
  }

  /** Kazanılan rozetlerin şeridi; hiç yoksa null döner. */
  function ozetRozetSeridi(oyun) {
    var kazanilan = BADGES.filter(function (x) { return oyun.durum.rozetler[x.id]; });
    if (!kazanilan.length) return null;
    var serit = el('div', 'eo-son-rozet');
    kazanilan.forEach(function (rozet) {
      var oge = el('span', 'eo-son-rozet-oge', icon(rozet.icon) + '<span>' + esc(rozet.name) + '</span>');
      oge.title = rozet.desc;
      serit.appendChild(oge);
    });
    return serit;
  }

  /** Tek bir etkinliği kart kabuğuyla birlikte çizer. */
  function renderActivity(act, kind, host, opts) {
    opts = opts || {};
    var box = el('div', 'eo-activity');
    var earned = null;
    if (!opts.bare) {
      var head = el('div', 'eo-act-head');
      head.appendChild(el('span', 'eo-tag', KIND_LABEL[kind] || kind));
      head.appendChild(el('h3', '', esc(act.title || 'Etkinlik')));
      if (opts.onDone) {
        earned = el('span', 'eo-earned');
        earned.style.display = 'none';
        head.appendChild(earned);
        var tick = el('span', 'eo-act-tick', '✓');
        tick.title = 'Tamamlandı';
        head.appendChild(tick);
      }
      box.appendChild(head);
    }
    var body = el('div', 'eo-act-body');
    box.appendChild(body);
    host.appendChild(box);

    var fired = false;
    var done = function (score) {
      box.classList.add('is-complete');
      if (fired) return;
      fired = true;
      var pts = pointsFor(kind, score);
      if (earned) {
        earned.textContent = '+' + pts + ' puan';
        earned.style.display = '';
      }
      if (opts.onDone) opts.onDone(pts, score);
    };

    (RENDERERS[kind] || function () {
      body.appendChild(el('div', 'eo-empty', 'Bilinmeyen etkinlik türü: ' + esc(kind)));
    })(act, body, done, { award: opts.award || function () {} });

    if (opts.completed) {
      box.classList.add('is-complete');
      fired = true;
      if (earned && opts.earnedPoints) {
        earned.textContent = opts.earnedPoints + ' puan';
        earned.style.display = '';
      }
    }
    return box;
  }

  /** Tüm kursu kenar çubuğuyla birlikte kurar. */
  function mount(data, root, opts) {
    opts = opts || {};
    data = data || { meta: {}, lessons: [] };
    var lessons = data.lessons || [];
    var meta = data.meta || {};
    root.dataset.mounted = '1';   // DOMContentLoaded'daki otomatik kurulum tekrar çizmesin
    root.innerHTML = '';
    document.body.classList.add('eo-body');

    if (opts.single) {
      temaUygula(temaOku());                 // gömülü kullanımda da tercihi izle
      var lesson = lessons[opts.single.lesson] || lessons[0];
      var act = (lesson.activities || [])[opts.single.activity];
      if (act) renderActivity(act, lesson.kind, root, { bare: opts.bare });
      return;
    }

    var shell = el('div', 'eo-shell');
    var side = el('aside', 'eo-side');
    var brand = el('div', 'eo-brand');
    brand.innerHTML =
      '<div class="eo-eyebrow">' + esc(meta.eyebrow || 'Çöz-Öğren') + '</div>' +
      '<h1>' + esc(meta.title || 'Çöz-Öğren') + '</h1>' +
      '<p>' + esc(meta.subtitle || '') + '</p>';
    side.appendChild(brand);

    // Tema düğmesi: masaüstünde kenar çubuğunun üst köşesi, mobilde başlık şeridi
    var temaBtn = el('button', 'eo-themebtn');
    temaBtn.type = 'button';
    function temaCiz() {
      var etkin = document.documentElement.getAttribute('data-theme') || 'light';
      var hedef = etkin === 'dark' ? 'light' : 'dark';
      temaBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        TEMA_ICON[hedef] + '</svg>';
      var yazi = hedef === 'dark' ? 'Karanlık temaya geç' : 'Aydınlık temaya geç';
      temaBtn.title = yazi;
      temaBtn.setAttribute('aria-label', yazi);
    }
    temaBtn.addEventListener('click', function () {
      var etkin = document.documentElement.getAttribute('data-theme') || 'light';
      var yeni = etkin === 'dark' ? 'light' : 'dark';
      store('tema', yeni);
      temaUygula(yeni);
      temaCiz();
    });
    temaUygula(temaOku());
    temaCiz();
    side.appendChild(temaBtn);

    var menuBtn = el('button', 'eo-menubtn', 'Bölümler');
    menuBtn.type = 'button';
    menuBtn.addEventListener('click', function () { side.classList.toggle('open'); });
    side.appendChild(menuBtn);

    // ---- Oyunlaştırma ----
    var oyun = oyunDurumu(data, lessons, {
      degisti: function () { paneller.ciz(); drawNav(); },
      rozetKazanildi: function (rozet, id) { paneller.rozetCiz(id); showAward(rozet); }
    });
    var totalActs = oyun.durum.toplamEtkinlik;

    var paneller = kenarPanelleri(side, oyun, { sifirlandi: function () { draw(); } });
    var doneCount = oyun.tamamlananSayisi;

    function award(id) { oyun.rozetVer(id); }

    // Aynı anda birden çok rozet kazanılabilir; bildirimler sırayla gösterilir.
    var awardQueue = [], awardShowing = false, awardTimer = null, awardHide = null;
    function showAward(b) {
      awardQueue.push(b);
      if (!awardShowing) { nextAward(); return; }
      // Sıradaki varken görünendeki bekleme kısalır, kuyruk tıkanmaz
      clearTimeout(awardTimer);
      awardTimer = setTimeout(awardHide, ROZET_ACELE);
    }
    function nextAward() {
      var b = awardQueue.shift();
      if (!b) { awardShowing = false; return; }
      awardShowing = true;
      var card = el('div', 'eo-award');
      card.setAttribute('role', 'status');
      card.innerHTML =
        '<div class="eo-award-seal">' + icon(b.icon) + '</div>' +
        '<div><div class="eo-award-kicker">Rozet kazanıldı · +' + ROZET_PUANI + ' puan</div>' +
        '<div class="eo-award-name">' + esc(b.name) + '</div>' +
        '<div class="eo-award-desc">' + esc(b.desc) + '</div></div>';
      document.body.appendChild(card);
      requestAnimationFrame(function () { card.classList.add('show'); });
      awardHide = function () {
        card.classList.remove('show');
        setTimeout(function () { card.remove(); nextAward(); }, ROZET_GECIS);
      };
      clearTimeout(awardTimer);
      awardTimer = setTimeout(awardHide, awardQueue.length ? ROZET_KISA_GOSTERIM : ROZET_GOSTERIM);
    }

    var nav = el('ul', 'eo-nav');
    side.appendChild(nav);
    if (meta.footer) side.appendChild(el('div', 'eo-side-foot', esc(meta.footer)));

    var main = el('main', 'eo-main');
    var wrap = el('div', 'eo-wrap');
    main.appendChild(wrap);

    shell.appendChild(side);
    shell.appendChild(main);
    root.appendChild(shell);

    var current = 0;
    var SON = lessons.length;          // Bölüm Sonu sanal bölümün sırası

    function drawNav() {
      nav.innerHTML = '';
      lessons.forEach(function (l, i) {
        var acts = (l.activities || []).filter(function (a) { return (a.items || []).length; });
        var d = oyun.dersDurumu(i, l).biten;
        var li = el('li');
        var b = el('button');
        b.type = 'button';
        if (acts.length && d >= acts.length) b.classList.add('is-done');
        b.innerHTML = '<span class="eo-num">' + (acts.length && d >= acts.length ? '✓' : String(i + 1).padStart(2, '0')) + '</span>' +
          '<span>' + esc(l.title) +
          '<span class="eo-navmeta">' + (acts.length ? d + ' / ' + acts.length + ' tamamlandı' : 'içerik yok') + '</span></span>';
        if (i === current) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', function () {
          current = i; side.classList.remove('open'); draw();
          main.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        li.appendChild(b);
        nav.appendChild(li);
      });

      // Bölüm Sonu: değerlendirme ve genel dönüt (bölüm yoksa gösterilmez)
      if (!lessons.length) return;
      var sonLi = el('li', 'eo-nav-son');
      var sonBtn = el('button');
      sonBtn.type = 'button';
      var pct = oyun.yuzde();
      sonBtn.innerHTML = '<span class="eo-num">★</span><span>Bölüm Sonu' +
        '<span class="eo-navmeta">değerlendirme · %' + pct + '</span></span>';
      if (pct >= 100) sonBtn.classList.add('is-done');
      if (current === SON) sonBtn.setAttribute('aria-current', 'true');
      sonBtn.addEventListener('click', function () {
        current = SON; side.classList.remove('open'); draw();
        main.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      sonLi.appendChild(sonBtn);
      nav.appendChild(sonLi);
    }

    /**
     * İlerleme ve başarıya göre öğrenciye genel dönüt.
     * Eşikler: tamamlanma yüzdesi kademeleri, %100'de doğruluk oranı kademeleri.
     */
    function donutMetni(pct, basari, eksikler) {
      var toplam = oyun.durum.toplamEtkinlik;
      var kalan = toplam - oyun.tamamlananSayisi();
      var basariYuzde = Math.round(basari * 100);
      var altBolumler = eksikler.length ? ' Tamamlanmamış alt bölümler: ' + eksikler.join(', ') + '.' : '';

      if (!oyun.tamamlananSayisi()) return {
        baslik: 'İlk adımı atmaya hazırsınız',
        metin: 'Çöz-Öğren içeriğindeki ilk etkinliği tamamladığınızda ilerlemenize ve ' +
               'performansınıza yönelik dönütlerinizi burada görebilirsiniz.',
        renk: ''
      };

      if (pct < 40) return {
        baslik: 'İlerlemeye başladınız',
        metin: 'Çöz-Öğren içeriğindeki etkinliklerin %' + pct + '\u2019ini tamamladınız.' +
               (eksikler.length ? ' Sıradaki etkinlik: ' + eksikler[0] + '.' : '') +
               ' Etkinliklere devam ederek ilerlemenizi sürdürebilirsiniz.',
        renk: ''
      };

      if (pct < 50) return {
        baslik: 'Yolun yarısına yaklaştınız',
        metin: 'Çöz-Öğren içeriğindeki etkinliklerin %' + pct + '\u2019ini tamamladınız. ' +
               'Tamamlamanız gereken ' + kalan + ' etkinlik kaldı.' + altBolumler,
        renk: ''
      };

      if (pct < 100) return {
        baslik: 'Yarısından fazlasını tamamladınız',
        metin: 'Çöz-Öğren içeriğindeki etkinliklerin %' + pct + '\u2019ini tamamladınız. ' +
               'Tamamlamanız gereken ' + kalan + ' etkinlik kaldı. Kalan etkinliklere devam ederek ' +
               'Çöz-Öğren içeriğini tamamlayabilirsiniz.' + altBolumler,
        renk: ''
      };

      if (basari >= YUKSEK_BASARI) return {
        baslik: 'Başarıyla tamamladınız',
        metin: 'Çöz-Öğren içeriğindeki tüm etkinlikleri tamamladınız ve %' + basariYuzde +
               ' başarı elde ettiniz. Konulara ilişkin güçlü bir performans gösterdiniz. ' +
               'İsterseniz etkinlikleri yeniden gözden geçirerek öğrendiklerinizi pekiştirebilirsiniz.',
        renk: 'is-ok'
      };

      if (basari >= ORTA_BASARI) return {
        baslik: 'Tüm etkinlikleri tamamladınız',
        metin: 'Çöz-Öğren içeriğindeki tüm etkinlikleri tamamladınız ve %' + basariYuzde +
               ' başarı elde ettiniz. Öğrenmenizi güçlendirmek için düşük başarı gösterdiğiniz ' +
               'etkinlikleri yeniden gözden geçirebilirsiniz.',
        renk: 'is-ok'
      };

      return {
        baslik: 'Tamamladınız, pekiştirme önerilir',
        metin: 'Çöz-Öğren içeriğindeki tüm etkinlikleri tamamladınız ve %' + basariYuzde +
               ' başarı elde ettiniz. Düşük başarı gösterdiğiniz konuları ve ilgili etkinlikleri ' +
               'yeniden gözden geçirmeniz öğrenmenizi destekleyecektir.',
        renk: 'is-warn'
      };
    }

    function drawSummary() {
      wrap.innerHTML = '';
      wrap.appendChild(el('div', 'eo-lessonhead',
        '<div class="eo-kicker">Bölüm Sonu · Değerlendirme</div>' +
        '<h2>' + esc(meta.title || 'Çöz-Öğren') + '</h2>' +
        '<p>Bu bölümde ne kadar yol aldığınızın özeti ve size özel geri bildirim.</p>'));

      var oran = oyun.yuzde();
      var eksikler = lessons.filter(function (ders, i) {
        var d = oyun.dersDurumu(i, ders);
        return d.toplam && !d.bitti;
      }).map(function (ders) { return ders.title; });

      var kutu = el('div', 'eo-activity');
      var govde = el('div', 'eo-act-body');
      kutu.appendChild(govde);

      govde.appendChild(ozetUstBlok(oran, donutMetni(oran, oyun.basariOrani(), eksikler), oyun));
      govde.appendChild(ozetDersListesi(lessons, oyun, function (i) {
        current = i; draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
      }));

      var rozetler = ozetRozetSeridi(oyun);
      if (rozetler) {
        govde.appendChild(el('div', 'eo-son-baslik', 'Kazandığınız rozetler'));
        govde.appendChild(rozetler);
      }

      govde.appendChild(el('div', 'eo-son-baslik', 'Cevap anahtarı'));
      var kagitAciklama = el('p', '', 'Doğru cevapları ve açıklamaları içeren cevap anahtarını buradan indirebilirsiniz.');
      kagitAciklama.style.cssText = 'color:var(--ink-3,#6f7f99);font-size:13px;margin:2px 0 10px;max-width:60ch';
      govde.appendChild(kagitAciklama);
      var cevapBtn = el('button', 'eo-btn ghost sm', 'Cevap anahtarını indir');
      cevapBtn.type = 'button';
      cevapBtn.style.marginBottom = '14px';
      cevapBtn.addEventListener('click', function () {
        belgeSekmedeAc(cevapAnahtariHtmlOgrenci(lessons, meta));
      });
      govde.appendChild(cevapBtn);

      govde.appendChild(ozetEylemleri(eksikler));
      wrap.appendChild(kutu);
    }

    /** Bölüm Sonu alt düğmeleri: geri dön, eksiğe git ya da baştan çöz. */
    function ozetEylemleri(eksikler) {
      var bar = el('div', 'eo-actions');
      var sonDers = lessons[lessons.length - 1];

      if (sonDers) {
        var geri = el('button', 'eo-btn ghost', '← ' + esc(sonDers.title || 'Önceki bölüm'));
        geri.type = 'button';
        geri.addEventListener('click', function () {
          current = lessons.length - 1; draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        bar.appendChild(geri);
      }
      bar.appendChild(el('span', 'eo-spacer'));

      if (eksikler.length) {
        var git = el('button', 'eo-btn', 'Eksik bölüme git →');
        git.type = 'button';
        git.addEventListener('click', function () {
          var hedef = 0;
          lessons.forEach(function (ders, i) { if (ders.title === eksikler[0]) hedef = i; });
          current = hedef; draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        bar.appendChild(git);
      } else {
        var tekrar = el('button', 'eo-btn', 'Seti baştan çöz');
        tekrar.type = 'button';
        tekrar.addEventListener('click', function () {
          oyun.sifirla(); current = 0; draw();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        bar.appendChild(tekrar);
      }
      return bar;
    }

    function draw() {
      boyutAbonelikleriniTemizle();     // önceki bölümün abonelikleri düşsün
      paneller.ciz();
      drawNav();
      if (!lessons.length) {
        wrap.innerHTML = '';
        wrap.appendChild(el('div', 'eo-empty', 'Bu pakette henüz bölüm yok.'));
        return;
      }
      if (current === SON) { drawSummary(); return; }
      wrap.innerHTML = '';
      var l = lessons[current];
      if (!l) { wrap.appendChild(el('div', 'eo-empty', 'Bu pakette henüz bölüm yok.')); return; }

      var head = el('div', 'eo-lessonhead');
      head.innerHTML =
        '<div class="eo-kicker">Bölüm ' + String(current + 1).padStart(2, '0') + ' · ' + esc(KIND_LABEL[l.kind] || '') + '</div>' +
        '<h2>' + esc(l.title) + '</h2>' +
        '<p>' + esc(l.intro || '') + '</p>';
      wrap.appendChild(head);

      var acts = (l.activities || []).filter(function (a) { return (a.items || []).length; });
      if (!acts.length) {
        wrap.appendChild(el('div', 'eo-empty', 'Bu bölümde gösterilecek etkinlik yok.'));
      }
      acts.forEach(function (act, ai) {
        var key = current + ':' + ai;
        renderActivity(act, l.kind, wrap, {
          completed: oyun.tamamlandiMi(key),
          earnedPoints: oyun.durum.etkinlikPuani[key],
          award: award,
          onDone: function (pts, score) { oyun.etkinligiBitir(key, pts, l.kind, score); }
        });
      });

      var bar = el('div', 'eo-actions');
      if (current > 0) {
        var p = el('button', 'eo-btn ghost', '← ' + lessons[current - 1].title);
        p.type = 'button';
        p.addEventListener('click', function () { current--; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        bar.appendChild(p);
      }
      bar.appendChild(el('span', 'eo-spacer'));
      var ileriAd = current < lessons.length - 1 ? lessons[current + 1].title : 'Bölüm Sonu';
      var n = el('button', 'eo-btn', ileriAd + ' →');
      n.type = 'button';
      n.addEventListener('click', function () { current++; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      bar.appendChild(n);
      wrap.appendChild(bar);
    }

    draw();
    return { goTo: function (i) { current = i; draw(); }, summary: function () { current = SON; draw(); } };
  }

  global.EO = { mount: mount, renderActivity: renderActivity, KIND_LABEL: KIND_LABEL,
    esc: esc, rich: rich, temaUygula: temaUygula, temaOku: temaOku, onResize: onResize };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var root = document.getElementById('eo-root');
      if (root && global.EO_DATA && !root.dataset.mounted) {
        root.dataset.mounted = '1';
        mount(global.EO_DATA, root);
      }
    });
  }
})(window);
