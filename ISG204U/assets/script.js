/* =========================================================
   Reusable course-content script engine
   Generic building blocks — each future chapter page supplies
   its own data and calls these init functions from an inline
   <script> block at the bottom of its HTML.
   ========================================================= */

/* ---------- NACE-style code calculator (generic) ----------
   Extracts digits 2..7 (1-indexed) from a registry-style number
   and shows how it maps to a worked example. Reusable for any
   "extract code from ID" teaching pattern. */
function initCodeCalculator(opts){
  const {inputId, buttonId, errorId, resultId, exampleCode, exampleDesc, exampleClass, exampleClassTag} = opts;
  const btn=document.getElementById(buttonId);
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const raw=document.getElementById(inputId).value;
    const digits=raw.replace(/[^0-9]/g,'');
    const errEl=document.getElementById(errorId);
    const resEl=document.getElementById(resultId);
    if(digits.length<7){
      errEl.classList.add('show');
      resEl.classList.remove('show');
      return;
    }
    errEl.classList.remove('show');
    const code=digits.substring(1,7);
    const formatted = code.substring(0,2)+'.'+code.substring(2,4)+'.'+code.substring(4,6);
    resEl.innerHTML = `Sicil numarasının soldan 2. rakamından başlayarak 7. rakama kadar olan basamaklar alındı:
      <div class="nace-code" style="margin:8px 0;">${formatted}</div>
      Metindeki örnekte olduğu gibi <b>${exampleCode}</b> kodu "${exampleDesc}" işlerini tarif eder ve
      <span class="tag ${exampleClass}">${exampleClassTag}</span> sınıfa girer. Kendi kodunuzun sınıfını öğrenmek
      için ilgili Tebliğ ekindeki listeye başvurmanız gerekir.`;
    resEl.classList.add('show');
  });
}

/* ---------- Flip cards ----------
   items: [{tag, tagText, title, text}] */
function initFlipCards(containerId, items){
  const wrap=document.getElementById(containerId);
  if(!wrap) return;
  items.forEach(item=>{
    const card=document.createElement('div');
    card.className='flip-card';
    card.innerHTML=`
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <span class="tag ${item.tag}">${item.tagText}</span>
          <h4>${item.title}</h4>
          <div class="hint">Açıklamak için karta tıklayın &rarr;</div>
        </div>
        <div class="flip-face flip-back">${item.text}</div>
      </div>`;
    card.addEventListener('click',()=>card.classList.toggle('flipped'));
    wrap.appendChild(card);
  });
}

/* ---------- True / False check ----------
   Call answerTF(btn, isCorrectChoice) from inline onclick.
   Markup expected: .tf-box > .tf-btns > .tf-btn (x2), and .tf-fb */
function answerTF(btn, isCorrectChoice){
  const box=btn.closest('.tf-box');
  if(box.dataset.answered==='true') return;
  box.dataset.answered='true';
  const btns=box.querySelectorAll('.tf-btn');
  btns.forEach(b=>b.setAttribute('disabled','true'));
  btn.classList.add(isCorrectChoice?'correct':'wrong');
  if(!isCorrectChoice){
    btns.forEach(b=>{ if(b!==btn) b.classList.add('correct'); });
  }
  const fb=box.querySelector('.tf-fb');
  const prefix = isCorrectChoice ? 'Tebrikler yanıtınız doğru! ' : 'Yanıtınız yanlış! ';
  const color  = isCorrectChoice ? 'var(--green)' : 'var(--red)';
  fb.innerHTML = `<b style="color:${color}">${prefix}</b>` + fb.innerHTML;
  fb.classList.add('show');
}

/* ---------- Generic pointer-based drag & drop ----------
   Works for both mouse and touch. onDropCheck(el, target) is
   called with the dropped element and the target it landed on
   (or null handling is done by the caller re-appending).

   Stability notes:
   - Move/up listeners are attached to `window`, not to the dragged chip
     itself. Relying on the chip's own listeners requires the browser to
     honor setPointerCapture reliably; inside iframed/embedded webviews
     that support is inconsistent, and once the pointer leaves the chip's
     original bounds without capture the chip stops tracking the cursor —
     this is the "takılma" (stuck mid-drag) failure mode. Listening on the
     window instead means the drag keeps tracking no matter where the
     pointer moves, with no dependency on capture semantics.
   - Every window listener is scoped to the specific pointerId that started
     the drag, so a second finger (e.g. incidental multi-touch) can't hijack
     or interrupt an in-progress drag.
   - Only one drag can be active at a time (module-level guard). Starting a
     new drag first force-finishes any drag left dangling by a previous
     interrupted gesture, so a chip can never get permanently stuck.
   - blur/visibilitychange are a last-resort safety net in case pointerup
     never fires at all (e.g. the app was backgrounded mid-drag).
   - A 'drag-active' class is toggled on <body> so CSS can freeze page
     scrolling while a chip is being dragged (see styles.css). */
let _activeDragEnd = null;

function makeDraggable(el, onDropCheck, onSettled){
  let offsetX=0, offsetY=0, origParent=null, placeholder=null, dragging=false, lastEvt=null, activePointerId=null;

  el.addEventListener('pointerdown', startDrag);

  function startDrag(e){
    if(e.pointerType==='touch' && e.isPrimary===false) return; // ignore secondary touches (pinch etc.)
    // If a previous drag never cleaned itself up, force it to finish first.
    if(_activeDragEnd) _activeDragEnd();

    e.preventDefault();
    dragging=true;
    activePointerId=e.pointerId;
    lastEvt=e;
    _activeDragEnd=()=>endDrag(lastEvt);
    document.body.classList.add('drag-active');

    const rect=el.getBoundingClientRect();
    offsetX=e.clientX-rect.left;
    offsetY=e.clientY-rect.top;
    origParent=el.parentElement;
    placeholder=document.createElement('div');
    placeholder.style.width=rect.width+'px';
    placeholder.style.height=rect.height+'px';
    placeholder.style.opacity='0';
    origParent.insertBefore(placeholder, el);
    document.body.appendChild(el);
    el.style.position='fixed';
    el.style.width=rect.width+'px';
    el.style.zIndex=999;
    el.classList.add('dragging');
    moveTo(e.clientX, e.clientY);
    // Best-effort only — the drag no longer depends on this succeeding.
    try{ el.setPointerCapture(e.pointerId); }catch(err){/* no-op */}
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
  function onMove(e){
    if(!dragging || e.pointerId!==activePointerId) return;
    lastEvt=e;
    moveTo(e.clientX, e.clientY);
    document.querySelectorAll('.dd-target, .match-slot, [data-drop-pool]').forEach(t=>t.classList.remove('over'));
    const target=findDropTarget(e.clientX,e.clientY);
    if(target) target.classList.add('over');
  }
  function onUp(e){
    if(!dragging || e.pointerId!==activePointerId) return;
    endDrag(e);
  }
  function moveTo(x,y){
    el.style.left=(x-offsetX)+'px';
    el.style.top=(y-offsetY)+'px';
  }
  function findDropTarget(x,y){
    if(typeof x!=='number' || typeof y!=='number') return null;
    el.style.pointerEvents='none';
    const under=document.elementFromPoint(x,y);
    el.style.pointerEvents='';
    if(!under) return null;
    return under.closest('.dd-target, .match-slot, [data-drop-pool]');
  }
  function endDrag(e){
    if(!dragging) return;
    dragging=false;
    _activeDragEnd=null;
    document.body.classList.remove('drag-active');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    try{
      const pid = (e && typeof e.pointerId==='number') ? e.pointerId : activePointerId;
      if(typeof pid==='number' && el.hasPointerCapture && el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
    }catch(err){/* no-op */}
    activePointerId=null;
    el.classList.remove('dragging');
    el.style.position='';
    el.style.left=''; el.style.top=''; el.style.width=''; el.style.zIndex='';
    document.querySelectorAll('.dd-target, .match-slot, [data-drop-pool]').forEach(t=>t.classList.remove('over'));
    const cx = e && typeof e.clientX==='number' ? e.clientX : null;
    const cy = e && typeof e.clientY==='number' ? e.clientY : null;
    const target = cx!==null ? findDropTarget(cx,cy) : null;
    if(placeholder && placeholder.parentNode) placeholder.remove();
    if(el.parentElement===document.body){
      if(target){
        onDropCheck(el, target);
      } else {
        origParent.appendChild(el);
      }
    }
    refreshAllDropZones();
    if(typeof onSettled==='function') onSettled();
  }
}

/* Recomputes every drop zone's overall correct/wrong border state from
   whatever is currently inside it: bucket-sort targets aggregate all their
   chips, match slots reflect their single definition. Safe to call
   unconditionally after every drag ends, regardless of which activities
   (if any) are present on the page. */
function refreshAllDropZones(){
  document.querySelectorAll('.dd-target').forEach(target=>{
    const chips=target.querySelectorAll('.dd-chip');
    target.classList.remove('correct-drop','wrong-drop');
    if(chips.length===0) return;
    const allCorrect=Array.from(chips).every(c=>c.classList.contains('chip-correct'));
    target.classList.add(allCorrect ? 'correct-drop' : 'wrong-drop');
  });
  document.querySelectorAll('.match-slot').forEach(slot=>{
    const def=slot.querySelector('.match-def');
    slot.classList.remove('correct-drop','wrong-drop');
    if(!def) return;
    slot.classList.add(def.classList.contains('def-correct') ? 'correct-drop' : 'wrong-drop');
  });
}

/* Last-resort safety net: if the browser never delivers pointerup/pointercancel
   at all (app backgrounded mid-drag, OS-level interruption, etc.), these force
   the active drag to finish instead of leaving a chip floating on screen. */
window.addEventListener('blur', ()=>{ if(_activeDragEnd) _activeDragEnd(); }, {capture:true});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && _activeDragEnd) _activeDragEnd();
});

function shuffleArray(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* ---------- Bucket-sort drag & drop activity ----------
   buckets: [{key, label}], items: [{label, correct(=key)}]
   A bucket is allowed to receive more than one chip — several items can
   legitimately share the same correct bucket, so targets no longer reject
   a chip just because they already hold one. Chips stay draggable after
   being placed, so they can be moved straight from one bucket to another,
   or dragged back onto the pool to unsort them. Each chip is colored
   individually (chip-correct / chip-wrong) and a target's own border
   reflects the aggregate of everything currently inside it. */
function initBucketSort(poolId, targetsId, buckets, items, revealBtnId){
  const revealBtn = revealBtnId ? document.getElementById(revealBtnId) : null;
  let errorSeen = false;

  // Enable the "Yanıtları gör" button once a chip has been placed in the wrong
  // bucket; it stays enabled until the activity is reset.
  function updateReveal(){
    if(!revealBtn) return;
    const targets=document.getElementById(targetsId);
    if(targets && targets.querySelector('.chip-wrong')) errorSeen=true;
    revealBtn.disabled = !errorSeen;
  }

  // Move every chip into its correct bucket and mark it correct.
  function solve(){
    const pool=document.getElementById(poolId);
    const targets=document.getElementById(targetsId);
    const allTargets=Array.from(targets.querySelectorAll('.dd-target'));
    const chips=[...pool.querySelectorAll('.dd-chip'), ...targets.querySelectorAll('.dd-chip')];
    chips.forEach(chip=>{
      const item=items[parseInt(chip.dataset.idx)];
      const target=allTargets.find(t=>t.dataset.key===item.correct);
      if(!target) return;
      target.appendChild(chip);
      chip.classList.add('placed','chip-correct');
      chip.classList.remove('chip-wrong');
    });
    refreshAllDropZones();
    updateReveal();
  }

  function render(){
    errorSeen=false;
    const pool=document.getElementById(poolId);
    const targets=document.getElementById(targetsId);
    pool.innerHTML=''; targets.innerHTML='';
    pool.dataset.dropPool='true';
    buckets.forEach(b=>{
      const t=document.createElement('div');
      t.className='dd-target';
      t.dataset.key=b.key;
      t.innerHTML=`<div class="dd-target-label">${b.label}</div>`;
      targets.appendChild(t);
    });
    items.forEach((item,i)=>{
      const chip=document.createElement('div');
      chip.className='dd-chip';
      chip.textContent=item.label;
      chip.dataset.idx=i;
      pool.appendChild(chip);
      makeDraggable(chip, (el,target)=>{
        if(target.dataset && target.dataset.dropPool){
          el.classList.remove('placed','chip-correct','chip-wrong');
          target.appendChild(el);
          return;
        }
        if(!target.classList.contains('dd-target')){ pool.appendChild(el); el.classList.remove('placed','chip-correct','chip-wrong'); return; }
        const key=target.dataset.key;
        target.appendChild(el);
        el.classList.add('placed');
        if(key===item.correct){
          el.classList.add('chip-correct'); el.classList.remove('chip-wrong');
        } else {
          el.classList.add('chip-wrong'); el.classList.remove('chip-correct');
        }
        // refreshAllDropZones() (called by makeDraggable after this returns)
        // recomputes this target's aggregate correct/wrong border.
      }, updateReveal);
    });
    updateReveal();
  }

  if(revealBtn) revealBtn.addEventListener('click', solve);
  render();
  return render; // so caller can wire up a reset button
}

/* ---------- Term/definition matching drag & drop ----------
   pairs: [{term, def}] — definitions are shuffled into the pool,
   terms become fixed drop slots. Definitions stay draggable once placed,
   so a wrong match can be dragged straight into another slot or back to
   the pool; dropping onto an already-occupied slot swaps the previous
   occupant back to the pool automatically. */
function initMatchActivity(poolId, slotsId, pairs, revealBtnId){
  const revealBtn = revealBtnId ? document.getElementById(revealBtnId) : null;
  let errorSeen = false;

  // Enable the "Yanıtları gör" button once a definition has been dropped on the
  // wrong term slot; it stays enabled until the activity is reset.
  function updateReveal(){
    if(!revealBtn) return;
    const slots=document.getElementById(slotsId);
    if(slots && slots.querySelector('.def-wrong')) errorSeen=true;
    revealBtn.disabled = !errorSeen;
  }

  // Drop every definition onto its matching term slot and mark it correct.
  function solve(){
    const pool=document.getElementById(poolId);
    const slots=document.getElementById(slotsId);
    const allSlots=Array.from(slots.querySelectorAll('.match-slot'));
    const defs=[...pool.querySelectorAll('.match-def'), ...slots.querySelectorAll('.match-def')];
    defs.forEach(def=>{
      const idx=parseInt(def.dataset.idx);
      const slot=allSlots.find(s=>parseInt(s.dataset.idx)===idx);
      if(!slot) return;
      slot.appendChild(def);
      def.classList.add('placed','def-correct');
      def.classList.remove('def-wrong');
    });
    refreshAllDropZones();
    updateReveal();
  }

  function render(){
    errorSeen=false;
    const pool=document.getElementById(poolId);
    const slots=document.getElementById(slotsId);
    pool.innerHTML=''; slots.innerHTML='';
    pool.dataset.dropPool='true';
    const order=shuffleArray(pairs.map((p,i)=>i));
    pairs.forEach((p,i)=>{
      const s=document.createElement('div');
      s.className='match-slot';
      s.dataset.idx=i;
      s.innerHTML=`<div class="term">${p.term}</div>`;
      slots.appendChild(s);
    });
    order.forEach(i=>{
      const d=document.createElement('div');
      d.className='match-def';
      d.textContent=pairs[i].def;
      d.dataset.idx=i;
      pool.appendChild(d);
      makeDraggable(d,(el,target)=>{
        if(target.dataset && target.dataset.dropPool){
          el.classList.remove('placed','def-correct','def-wrong');
          target.appendChild(el);
          return;
        }
        if(!target.classList.contains('match-slot')){ pool.appendChild(el); el.classList.remove('placed','def-correct','def-wrong'); return; }
        const existing=target.querySelector('.match-def');
        if(existing && existing!==el){
          existing.classList.remove('placed','def-correct','def-wrong');
          pool.appendChild(existing);
        }
        target.appendChild(el);
        el.classList.add('placed');
        const slotIdx=parseInt(target.dataset.idx);
        if(slotIdx===i){ el.classList.add('def-correct'); el.classList.remove('def-wrong'); }
        else { el.classList.add('def-wrong'); el.classList.remove('def-correct'); }
        // refreshAllDropZones() (called by makeDraggable after this returns)
        // recomputes this slot's correct/wrong border from el's class.
      }, updateReveal);
    });
    updateReveal();
  }

  if(revealBtn) revealBtn.addEventListener('click', solve);
  render();
  return render;
}

/* ---------- Searchable / filterable list ---------- */
function initSearchList(inputId, listId, countId, sourceData){
  function renderList(data){
    const box=document.getElementById(listId);
    box.innerHTML='';
    if(data.length===0){
      box.innerHTML='<div class="no-results">Sonuç bulunamadı.</div>';
    } else {
      data.forEach(item=>{
        const div=document.createElement('div');
        div.className='list-item';
        div.textContent=item;
        box.appendChild(div);
      });
    }
    document.getElementById(countId).textContent = data.length + ' / ' + sourceData.length + ' madde';
  }
  document.getElementById(inputId).addEventListener('input', (e)=>{
    const q=e.target.value.trim().toLocaleLowerCase('tr');
    const filtered = q==='' ? sourceData : sourceData.filter(x=>x.toLocaleLowerCase('tr').includes(q));
    renderList(filtered);
  });
  renderList(sourceData);
}

/* ---------- Tabbed category list ----------
   data: {categoryName: [items...]} */
function initTabbedList(tabsId, listId, data){
  const categories=Object.keys(data);
  let current=categories[0];
  function renderTabs(){
    const tabsEl=document.getElementById(tabsId);
    tabsEl.innerHTML='';
    categories.forEach(cat=>{
      const btn=document.createElement('button');
      btn.className='tab-btn'+(cat===current?' active':'');
      btn.textContent=cat;
      btn.onclick=()=>{ current=cat; renderTabs(); renderList(); };
      tabsEl.appendChild(btn);
    });
  }
  function renderList(){
    const list=document.getElementById(listId);
    list.innerHTML='';
    data[current].forEach((item,idx)=>{
      const div=document.createElement('div');
      div.className='list-item';
      div.innerHTML=`<b>${idx+1}.</b> ${item}`;
      list.appendChild(div);
    });
  }
  renderTabs();
  renderList();
}

/* ---------- Scroll affordance (edge-of-content hint) ----------
   Attaches a small pill (see .scroll-hint in styles.css) to any region
   that scrolls independently of the page (wide tables, long lists, the
   flip-card back face). It only appears while there is unseen content in
   that direction and fades out once the user scrolls there — a light
   teaching aid so a sideways/inner scroll area doesn't get mistaken for
   "stuck" page scrolling. */
function attachScrollHint(el, axis){
  if(!el || el.dataset.scrollHintInit) return;
  el.dataset.scrollHintInit='true';

  const hint=document.createElement('div');
  hint.className='scroll-hint '+(axis==='x' ? 'scroll-hint-x' : 'scroll-hint-y');
  hint.textContent = axis==='x' ? 'Kaydır →' : '↓ Devamı var';
  hint.setAttribute('aria-hidden','true');

  function ensureHintAttached(){
    if(!el.contains(hint)) el.appendChild(hint);
  }
  function check(){
    ensureHintAttached();
    const overflowing = axis==='x'
      ? el.scrollWidth > el.clientWidth+2
      : el.scrollHeight > el.clientHeight+2;
    const scrolledAway = axis==='x' ? el.scrollLeft>10 : el.scrollTop>10;
    el.classList.toggle('has-scroll-hint', overflowing && !scrolledAway);
  }

  ensureHintAttached();
  el.addEventListener('scroll', check, {passive:true});
  window.addEventListener('resize', check);
  const mo=new MutationObserver(()=>requestAnimationFrame(check));
  mo.observe(el, {childList:true, subtree:true});
  check();
}

function initScrollHints(){
  document.querySelectorAll('.table-scroll').forEach(el=>attachScrollHint(el,'x'));
  document.querySelectorAll('.list-box').forEach(el=>attachScrollHint(el,'y'));
  document.querySelectorAll('.flip-back').forEach(el=>attachScrollHint(el,'y'));
}

/* ---------- Quiz Engine ---------- */
/* quizData: [{q, options:[...], correct: idx}] */
function initQuiz(opts){
  const {containerId, positionId, scoreId, resetBtnSelector, quizData} = opts;
  let answered = new Array(quizData.length).fill(null);
  let score = 0;
  let index = 0;

  function render(){
    const container=document.getElementById(containerId);
    container.innerHTML='';
    const item=quizData[index];
    const card=document.createElement('div');
    card.className='quiz-card';
    let optsHtml='';
    item.options.forEach((opt,i)=>{
      optsHtml += `<button class="opt" data-idx="${i}">${String.fromCharCode(65+i)}) ${opt}</button>`;
    });
    card.innerHTML = `<div class="quiz-q"><span class="qn">${index+1}.</span>${item.q}</div>${optsHtml}<div class="quiz-fb"></div>`;
    container.appendChild(card);

    card.querySelectorAll('.opt').forEach(btn=>{
      btn.addEventListener('click', ()=>answer(parseInt(btn.dataset.idx)));
    });

    document.getElementById(positionId).textContent = `Soru ${index+1} / ${quizData.length}`;
    document.getElementById(scoreId).textContent = `Doğru: ${score}`;

    if(answered[index]!==null) lock(answered[index]);

    let nav=document.getElementById(containerId+'-nav');
    if(!nav){
      nav=document.createElement('div');
      nav.id=containerId+'-nav';
      nav.style.cssText='display:flex;justify-content:space-between;margin-top:6px;';
      nav.innerHTML=`<button class="reset-btn" data-act="prev">&larr; Önceki</button><button class="reset-btn" data-act="next">Sonraki &rarr;</button>`;
      container.insertAdjacentElement('afterend', nav);
      nav.querySelector('[data-act="prev"]').addEventListener('click', prev);
      nav.querySelector('[data-act="next"]').addEventListener('click', next);
    }
  }
  function answer(idx){
    if(answered[index]!==null) return;
    answered[index]=idx;
    const item=quizData[index];
    if(idx===item.correct) score++;
    lock(idx);
    document.getElementById(scoreId).textContent = `Doğru: ${score}`;
  }
  function lock(chosenIdx){
    const item=quizData[index];
    const container=document.getElementById(containerId);
    const opts=container.querySelectorAll('.opt');
    opts.forEach((btn,i)=>{
      btn.setAttribute('disabled','true');
      if(i===item.correct) btn.classList.add('correct');
      else if(i===chosenIdx) btn.classList.add('wrong');
    });
    const fb=container.querySelector('.quiz-fb');
    fb.classList.add('show');
    fb.textContent = chosenIdx===item.correct ? "Doğru." : `Doğru cevap: ${String.fromCharCode(65+item.correct)}) ${item.options[item.correct]}`;
  }
  function next(){ if(index<quizData.length-1){ index++; render(); } }
  function prev(){ if(index>0){ index--; render(); } }
  function reset(){ answered=new Array(quizData.length).fill(null); score=0; index=0; render(); }

  if(resetBtnSelector){
    document.querySelector(resetBtnSelector).addEventListener('click', reset);
  }
  render();
  return {reset, next, prev};
}

/* ---------- Scrollspy + section fade-in + back-to-top ---------- */
function initScrollEffects(){
  const sections=document.querySelectorAll('section[id]');
  const navLinks=document.querySelectorAll('.nav-links a');

  const io=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) entry.target.classList.add('in-view');
    });
  }, {threshold:0.12});
  sections.forEach(s=>io.observe(s));

  const spy=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        navLinks.forEach(l=>l.classList.remove('active'));
        const link=document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
        if(link) link.classList.add('active');
      }
    });
  }, {rootMargin:'-40% 0px -55% 0px'});
  sections.forEach(s=>spy.observe(s));

  const topLink=document.getElementById('top-link');
  if(topLink){
    window.addEventListener('scroll', ()=>{
      topLink.classList.toggle('show', window.scrollY>600);
    });
  }
}

/* Auto-init the parts every page needs regardless of content */
document.addEventListener('DOMContentLoaded', initScrollEffects);
document.addEventListener('DOMContentLoaded', initScrollHints);
