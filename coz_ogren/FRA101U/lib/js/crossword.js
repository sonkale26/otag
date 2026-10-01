/* ============================================================
   Çöz-Öğren — bulmaca motoru
   Kelime + ipucu listesinden ızgarayı kendisi kurar, kesişimleri
   en çoklayacak yerleşimi arar ve etkileşimi yönetir.
   ============================================================ */
(function (global) {
  'use strict';

  var TR_UP = { 'i': 'İ', 'ı': 'I', 'ş': 'Ş', 'ğ': 'Ğ', 'ü': 'Ü', 'ö': 'Ö', 'ç': 'Ç' };

  function upperTR(s) {
    return String(s || '').replace(/[iışğüöç]/g, function (c) { return TR_UP[c]; }).toUpperCase();
  }

  /** Yerleştirmeden önce cevabı sadeleştirir: harf dışındaki her şey atılır. */
  var HARF = /[^A-ZÇĞİÖŞÜÂÎÛ]/g;      // Türkçe abece + şapkalı harfler

  /** Karşılaştırma için tek biçim: birleşik (NFC) ve Türkçe kurallarıyla büyük. */
  function canon(ch) {
    return upperTR(String(ch == null ? '' : ch).normalize('NFC'));
  }

  /** İki harf aynı mı? Büyük/küçük ve birleşik/ayrışık yazım farkı gözetilmez;
      Türkçe harfler kendi karşılıklarıyla eşleşir (İ ile I ayrı harflerdir). */
  function esdeger(a, b) {
    if (!a || !b) return false;
    return canon(a) === canon(b);
  }

  function normalize(s) {
    return canon(s).replace(HARF, '');
  }

  function key(r, c) { return r + ',' + c; }

  /**
   * Kelimeleri kesişimli biçimde yerleştirir.
   * @returns {{placed:Array, skipped:Array, grid:Map, rows:number, cols:number}}
   */
  function layoutAttempt(words, mode) {
    var items = words
      .map(function (w, i) {
        return { text: normalize(w.answer), clue: w.clue || '', raw: w.answer || '', src: i };
      })
      .filter(function (w) { return w.text.length > 1; })
      .sort(function (a, b) {
        if (!mode) return b.text.length - a.text.length || a.src - b.src;
        var toplam = words.length || 1;
        var baslangic = (mode - 1) % toplam;
        var aUzaklik = (a.src - baslangic + toplam) % toplam;
        var bUzaklik = (b.src - baslangic + toplam) % toplam;
        return aUzaklik - bUzaklik || b.text.length - a.text.length;
      });

    var grid = new Map();
    var placed = [];
    var skipped = [];

    function letterAt(r, c) { return grid.has(key(r, c)) ? grid.get(key(r, c)) : null; }

    function fits(word, r, c, dir) {
      var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      var cross = 0;
      // Baş ve son komşusu boş olmalı — kelimeler birbirine yapışmasın
      if (letterAt(r - dr, c - dc) || letterAt(r + dr * word.length, c + dc * word.length)) return -1;
      for (var i = 0; i < word.length; i++) {
        var rr = r + dr * i, cc = c + dc * i;
        var cur = letterAt(rr, cc);
        if (cur) {
          if (cur !== word[i]) return -1;
          cross++;
        } else {
          // Yeni doldurulan hücrenin yanları boş olmalı
          var sr = dir === 'across' ? 1 : 0, sc = dir === 'across' ? 0 : 1;
          if (letterAt(rr - sr, cc - sc) || letterAt(rr + sr, cc + sc)) return -1;
        }
      }
      return cross;
    }

    function put(word, r, c, dir, item) {
      var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      for (var i = 0; i < word.length; i++) grid.set(key(r + dr * i, c + dc * i), word[i]);
      placed.push({ text: word, clue: item.clue, raw: item.raw, row: r, col: c, dir: dir, src: item.src });
    }

    items.forEach(function (item, idx) {
      var w = item.text;
      if (idx === 0) { put(w, 0, 0, 'across', item); return; }

      var best = null;
      var cur = getBounds();
      for (var i = 0; i < w.length; i++) {
        for (var j = 0; j < placed.length; j++) {
          var p = placed[j];
          for (var k = 0; k < p.text.length; k++) {
            if (p.text[k] !== w[i]) continue;
            var dir = p.dir === 'across' ? 'down' : 'across';
            var r, c;
            if (dir === 'down') { r = p.row - i; c = p.col + k; }
            else { r = p.row + k; c = p.col - i; }
            var score = fits(w, r, c, dir);
            if (score < 1) continue;
            // Kesişimi ödüllendir, ızgarayı büyüten ve orantısızlaştıran yerleşimi cezalandır
            var endR = r + (dir === 'down' ? w.length - 1 : 0);
            var endC = c + (dir === 'across' ? w.length - 1 : 0);
            var h = Math.max(cur.maxR, endR) - Math.min(cur.minR, r) + 1;
            var wd = Math.max(cur.maxC, endC) - Math.min(cur.minC, c) + 1;
            var total = score * 14 - (h * wd) * 0.05 - Math.abs(h - wd) * 0.6;
            if (!best || total > best.total) best = { r: r, c: c, dir: dir, total: total };
          }
        }
      }

      if (best) { put(w, best.r, best.c, best.dir, item); return; }

      // Ana ızgaraya kesişerek bağlanamayan kelime bu denemede atlanır.
      skipped.push(item.raw);
    });

    function getBounds() {
      var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
      grid.forEach(function (v, k) {
        var p = k.split(','), r = +p[0], c = +p[1];
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      });
      if (minR === Infinity) return { minR: 0, maxR: 0, minC: 0, maxC: 0 };
      return { minR: minR, maxR: maxR, minC: minC, maxC: maxC };
    }

    // Sol üst köşe 0,0 olacak şekilde kaydır
    var b = getBounds();
    var shifted = new Map();
    grid.forEach(function (v, k) {
      var p = k.split(',');
      shifted.set(key(+p[0] - b.minR, +p[1] - b.minC), v);
    });
    placed.forEach(function (p) { p.row -= b.minR; p.col -= b.minC; });

    // Numaralandırma: yukarıdan aşağı, soldan sağa
    placed.sort(function (a, x) { return a.row - x.row || a.col - x.col; });
    var nums = {};
    var n = 0;
    placed.forEach(function (p) {
      var kk = key(p.row, p.col);
      if (!nums[kk]) nums[kk] = ++n;
      p.num = nums[kk];
    });

    return {
      placed: placed,
      skipped: skipped,
      grid: shifted,
      rows: b.maxR - b.minR + 1,
      cols: b.maxC - b.minC + 1
    };
  }

  function layout(words) {
    var enIyi = layoutAttempt(words, 0);
    for (var deneme = 1; deneme <= words.length; deneme++) {
      var aday = layoutAttempt(words, deneme);
      var adayAlan = aday.rows * aday.cols;
      var enIyiAlan = enIyi.rows * enIyi.cols;
      if (aday.placed.length > enIyi.placed.length ||
          (aday.placed.length === enIyi.placed.length && adayAlan < enIyiAlan)) enIyi = aday;
    }
    return enIyi;
  }

  /** Yön kutusu: aktif yön, güncel ipucu ve kelimeler arası gezinme. */
  function yonKutusuOlustur() {
    var kutu = document.createElement('div');
    kutu.className = 'eo-cwbar';
    kutu.innerHTML =
      '<div class="eo-cwtop">' +
        '<span class="eo-cwdir" data-dir>Yatay <b>➤</b></span>' +
        '<span class="eo-cwnav">' +
          '<button type="button" class="eo-cwstep" data-prev aria-label="Önceki kelime">‹</button>' +
          '<button type="button" class="eo-cwstep" data-next aria-label="Sonraki kelime">›</button>' +
        '</span>' +
      '</div>' +
      '<div class="eo-cwclue" data-clue></div>' +
      '<div class="eo-cwhelp">Yönü değiştirmek için hücreye yeniden dokunun ya da boşluk tuşuna basın.</div>';
    return kutu;
  }

  /** Tek bir harf hücresi (kapalı hücreler boş div olarak kalır). */
  function hucreOlustur(satir, sutun, numara) {
    var hucre = document.createElement('div');
    hucre.className = 'eo-cell open';
    if (numara) hucre.innerHTML = '<span class="eo-cnum">' + numara + '</span>';
    var giris = document.createElement('input');
    giris.type = 'text';
    giris.setAttribute('maxlength', '2');
    giris.setAttribute('autocomplete', 'off');
    giris.setAttribute('autocorrect', 'off');
    giris.setAttribute('autocapitalize', 'none');   // 'i' → 'I' hatasını önler; büyütmeyi upperTR yapar
    giris.setAttribute('lang', 'tr');
    giris.setAttribute('spellcheck', 'false');
    giris.setAttribute('enterkeyhint', 'next');
    giris.setAttribute('aria-label', (satir + 1) + '. satır ' + (sutun + 1) + '. sütun');
    giris.dataset.r = satir;
    giris.dataset.c = sutun;
    hucre.appendChild(giris);
    return { el: hucre, input: giris };
  }

  /**
   * Bir yön için ipucu listesi kutusu üretir ve düğmeleri `kayit` haritasına yazar.
   * Liste boşsa null döner.
   */
  function ipucuListesiOlustur(baslik, kelimeler, kayit, secildi) {
    if (!kelimeler.length) return null;

    var kutu = document.createElement('div');
    kutu.className = 'eo-cluebox';
    var h = document.createElement('h4');
    h.textContent = baslik;

    var liste = document.createElement('ol');
    kelimeler.forEach(function (kelime) {
      var satir = document.createElement('li');
      var dugme = document.createElement('button');
      dugme.type = 'button';
      dugme.innerHTML = '<span class="eo-cn">' + kelime.num + '</span>' +
        '<span>' + escapeHtml(kelime.clue) +
        ' <span class="eo-cwlen">(' + kelime.text.length + ')</span></span>';
      dugme.addEventListener('click', function () { secildi(kelime); });
      satir.appendChild(dugme);
      liste.appendChild(satir);
      kayit[kelime.num + kelime.dir] = { li: satir, btn: dugme };
    });

    kutu.appendChild(h);
    kutu.appendChild(liste);
    return kutu;
  }

  /**
   * Bulmacayı verilen kapsayıcıya çizer ve etkileşimi bağlar.
   */
  function render(host, words, opts) {
    opts = opts || {};
    var model = layout(words || []);
    host.innerHTML = '';

    if (!model.placed.length) {
      host.innerHTML = '<div class="eo-empty">Bu bulmacada henüz kelime yok.</div>';
      return null;
    }

    var wrap = document.createElement('div');
    wrap.className = 'eo-puzzle';

    var left = document.createElement('div');
    left.className = 'eo-puzzle-left';

    var bar = yonKutusuOlustur();
    left.appendChild(bar);

    var scroll = document.createElement('div');
    scroll.className = 'eo-grid-scroll';
    var gridEl = document.createElement('div');
    gridEl.className = 'eo-grid dir-across';
    gridEl.style.gridTemplateColumns = 'repeat(' + model.cols + ', var(--cell, 34px))';
    scroll.appendChild(gridEl);
    left.appendChild(scroll);

    var cells = {};
    var startNums = {};
    model.placed.forEach(function (p) { startNums[key(p.row, p.col)] = p.num; });

    for (var r = 0; r < model.rows; r++) {
      for (var c = 0; c < model.cols; c++) {
        var letter = model.grid.get(key(r, c));
        if (!letter) {
          var kapali = document.createElement('div');
          kapali.className = 'eo-cell';
          gridEl.appendChild(kapali);
          continue;
        }
        var yeni = hucreOlustur(r, c, startNums[key(r, c)]);
        yeni.answer = letter;
        cells[key(r, c)] = yeni;
        gridEl.appendChild(yeni.el);
      }
    }

    // İpucu listeleri
    var right = document.createElement('div');
    right.className = 'eo-clues';
    var across = model.placed.filter(function (p) { return p.dir === 'across'; });
    var down = model.placed.filter(function (p) { return p.dir === 'down'; });
    var clueBtns = {};

    function clueList(title, arr) {
      return ipucuListesiOlustur(title, arr, clueBtns, function (p) { focusWord(p, true); });
    }

    var yatayListe = clueList('Soldan sağa', across);
    if (yatayListe) right.appendChild(yatayListe);
    var dikeyListe = clueList('Yukarıdan aşağı', down);
    if (dikeyListe) right.appendChild(dikeyListe);

    wrap.appendChild(left);
    wrap.appendChild(right);
    host.appendChild(wrap);

    // ---- Durum ----
    var dir = 'across';
    var active = null; // {r,c}

    function wordAt(r, c, d) {
      return model.placed.filter(function (p) {
        if (p.dir !== d) return false;
        if (d === 'across') return p.row === r && c >= p.col && c < p.col + p.text.length;
        return p.col === c && r >= p.row && r < p.row + p.text.length;
      })[0] || null;
    }

    function currentWord() {
      if (!active) return null;
      return wordAt(active.r, active.c, dir) ||
             wordAt(active.r, active.c, dir === 'across' ? 'down' : 'across');
    }

    function paint() {
      Object.keys(cells).forEach(function (k) {
        cells[k].el.classList.remove('is-active', 'is-word');
      });
      Object.keys(clueBtns).forEach(function (k) { clueBtns[k].btn.removeAttribute('aria-current'); });

      gridEl.classList.toggle('dir-across', dir === 'across');
      gridEl.classList.toggle('dir-down', dir === 'down');
      bar.classList.toggle('is-down', dir === 'down');
      bar.querySelector('[data-dir]').innerHTML = dir === 'across'
        ? 'Yatay · soldan sağa <b>➤</b>'
        : 'Dikey · yukarıdan aşağı <b>▼</b>';

      if (!active) { bar.querySelector('[data-clue]').textContent = ''; return; }

      var w = currentWord();
      if (w) {
        for (var i = 0; i < w.text.length; i++) {
          var rr = w.dir === 'down' ? w.row + i : w.row;
          var cc = w.dir === 'across' ? w.col + i : w.col;
          if (cells[key(rr, cc)]) cells[key(rr, cc)].el.classList.add('is-word');
        }
        var cb = clueBtns[w.num + w.dir];
        if (cb) cb.btn.setAttribute('aria-current', 'true');
        bar.querySelector('[data-clue]').innerHTML =
          '<span class="eo-cwnum">' + w.num + '</span>' + escapeHtml(w.clue) +
          ' <span class="eo-cwlen">(' + w.text.length + ' harf)</span>';
      } else {
        bar.querySelector('[data-clue]').textContent = '';
      }

      var cur = cells[key(active.r, active.c)];
      if (cur) cur.el.classList.add('is-active');
    }

    /**
     * Yerleşimi ölçüye göre seçer: ipucu sütununa yeterli genişlik kalıyorsa
     * ızgara solda kalır, kalmıyorsa ızgara üste alınıp ipuçları altına iner.
     * Hücre boyu da kalan alana göre ölçeklenir.
     */
    var IPUCU_MIN = 300, SUTUN_ARASI = 26, GAP = 1;
    // Yan yana kalabilmek için ızgarayı fazla küçültmeye değmez; 30px'in altına
    // düşmesi gerekiyorsa ipuçlarını alta almak daha okunur bir düzen verir.
    var YAN_MIN_HUCRE = 30, MIN_HUCRE = 22, MAX_HUCRE = 36;
    function fitGrid() {
      var toplam = wrap.clientWidth || host.clientWidth || 640;
      var cerceve = 4 + (model.cols - 1) * GAP;            // kenarlık + ayraçlar

      // Önce yan yana yerleşimi dene
      var yanAlan = toplam - IPUCU_MIN - SUTUN_ARASI;
      var yanBoy = Math.floor((yanAlan - cerceve) / model.cols);
      var altAlta = yanBoy < YAN_MIN_HUCRE;

      var boy = altAlta
        ? Math.floor((toplam - cerceve) / model.cols)
        : yanBoy;
      boy = Math.max(MIN_HUCRE, Math.min(MAX_HUCRE, boy));

      wrap.classList.toggle('is-stacked', altAlta);
      gridEl.style.setProperty('--cell', boy + 'px');
      gridEl.style.setProperty('--cnum', (boy < 27 ? 8 : 9) + 'px');

      // Sol sütunun genişliğini ızgara belirlesin; yön kutusu geniş diye
      // ipucu sütununu daraltmasın.
      left.style.width = altAlta ? '' : Math.max(model.cols * boy + cerceve, 300) + 'px';
    }

    function focusCell(r, c, silent) {
      var cell = cells[key(r, c)];
      if (!cell) return;
      active = { r: r, c: c };
      if (!silent) cell.input.focus({ preventScroll: false });
      paint();
    }

    function focusWord(p, scroll) {
      dir = p.dir;
      focusCell(p.row, p.col);
      if (scroll) cells[key(p.row, p.col)].el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function step(r, c, back) {
      var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      if (back) { dr = -dr; dc = -dc; }
      var nr = r + dr, nc = c + dc;
      if (cells[key(nr, nc)]) focusCell(nr, nc);
    }

    function etkilesimBagla() {
    gridEl.addEventListener('click', function (e) {
      var inp = e.target.closest('input');
      if (!inp) return;
      var r = +inp.dataset.r, c = +inp.dataset.c;
      var other = dir === 'across' ? 'down' : 'across';
      if (active && active.r === r && active.c === c) {
        // Aynı hücreye yeniden dokunuş: yalnızca o yönde kelime varsa yön değişir
        if (wordAt(r, c, other)) dir = other;
      } else if (!wordAt(r, c, dir)) {
        dir = other;
      }
      focusCell(r, c);
    });

    /** Kelimeler arasında sıradaki/önceki kelimeye geçer (mobilde ipucu listesine inmeden). */
    function jumpWord(step) {
      var order = model.placed.slice().sort(function (a, b) {
        return a.num - b.num || (a.dir === 'across' ? -1 : 1);
      });
      var cur = currentWord();
      var i = cur ? order.indexOf(cur) : -1;
      var next = order[((i + step) % order.length + order.length) % order.length];
      if (next) focusWord(next, true);
    }
    bar.querySelector('[data-prev]').addEventListener('click', function () { jumpWord(-1); });
    bar.querySelector('[data-next]').addEventListener('click', function () { jumpWord(1); });

    gridEl.addEventListener('input', function (e) {
      var inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      var v = inp.value.normalize('NFC');     // ayrışık yazılan 'ü' tek harfe toplansın
      if (v === ' ') {                       // mobil klavyede boşluk = yön değiştir
        inp.value = '';
        var other = dir === 'across' ? 'down' : 'across';
        if (active && wordAt(active.r, active.c, other)) { dir = other; paint(); }
        return;
      }
      var ch = canon(v.slice(-1)).replace(HARF, '');
      inp.value = ch;
      inp.parentElement.classList.remove('is-ok', 'is-no');
      if (ch) step(+inp.dataset.r, +inp.dataset.c, false);
      if (opts.onChange) opts.onChange(progress());
    });

    gridEl.addEventListener('keydown', function (e) {
      var inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      var r = +inp.dataset.r, c = +inp.dataset.c;
      if (e.key === ' ') {
        e.preventDefault();
        var other = dir === 'across' ? 'down' : 'across';
        if (wordAt(r, c, other)) { dir = other; paint(); }
        return;
      }
      if (e.key === 'Backspace') {
        if (!inp.value) { e.preventDefault(); step(r, c, true); }
        else { inp.parentElement.classList.remove('is-ok', 'is-no'); }
        return;
      }
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        var want = (e.key === 'ArrowUp' || e.key === 'ArrowDown') ? 'down' : 'across';
        if (dir !== want) { dir = want; paint(); }
        var nr = r + moves[e.key][0], nc = c + moves[e.key][1];
        var guard = 0;
        while (!cells[key(nr, nc)] && guard++ < 30 && nr >= -1 && nc >= -1 && nr <= model.rows && nc <= model.cols) {
          nr += moves[e.key][0]; nc += moves[e.key][1];
        }
        if (cells[key(nr, nc)]) focusCell(nr, nc);
      }
    });

    }   // etkilesimBagla sonu

    function progress() {
      var filled = 0, total = 0, correct = 0;
      Object.keys(cells).forEach(function (k) {
        total++;
        var v = cells[k].input.value;
        if (v) filled++;
        if (esdeger(v, cells[k].answer)) correct++;
      });
      return { filled: filled, total: total, correct: correct, solved: correct === total };
    }

    var api = {
      check: function () {
        var solvedWords = 0;
        model.placed.forEach(function (p) {
          var ok = true;
          for (var i = 0; i < p.text.length; i++) {
            var rr = p.dir === 'down' ? p.row + i : p.row;
            var cc = p.dir === 'across' ? p.col + i : p.col;
            var cell = cells[key(rr, cc)];
            if (!cell) continue;
            if (!esdeger(cell.input.value, cell.answer)) ok = false;
          }
          var cb = clueBtns[p.num + p.dir];
          if (cb) cb.li.classList.toggle('solved', ok);
          if (ok) solvedWords++;
        });
        Object.keys(cells).forEach(function (k) {
          var cell = cells[k];
          cell.el.classList.remove('is-ok', 'is-no');
          if (!cell.input.value) return;
          cell.el.classList.add(esdeger(cell.input.value, cell.answer) ? 'is-ok' : 'is-no');
        });
        return { words: model.placed.length, solvedWords: solvedWords, cells: progress() };
      },
      reveal: function () {
        Object.keys(cells).forEach(function (k) {
          cells[k].input.value = cells[k].answer;
          cells[k].el.classList.remove('is-no');
          cells[k].el.classList.add('is-ok');
        });
        Object.keys(clueBtns).forEach(function (k) { clueBtns[k].li.classList.add('solved'); });
        return progress();
      },
      clear: function () {
        Object.keys(cells).forEach(function (k) {
          cells[k].input.value = '';
          cells[k].el.classList.remove('is-ok', 'is-no');
        });
        Object.keys(clueBtns).forEach(function (k) { clueBtns[k].li.classList.remove('solved'); });
        return progress();
      },
      progress: progress,
      model: model
    };

    etkilesimBagla();
    fitGrid();
    focusWord(model.placed[0]);
    // Dinleyici motorun ortak yönetiminden geçer; yoksa kendi başımıza bağlanırız
    if (global.EO && global.EO.onResize) {
      global.EO.onResize(fitGrid);
    } else {
      var fitTimer = null;
      window.addEventListener('resize', function () {
        clearTimeout(fitTimer);
        fitTimer = setTimeout(fitGrid, 120);
      });
    }
    api.fit = fitGrid;
    return api;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.EOCrossword = { layout: layout, render: render, normalize: normalize,
    upperTR: upperTR, esdeger: esdeger, canon: canon };
})(window);
