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
    var status = el('span', 'eo-counter', items.length + ' kelime');
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
      status.textContent = items.length + ' kelime';
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
        'Izgaraya sığmayan kelimeler: ' + api.model.skipped.map(esc).join(', ')));
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
      '<div class="eo-prog-top"><span>İlerleme</span><b data-pct>%0</b></div>' +
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
