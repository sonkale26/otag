/* ============================================================
   Çöz-Öğren — çalışma zamanı motoru
   Veri: window.EO_DATA (data.js)   Çizim: EO.mount(data, root, opts)
   ============================================================ */
(function (global) {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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
    var picked = null;                       // onaylanmamış seçim
    var streak = 0, bestStreak = 0;
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
      if (streak >= 2) top.appendChild(el('span', 'eo-streak', 'üst üste ' + streak + ' doğru'));
      top.appendChild(el('span', 'eo-spacer'));
      top.appendChild(rail());
      stage.appendChild(top);

      stage.appendChild(el('p', 'eo-qtext', rich(q.question)));

      var opts = el('div', 'eo-options');
      var locked = answers[idx] != null;
      (q.options || []).forEach(function (text, i) {
        var b = el('button', 'eo-opt');
        b.type = 'button';
        b.innerHTML = '<span class="eo-bubble">' + (LETTERS[i] || i + 1) + '</span><span>' + rich(text) + '</span>';
        if (locked) {
          b.disabled = true;
          if (i === q.answer) b.classList.add('is-ok');
          else if (i === answers[idx]) b.classList.add('is-no');
        } else if (picked === i) {
          b.classList.add('is-picked');
          b.setAttribute('aria-pressed', 'true');
        }
        b.addEventListener('click', function () {
          if (answers[idx] != null) return;
          picked = (picked === i) ? null : i;   // aynı şıkka yeniden tıklayınca seçim kalkar
          drawQuestion();
        });
        opts.appendChild(b);
      });
      stage.appendChild(opts);

      if (locked) {
        var right = answers[idx] === q.answer;
        var fb = el('div', 'eo-feedback ' + (right ? 'is-ok' : 'is-no'));
        fb.appendChild(el('div', 'eo-fb-title', right
          ? 'Tebrikler, yanıtınız doğru!'
          : 'Yanıtınız yanlış! Doğru yanıt: ' + (LETTERS[q.answer] || '')));
        var body = q.explanation || (right
          ? 'Doğru seçeneği işaretlediniz.'
          : 'Doğru seçenek yukarıda yeşille gösterilmiştir.');
        fb.appendChild(el('div', '', rich(body)));
        stage.appendChild(fb);
      }

      var bar = el('div', 'eo-actions');
      var prev = el('button', 'eo-btn ghost sm', '← Önceki');
      prev.type = 'button';
      prev.disabled = idx === 0;
      prev.addEventListener('click', function () { idx--; picked = null; drawQuestion(); });
      bar.appendChild(prev);
      bar.appendChild(el('span', 'eo-spacer'));

      if (!locked) {
        var confirm = el('button', 'eo-btn accent', 'Yanıtı onayla');
        confirm.type = 'button';
        confirm.disabled = picked == null;
        confirm.addEventListener('click', function () {
          if (picked == null) return;
          answers[idx] = picked;
          if (picked === q.answer) {
            streak++;
            if (streak > bestStreak) bestStreak = streak;
            if (streak >= 5 && opts_ctx.award) opts_ctx.award('seri');
          } else { streak = 0; }
          picked = null;
          drawQuestion();
        });
        bar.appendChild(confirm);
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
      var ring = el('div', 'eo-score-ring' + (pct >= 80 ? ' is-high' : ''), '<span>%' + pct + '</span>');
      ring.style.setProperty('--pct', pct + '%');
      box.appendChild(ring);
      box.appendChild(el('h4', '', items.length + ' sorudan ' + correct + ' doğru'));
      box.appendChild(el('p', '', pct >= 80 ? 'Konuya hâkimsiniz. Yanlış yanıtladığınız soruların açıklamalarını gözden geçirip diğer etkinliklere geçebilirsiniz.'
        : pct >= 50 ? 'İyi bir başlangıç. Aşağıdaki listeden yanlış yanıtlarınızı inceleyip testi yeniden çözün.'
        : 'Konuyu Dene-Öğren modülünden tekrar edip testi yeniden çözmenizi öneririz.'));

      var review = el('div', 'eo-review');
      items.forEach(function (q, i) {
        var ok = answers[i] === q.answer;
        var row = el('div', 'eo-review-item ' + (ok ? 'ok' : 'no'));
        row.appendChild(el('span', 'eo-mark', ok ? '✓' : '✕'));
        var body = el('div');
        body.appendChild(el('div', '', rich(q.question)));
        body.appendChild(el('small', '', 'Doğru yanıt: ' + (LETTERS[q.answer] || '') + ') ' + esc((q.options || [])[q.answer] || '')));
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
        idx = 0; streak = 0; drawQuestion();
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
  function renderMatch(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (p) { return p && p.term && p.definition; });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu etkinlikte henüz eşleştirme yok.')); return; }

    host.appendChild(el('p', 'eo-hintline',
      'Açıklamayı seçip karşısındaki kavram kutusuna tıklayın; masaüstünde sürükleyip bırakabilirsiniz.'));

    var wrap = el('div', 'eo-match');
    var leftCol = el('div', 'eo-match-col');
    leftCol.appendChild(el('h4', '', 'Açıklamalar'));
    var pool = el('div', 'eo-pool');
    leftCol.appendChild(pool);

    var rightCol = el('div', 'eo-match-col');
    rightCol.appendChild(el('h4', '', 'Kavramlar'));
    var slots = el('div', 'eo-pool');
    rightCol.appendChild(slots);

    wrap.appendChild(leftCol);
    wrap.appendChild(rightCol);
    host.appendChild(wrap);

    var selected = null;

    function makeChip(item, i) {
      var chip = el('button', 'eo-chip');
      chip.type = 'button';
      chip.draggable = true;
      chip.dataset.id = i;
      chip.innerHTML = rich(item.definition);
      chip.addEventListener('click', function () {
        if (selected === chip) { chip.classList.remove('is-selected'); selected = null; return; }
        if (selected) selected.classList.remove('is-selected');
        selected = chip; chip.classList.add('is-selected');
      });
      chip.addEventListener('dragstart', function (e) {
        selected = chip;
        chip.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) {}
        e.dataTransfer.effectAllowed = 'move';
      });
      chip.addEventListener('dragend', function () { chip.classList.remove('is-dragging'); });
      return chip;
    }

    shuffle(items.map(function (it, i) { return { it: it, i: i }; }))
      .forEach(function (o) { pool.appendChild(makeChip(o.it, o.i)); });

    var drops = [];
    items.forEach(function (item, i) {
      var slot = el('div', 'eo-slot');
      slot.appendChild(el('div', 'eo-slot-term', rich(item.term)));
      var drop = el('div', 'eo-drop', 'buraya bırakın');
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
        update();
      }
      function onActivate() {
        if (selected) { place(selected); return; }
        if (drop.dataset.filled) returnChip(drop);
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
    });

    function returnChip(drop) {
      var chip = drop.querySelector('.eo-chip');
      if (chip) pool.appendChild(chip);
      drop.textContent = 'buraya bırakın';
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
    }

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
    update();
  }

  // ---------- 5) Dene-Öğren ----------
  function renderStudy(act, host, done, opts_ctx) {
    opts_ctx = opts_ctx || {};
    var items = (act.items || []).filter(function (m) { return m && (m.title || m.theory); });
    if (!items.length) { host.appendChild(el('div', 'eo-empty', 'Bu modülde henüz bölüm yok.')); return; }

    var idx = 0;
    var answers = new Array(items.length).fill(null);
    var picked = null;                       // onaylanmamış seçim
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
        var opts = el('div', 'eo-options');
        var locked = answers[idx] != null;
        (m.options || []).forEach(function (t, i) {
          var b = el('button', 'eo-opt');
          b.type = 'button';
          b.innerHTML = '<span class="eo-bubble">' + (LETTERS[i] || i + 1) + '</span><span>' + rich(t) + '</span>';
          if (locked) {
            b.disabled = true;
            if (i === m.answer) b.classList.add('is-ok');
            else if (i === answers[idx]) b.classList.add('is-no');
          } else if (picked === i) {
            b.classList.add('is-picked');
            b.setAttribute('aria-pressed', 'true');
          }
          b.addEventListener('click', function () {
            if (answers[idx] != null) return;
            picked = (picked === i) ? null : i;
            draw();
          });
          opts.appendChild(b);
        });
        qb.appendChild(opts);

        if (locked) {
          var right = answers[idx] === m.answer;
          var fb = el('div', 'eo-feedback ' + (right ? 'is-ok' : 'is-no'));
          fb.appendChild(el('div', 'eo-fb-title', right
            ? 'Tebrikler, yanıtınız doğru!'
            : 'Yanıtınız yanlış! Doğru yanıt: ' + (LETTERS[m.answer] || '')));
          fb.appendChild(el('div', '', rich(m.explanation || (right
            ? 'Doğru seçeneği işaretlediniz.'
            : 'Doğru seçenek yukarıda yeşille gösterilmiştir.'))));
          qb.appendChild(fb);
        }
        stage.appendChild(qb);
      }

      var bar = el('div', 'eo-actions');
      var prev = el('button', 'eo-btn ghost sm', '← Önceki');
      prev.type = 'button'; prev.disabled = idx === 0;
      prev.addEventListener('click', function () { idx--; picked = null; draw(); });
      bar.appendChild(prev);
      bar.appendChild(el('span', 'eo-spacer'));

      if (m.question && answers[idx] == null) {
        var confirm = el('button', 'eo-btn accent', 'Yanıtı onayla');
        confirm.type = 'button';
        confirm.disabled = picked == null;
        confirm.addEventListener('click', function () {
          if (picked == null) return;
          answers[idx] = picked; picked = null; draw();
        });
        bar.appendChild(confirm);
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
        idx = 0; picked = null; answers = new Array(items.length).fill(null); draw();
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
      var lesson = lessons[opts.single.lesson] || lessons[0];
      var act = (lesson.activities || [])[opts.single.activity];
      if (act) renderActivity(act, lesson.kind, root, { bare: opts.bare });
      return;
    }

    var shell = el('div', 'eo-shell');
    var side = el('aside', 'eo-side');
    var brand = el('div', 'eo-brand');
    brand.innerHTML =
      '<div class="eo-eyebrow">' + esc(meta.eyebrow || 'etkileşimli çalışma seti') + '</div>' +
      '<h1>' + esc(meta.title || 'Çöz-Öğren') + '</h1>' +
      '<p>' + esc(meta.subtitle || '') + '</p>';
    side.appendChild(brand);

    var menuBtn = el('button', 'eo-menubtn', 'Bölümler');
    menuBtn.type = 'button';
    menuBtn.addEventListener('click', function () { side.classList.toggle('open'); });
    side.appendChild(menuBtn);

    // ---- Oyunlaştırma durumu ----
    var progKey = courseKey(data);
    var saved = store(progKey) || {};
    var doneMap = saved.done || saved;              // eski biçimle uyum
    if (typeof doneMap !== 'object' || doneMap === null) doneMap = {};
    var points = saved.points || 0;
    var earnedBadges = saved.badges || {};
    var earnedPts = saved.pts || {};

    var totalActs = 0;
    lessons.forEach(function (l) {
      (l.activities || []).forEach(function (a) { if ((a.items || []).length) totalActs++; });
    });

    function save() {
      store(progKey, { done: doneMap, points: points, badges: earnedBadges, pts: earnedPts });
    }

    // ---- Rütbe paneli ----
    var rank = el('div', 'eo-rank');
    rank.innerHTML =
      '<div class="eo-rank-top">' +
        '<div class="eo-rank-seal" data-seal>I</div>' +
        '<div class="eo-rank-info">' +
          '<div class="eo-rank-name" data-lvname>Başlangıç</div>' +
          '<div class="eo-rank-pts" data-pts>0 puan</div>' +
        '</div>' +
      '</div>' +
      '<div class="eo-rank-track"><i data-lvfill></i></div>' +
      '<div class="eo-rank-next" data-next></div>';
    side.appendChild(rank);

    function drawRank() {
      var lv = levelOf(points);
      rank.querySelector('[data-seal]').textContent = lv.level.mark;
      rank.querySelector('[data-lvname]').textContent = 'Seviye ' + (lv.index + 1) + ' · ' + lv.level.name;
      rank.querySelector('[data-pts]').textContent = trNum(points) + ' puan';
      var pct = 100, next = '';
      if (lv.next) {
        var span = lv.next.min - lv.level.min;
        pct = Math.max(0, Math.min(100, Math.round((points - lv.level.min) / span * 100)));
        next = lv.next.name + ' rütbesine ' + trNum(lv.next.min - points) + ' puan';
      } else { next = 'En üst rütbeye ulaştınız'; }
      rank.querySelector('[data-lvfill]').style.width = pct + '%';
      rank.querySelector('[data-next]').textContent = next;
    }

    // ---- İlerleme ----
    var prog = el('div', 'eo-progress');
    prog.innerHTML =
      '<div class="eo-prog-top"><span>İlerleme</span><b data-pct>%0</b></div>' +
      '<div class="eo-prog-track"><i data-fill></i></div>' +
      '<div class="eo-prog-meta"><span data-meta></span>' +
      '<button type="button" class="eo-prog-reset" data-reset>sıfırla</button></div>';
    side.appendChild(prog);

    function doneCount() { return Object.keys(doneMap).length; }
    function drawProgress() {
      var n = doneCount();
      var pct = totalActs ? Math.round(n / totalActs * 100) : 0;
      prog.querySelector('[data-pct]').textContent = '%' + pct;
      prog.querySelector('[data-fill]').style.width = pct + '%';
      prog.querySelector('[data-meta]').textContent = n + ' / ' + totalActs + ' etkinlik tamamlandı';
      prog.classList.toggle('is-full', totalActs > 0 && n >= totalActs);
    }
    prog.querySelector('[data-reset]').addEventListener('click', function () {
      doneMap = {}; points = 0; earnedBadges = {}; earnedPts = {};
      save(); drawRank(); drawProgress(); drawBadges(); draw();
    });

    // ---- Rozet vitrini ----
    var badgeBox = el('div', 'eo-badges');
    badgeBox.innerHTML = '<h4>Rozetler <span data-bcount></span></h4><div class="eo-badge-grid" data-bgrid></div>';
    side.appendChild(badgeBox);

    function drawBadges(newId) {
      var grid = badgeBox.querySelector('[data-bgrid]');
      grid.innerHTML = '';
      BADGES.forEach(function (b) {
        var got = !!earnedBadges[b.id];
        var cell = el('div', 'eo-badge' + (got ? ' is-earned' : '') + (b.id === newId ? ' is-new' : ''), icon(b.icon));
        cell.title = got ? b.name + ' — ' + b.desc : 'Kilitli: ' + b.desc;
        cell.setAttribute('aria-label', cell.title);
        grid.appendChild(cell);
      });
      badgeBox.querySelector('[data-bcount]').textContent =
        Object.keys(earnedBadges).length + '/' + BADGES.length;
    }

    function award(id) {
      if (earnedBadges[id]) return;
      var b = BADGES.filter(function (x) { return x.id === id; })[0];
      if (!b) return;
      earnedBadges[id] = Date.now();
      points += 25;
      save(); drawRank(); drawBadges(id);
      showAward(b);
    }

    // Aynı anda birden çok rozet kazanılabilir; bildirimler sırayla gösterilir.
    var awardQueue = [], awardShowing = false, awardTimer = null, awardHide = null;
    function showAward(b) {
      awardQueue.push(b);
      if (!awardShowing) { nextAward(); return; }
      // Sıradaki varken görünendeki bekleme kısalır, kuyruk tıkanmaz
      clearTimeout(awardTimer);
      awardTimer = setTimeout(awardHide, 1400);
    }
    function nextAward() {
      var b = awardQueue.shift();
      if (!b) { awardShowing = false; return; }
      awardShowing = true;
      var card = el('div', 'eo-award');
      card.setAttribute('role', 'status');
      card.innerHTML =
        '<div class="eo-award-seal">' + icon(b.icon) + '</div>' +
        '<div><div class="eo-award-kicker">Rozet kazanıldı · +25 puan</div>' +
        '<div class="eo-award-name">' + esc(b.name) + '</div>' +
        '<div class="eo-award-desc">' + esc(b.desc) + '</div></div>';
      document.body.appendChild(card);
      requestAnimationFrame(function () { card.classList.add('show'); });
      awardHide = function () {
        card.classList.remove('show');
        setTimeout(function () { card.remove(); nextAward(); }, 400);
      };
      clearTimeout(awardTimer);
      awardTimer = setTimeout(awardHide, awardQueue.length ? 2200 : 5000);
    }

    /** Bir bölümün tamamı bitti mi, tüm set bitti mi diye bakar. */
    function checkMilestones() {
      var allDone = totalActs > 0 && doneCount() >= totalActs;
      if (allDone) award('set-tamam');
      lessons.forEach(function (l, i) {
        var acts = (l.activities || []).filter(function (a) { return (a.items || []).length; });
        if (!acts.length) return;
        var d = acts.filter(function (a, ai) { return doneMap[i + ':' + ai]; }).length;
        if (d < acts.length) return;
        if (l.kind === 'cards') award('kart-ustasi');
        if (l.kind === 'quiz') award('test-tamam');
      });
    }

    function markDone(key, pts, kind, score) {
      if (doneMap[key]) return;
      doneMap[key] = 1;
      earnedPts[key] = pts;
      points += pts;
      save();
      award('ilk-adim');
      if (kind === 'crossword' && score === 1) award('bulmaca');
      if (kind === 'match' && score === 1) award('eslestirme');
      checkMilestones();
      drawRank(); drawProgress(); drawNav(); drawBadges();
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

    function drawNav() {
      nav.innerHTML = '';
      lessons.forEach(function (l, i) {
        var acts = (l.activities || []).filter(function (a) { return (a.items || []).length; });
        var d = acts.filter(function (a, ai) { return doneMap[i + ':' + ai]; }).length;
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
    }

    function draw() {
      drawRank();
      drawProgress();
      drawBadges();
      drawNav();
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
          completed: !!doneMap[key],
          earnedPoints: earnedPts[key],
          award: award,
          onDone: function (pts, score) { markDone(key, pts, l.kind, score); }
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
      if (current < lessons.length - 1) {
        var n = el('button', 'eo-btn', lessons[current + 1].title + ' →');
        n.type = 'button';
        n.addEventListener('click', function () { current++; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        bar.appendChild(n);
      }
      wrap.appendChild(bar);
    }

    draw();
    return { goTo: function (i) { current = i; draw(); } };
  }

  global.EO = { mount: mount, renderActivity: renderActivity, KIND_LABEL: KIND_LABEL, esc: esc, rich: rich };

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
