/* haluku · bağımsız sürüm · yerel veri katmanı
 *
 * haluku editörü normalde Claude Desktop'un başlattığı yerel bir sunucuyla konuşur. Bu dosya o
 * sunucunun işini tarayıcıda yapar: editörün /api/... isteklerini yakalar, projeleri bu tarayıcının
 * IndexedDB deposunda saklar, yapay zekâ için istemi hazırlar, gelen cevabı doğrular, SCORM paketini
 * ve web sayfasını üretir. Doğrulama kuralları sunucudaki src/shared/schema.ts ile aynıdır.
 */
(() => {
  "use strict";

  const SABLON = window.HALUKU_SABLON || null;
  const SURUM = (SABLON && SABLON.surum) || "0.0.0";
  const gercekFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  const simdi = () => new Date().toISOString();

  class YerelHata extends Error {
    constructor(mesaj, durum = 400, ayrintilar = []) {
      super(mesaj);
      this.durum = durum;
      this.ayrintilar = ayrintilar;
    }
  }

  // ------------------------------------------------------------------ zaman ve öğeler

  function sureYaz(saniye) {
    if (!Number.isFinite(saniye) || saniye < 0) saniye = 0;
    const onda = Math.round(saniye * 10);
    const tam = Math.floor(onda / 10);
    const kesir = onda % 10;
    const sa = Math.floor(tam / 3600);
    const dk = Math.floor((tam % 3600) / 60);
    const sn = String(tam % 60).padStart(2, "0") + (kesir ? `.${kesir}` : "");
    return sa > 0 ? `${sa}:${String(dk).padStart(2, "0")}:${sn}` : `${dk}:${sn}`;
  }

  const TUR_SIRASI = { bookmark: 0, popup: 1, question: 2 };
  const TUR_ADLARI = { bookmark: "Yer imi", question: "Soru", popup: "Pop-up" };
  const TUR_ONEKI = { bookmark: "y", question: "s", popup: "p" };
  const SECENEK_KIMLIKLERI = ["a", "b", "c", "d", "e", "f", "g", "h"];

  const ogeleriSirala = (ogeler) => [...ogeler].sort((a, b) => a.at - b.at || TUR_SIRASI[a.type] - TUR_SIRASI[b.type]);

  function ogeOzeti(oge) {
    if (oge.type === "bookmark") return oge.title;
    if (oge.type === "question") return oge.prompt;
    return oge.title ? `${oge.title}: ${oge.body}` : oge.body;
  }

  function yeniKimlik(onek) {
    return `${onek}_${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
  }

  // ------------------------------------------------------------------ doğrulama

  const MAX_SANIYE = 24 * 3600;
  const KIMLIK = /^[A-Za-z0-9_-]{1,40}$/;
  const PROJE_KIMLIGI = /^[a-z0-9][a-z0-9-]{0,59}$/;
  const VIDEO_KIMLIGI = /^[A-Za-z0-9_-]{11}$/;
  const SORU_TIPLERI = ["single", "multiple", "truefalse"];
  const ALAN_ADLARI = {
    at: "Zaman", title: "Başlık", prompt: "Soru metni", options: "Seçenekler", text: "Seçenek", body: "Metin",
    link: "Bağlantı", duration: "Süre", retryFrom: "Tekrar izletme zamanı", kind: "Soru tipi", type: "Tür", videoId: "Video"
  };
  const etiket = (alan, mesaj) => `${ALAN_ADLARI[alan] ?? alan}: ${mesaj}`;
  const sayiMi = (d) => typeof d === "number" && Number.isFinite(d);

  function saniyeAlani(d, alan, h) {
    if (!sayiMi(d)) {
      h.push(etiket(alan, "Sayı olmalı"));
      return 0;
    }
    if (d < 0) h.push(etiket(alan, "Zaman negatif olamaz"));
    if (d > MAX_SANIYE) h.push(etiket(alan, "Zaman çok büyük"));
    return d;
  }

  function metinAlani(d, alan, h, { min = 0, max = Infinity, minMesaj = "Boş olamaz", maxMesaj, varsayilan } = {}) {
    if (d === undefined && varsayilan !== undefined) return varsayilan;
    if (typeof d !== "string") {
      h.push(etiket(alan, "Metin olmalı"));
      return "";
    }
    const t = d.trim();
    if (t.length < min) h.push(etiket(alan, minMesaj));
    if (t.length > max) h.push(etiket(alan, maxMesaj ?? `En fazla ${max} karakter olabilir`));
    return t;
  }

  function mantikAlani(d, alan, h, varsayilan) {
    if (d === undefined && varsayilan !== undefined) return varsayilan;
    if (typeof d !== "boolean") {
      h.push(etiket(alan, "true ya da false olmalı"));
      return Boolean(varsayilan);
    }
    return d;
  }

  function kimlikAlani(d, h) {
    if (typeof d !== "string" || !KIMLIK.test(d)) h.push(etiket("id", "Geçersiz kimlik"));
    return typeof d === "string" ? d : "";
  }

  function httpMi(d) {
    try {
      const adres = new URL(d);
      return adres.protocol === "http:" || adres.protocol === "https:";
    } catch {
      return false;
    }
  }

  /** Kayıtlı bir öğeyi doğrular (ItemSchema). Sonuç: { oge } ya da { hatalar }. */
  function ogeDogrula(ham) {
    if (!ham || typeof ham !== "object" || Array.isArray(ham)) return { hatalar: ["Öğe bir nesne olmalı"] };
    const tur = ham.type;
    if (!(tur in TUR_SIRASI)) return { hatalar: [etiket("type", "bookmark, question ya da popup olmalı")] };
    const h = [];
    const id = kimlikAlani(ham.id, h);
    const at = saniyeAlani(ham.at, "at", h);
    let oge;
    if (tur === "bookmark") {
      oge = {
        id, type: tur, at,
        title: metinAlani(ham.title, "title", h, { min: 1, max: 120, minMesaj: "Yer imi başlığı boş olamaz", maxMesaj: "Başlık en fazla 120 karakter olabilir" })
      };
    } else if (tur === "question") {
      let kind = ham.kind;
      if (!SORU_TIPLERI.includes(kind)) {
        h.push(etiket("kind", "single, multiple ya da truefalse olmalı"));
        kind = "single";
      }
      const prompt = metinAlani(ham.prompt, "prompt", h, { min: 1, max: 1000, minMesaj: "Soru metni boş olamaz", maxMesaj: "Soru en fazla 1000 karakter olabilir" });
      let options = [];
      if (!Array.isArray(ham.options)) {
        h.push(etiket("options", "Liste olmalı"));
      } else {
        if (ham.options.length < 2) h.push(etiket("options", "En az iki seçenek gerekli"));
        if (ham.options.length > 8) h.push(etiket("options", "En fazla sekiz seçenek olabilir"));
        options = ham.options.map((s) => {
          if (!s || typeof s !== "object") {
            h.push(etiket("options", "Seçenek bir nesne olmalı"));
            return { id: "", text: "", correct: false };
          }
          return {
            id: kimlikAlani(s.id, h),
            text: metinAlani(s.text, "text", h, { min: 1, max: 300, minMesaj: "Seçenek metni boş olamaz", maxMesaj: "Seçenek en fazla 300 karakter olabilir" }),
            correct: mantikAlani(s.correct, "correct", h)
          };
        });
      }
      oge = {
        id, type: tur, at, kind, prompt, options,
        feedbackCorrect: metinAlani(ham.feedbackCorrect, "feedbackCorrect", h, { max: 1000, varsayilan: "" }),
        feedbackWrong: metinAlani(ham.feedbackWrong, "feedbackWrong", h, { max: 1000, varsayilan: "" }),
        required: mantikAlani(ham.required, "required", h, true),
        retryFrom: ham.retryFrom === undefined || ham.retryFrom === null ? null : saniyeAlani(ham.retryFrom, "retryFrom", h)
      };
      if (!h.length) {
        if (new Set(options.map((o) => o.id)).size !== options.length) h.push(etiket("options", "Seçenek kimlikleri benzersiz olmalı"));
        const dogru = options.filter((o) => o.correct).length;
        if (kind === "multiple") {
          if (dogru < 1) h.push(etiket("options", "En az bir doğru seçenek işaretlenmeli"));
        } else if (dogru !== 1) {
          h.push(etiket("options", "Tam olarak bir doğru seçenek işaretlenmeli"));
        }
        if (kind === "truefalse" && options.length !== 2) h.push(etiket("options", "Doğru/Yanlış sorusunda iki seçenek olmalı"));
      }
    } else {
      let duration = 8;
      if (ham.duration !== undefined) {
        if (!sayiMi(ham.duration)) h.push(etiket("duration", "Sayı olmalı"));
        else {
          duration = ham.duration;
          if (duration < 1) h.push(etiket("duration", "Süre en az 1 saniye olmalı"));
          if (duration > 600) h.push(etiket("duration", "Süre en fazla 600 saniye olabilir"));
        }
      }
      let link = null;
      if (ham.link !== undefined && ham.link !== null) {
        link = metinAlani(ham.link, "link", h, { max: 500 });
        if (!httpMi(link)) h.push(etiket("link", "Bağlantı http:// ya da https:// ile başlamalı"));
      }
      oge = {
        id, type: tur, at, duration,
        pause: mantikAlani(ham.pause, "pause", h, false),
        title: metinAlani(ham.title, "title", h, { max: 120, maxMesaj: "Başlık en fazla 120 karakter olabilir", varsayilan: "" }),
        body: metinAlani(ham.body, "body", h, { min: 1, max: 2000, minMesaj: "Pop-up metni boş olamaz", maxMesaj: "Metin en fazla 2000 karakter olabilir" }),
        link
      };
    }
    return h.length ? { hatalar: h } : { oge };
  }

  /** Öğeyi doğrular, video süresini ve tekrar izletme zamanını da denetler (sunucudaki checkItem). */
  function ogeKontrol(aday, sure) {
    const { oge, hatalar } = ogeDogrula(aday);
    if (!oge) return { ok: false, hatalar };
    const h = [];
    if (sure && oge.at > sure + 0.5) h.push(`Zaman: ${sureYaz(oge.at)} videonun süresini (${sureYaz(sure)}) aşıyor`);
    if (oge.type === "question" && oge.retryFrom !== null && oge.retryFrom > oge.at) {
      h.push("Tekrar izletme zamanı, sorunun zamanından önce olmalı");
    }
    return h.length ? { ok: false, hatalar: h } : { ok: true, oge };
  }

  /** Proje dosyasını doğrular (ProjectSchema). Sonuç: { proje } ya da { hatalar }. */
  function projeDogrula(ham) {
    if (!ham || typeof ham !== "object" || Array.isArray(ham)) return { hatalar: ["Proje bir nesne olmalı"] };
    const h = [];
    if (ham.schemaVersion !== 1) h.push("schemaVersion: 1 olmalı");
    const id = typeof ham.id === "string" && PROJE_KIMLIGI.test(ham.id) ? ham.id : (h.push("Geçersiz proje kimliği"), "");
    const title = metinAlani(ham.title, "title", h, { min: 1, max: 200, minMesaj: "Proje adı boş olamaz" });
    const video = { provider: "youtube", videoId: "", duration: null };
    const v = ham.video;
    if (!v || typeof v !== "object") {
      h.push("Video bilgisi eksik");
    } else {
      if (v.provider !== "youtube") h.push("Video: yalnızca YouTube destekleniyor");
      if (typeof v.videoId === "string" && VIDEO_KIMLIGI.test(v.videoId)) video.videoId = v.videoId;
      else h.push(etiket("videoId", "Geçersiz YouTube video kimliği"));
      if (v.duration !== undefined && v.duration !== null) {
        if (sayiMi(v.duration) && v.duration > 0) video.duration = v.duration;
        else h.push("Video süresi: pozitif bir sayı olmalı");
      }
    }
    let settings = { preventSkippingRequired: true };
    if (ham.settings !== undefined) {
      if (!ham.settings || typeof ham.settings !== "object") h.push("Ayarlar: nesne olmalı");
      else settings = { preventSkippingRequired: mantikAlani(ham.settings.preventSkippingRequired, "preventSkippingRequired", h, true) };
    }
    const items = [];
    if (ham.items !== undefined) {
      if (!Array.isArray(ham.items)) h.push("Öğeler: liste olmalı");
      else {
        ham.items.forEach((aday, i) => {
          const r = ogeDogrula(aday);
          if (r.oge) items.push(r.oge);
          else h.push(...r.hatalar.map((e) => `${i + 1}. öğe — ${e}`));
        });
      }
    }
    let revision = 0;
    if (ham.revision !== undefined) {
      if (Number.isInteger(ham.revision) && ham.revision >= 0) revision = ham.revision;
      else h.push("revision: sıfır ya da pozitif tam sayı olmalı");
    }
    if (typeof ham.createdAt !== "string") h.push("createdAt eksik");
    if (typeof ham.updatedAt !== "string") h.push("updatedAt eksik");
    if (!h.length) {
      const gorulen = new Set();
      for (const oge of items) {
        if (gorulen.has(oge.id)) h.push(`id: Aynı kimlik iki kez kullanılmış: ${oge.id}`);
        gorulen.add(oge.id);
      }
    }
    if (h.length) return { hatalar: h };
    return { proje: { schemaVersion: 1, id, title, video, settings, items, revision, createdAt: ham.createdAt, updatedAt: ham.updatedAt } };
  }

  /** Kayıtlı bir öneriyi doğrular; geçersizse null döner. */
  function oneriDogrula(ham) {
    if (!ham || typeof ham !== "object") return null;
    const { oge } = ogeDogrula(ham.item);
    if (!oge || (ham.source !== "claude" && ham.source !== "ice-aktarma")) return null;
    return {
      item: oge,
      source: ham.source,
      estimatedPosition: ham.estimatedPosition === true,
      note: typeof ham.note === "string" ? ham.note.slice(0, 500) : "",
      createdAt: typeof ham.createdAt === "string" ? ham.createdAt : simdi()
    };
  }

  // Yapay zekâlar bazen zamanı "1:35", doğruyu "true" dizgesi olarak yazar; doğrulamadan önce düzeltilir.
  const TUR_ESLERI = {
    soru: "question", "pop-up": "popup", "bilgi kartı": "popup", "bilgi karti": "popup", kart: "popup",
    "yer imi": "bookmark", yerimi: "bookmark", "bölüm": "bookmark", bolum: "bookmark", chapter: "bookmark"
  };
  const TIP_ESLERI = {
    tek: "single", "tek-secimli": "single", "çoklu": "multiple", coklu: "multiple", true_false: "truefalse",
    "true-false": "truefalse", "dogru-yanlis": "truefalse", "doğru-yanlış": "truefalse", "doğru/yanlış": "truefalse"
  };

  function zamanOku(metin) {
    const t = metin.trim().toLowerCase().replace(/\s*(sn|saniye|s)$/, "");
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
    return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : null;
  }

  function mantikOku(d) {
    if (d === 1 || d === 0) return d === 1;
    if (typeof d !== "string") return d;
    const t = d.trim().toLocaleLowerCase("tr-TR");
    if (["true", "doğru", "dogru", "evet", "yes"].includes(t)) return true;
    if (["false", "yanlış", "yanlis", "hayır", "hayir", "no"].includes(t)) return false;
    return d;
  }

  function girdiDuzelt(ham) {
    if (!ham || typeof ham !== "object" || Array.isArray(ham)) return ham;
    const o = { ...ham };
    if (typeof o.type === "string") {
      const tur = o.type.trim().toLocaleLowerCase("tr-TR");
      o.type = TUR_ESLERI[tur] ?? tur;
    }
    if (typeof o.kind === "string") {
      const tip = o.kind.trim().toLocaleLowerCase("tr-TR");
      o.kind = TIP_ESLERI[tip] ?? tip;
    }
    for (const alan of ["at", "retryFrom", "duration"]) {
      if (typeof o[alan] === "string") {
        const saniye = zamanOku(o[alan]);
        if (saniye !== null) o[alan] = saniye;
      }
    }
    for (const alan of ["title", "feedbackCorrect", "feedbackWrong"]) if (o[alan] === null) delete o[alan];
    for (const alan of ["required", "pause"]) if (o[alan] !== undefined) o[alan] = mantikOku(o[alan]);
    if (o.link === "") o.link = null;
    if (Array.isArray(o.options)) {
      o.options = o.options.map((s) => (s && typeof s === "object" ? { ...s, correct: mantikOku(s.correct) } : s));
    }
    return o;
  }

  /** Yapay zekâdan gelen kimliksiz öneriyi doğrular (ItemInputSchema). Sonuç: { girdi } ya da { hatalar }. */
  function girdiDogrula(ham) {
    if (!ham || typeof ham !== "object" || Array.isArray(ham)) return { hatalar: ["Öneri bir nesne olmalı"] };
    const tur = ham.type;
    if (!(tur in TUR_SIRASI)) return { hatalar: [etiket("type", "bookmark, question ya da popup olmalı")] };
    const h = [];
    const sayi = (d, alan, zorunlu = true) => {
      if (d === undefined && !zorunlu) return undefined;
      if (typeof d !== "number" || Number.isNaN(d)) {
        h.push(etiket(alan, "Sayı olmalı"));
        return 0;
      }
      return d;
    };
    const dize = (d, alan, zorunlu = true) => {
      if (d === undefined && !zorunlu) return undefined;
      if (typeof d !== "string") {
        h.push(etiket(alan, "Metin olmalı"));
        return "";
      }
      return d;
    };
    const mantik = (d, alan) => {
      if (d === undefined) return undefined;
      if (typeof d !== "boolean") h.push(etiket(alan, "true ya da false olmalı"));
      return d === true;
    };
    const girdi = { type: tur, at: sayi(ham.at, "at") };
    if (tur === "bookmark") {
      girdi.title = dize(ham.title, "title");
    } else if (tur === "question") {
      if (!SORU_TIPLERI.includes(ham.kind)) h.push(etiket("kind", "single, multiple ya da truefalse olmalı"));
      girdi.kind = ham.kind;
      girdi.prompt = dize(ham.prompt, "prompt");
      if (!Array.isArray(ham.options)) {
        h.push(etiket("options", "Liste olmalı"));
        girdi.options = [];
      } else {
        girdi.options = ham.options.map((s) => {
          if (!s || typeof s !== "object") {
            h.push(etiket("options", "Her seçenek { text, correct } biçiminde olmalı"));
            return { text: "", correct: false };
          }
          if (typeof s.correct !== "boolean") h.push(etiket("correct", "true ya da false olmalı"));
          return { text: dize(s.text, "text"), correct: s.correct === true };
        });
      }
      girdi.feedbackCorrect = dize(ham.feedbackCorrect, "feedbackCorrect", false);
      girdi.feedbackWrong = dize(ham.feedbackWrong, "feedbackWrong", false);
      girdi.required = mantik(ham.required, "required");
      girdi.retryFrom = ham.retryFrom === null ? null : sayi(ham.retryFrom, "retryFrom", false);
    } else {
      girdi.duration = sayi(ham.duration, "duration", false);
      girdi.pause = mantik(ham.pause, "pause");
      girdi.title = dize(ham.title, "title", false);
      girdi.body = dize(ham.body, "body");
      girdi.link = ham.link === null ? null : dize(ham.link, "link", false);
    }
    return h.length ? { hatalar: h } : { girdi };
  }

  function girdidenOge(g, id = yeniKimlik(TUR_ONEKI[g.type])) {
    const yuvarla = (n) => Math.round(n * 10) / 10;
    if (g.type === "bookmark") return { id, type: "bookmark", at: yuvarla(g.at), title: g.title };
    if (g.type === "question") {
      return {
        id, type: "question", at: yuvarla(g.at), kind: g.kind, prompt: g.prompt,
        options: g.options.map((o, i) => ({ id: SECENEK_KIMLIKLERI[i] ?? `o${i}`, text: o.text, correct: o.correct })),
        feedbackCorrect: g.feedbackCorrect ?? "",
        feedbackWrong: g.feedbackWrong ?? "",
        required: g.required ?? true,
        retryFrom: g.retryFrom == null ? null : yuvarla(g.retryFrom)
      };
    }
    return {
      id, type: "popup", at: yuvarla(g.at), duration: g.duration ?? 8, pause: g.pause ?? false,
      title: g.title ?? "", body: g.body, link: g.link ? g.link : null
    };
  }

  // ------------------------------------------------------------------ YouTube

  const YOUTUBE_ADRESLERI = new Set([
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"
  ]);
  const YOL_ONEKLERI = ["embed", "shorts", "live", "v", "e"];

  function youtubeKimligi(girdi) {
    const metin = girdi.trim();
    if (!metin) return null;
    if (VIDEO_KIMLIGI.test(metin)) return metin;
    let adres;
    try {
      adres = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(metin) ? metin : `https://${metin}`);
    } catch {
      return null;
    }
    const ana = adres.hostname.toLowerCase();
    const parcalar = adres.pathname.split("/").filter(Boolean);
    let aday;
    if (ana === "youtu.be" || ana === "www.youtu.be") aday = parcalar[0];
    else if (YOUTUBE_ADRESLERI.has(ana)) {
      if (parcalar[0] === "watch") aday = adres.searchParams.get("v") ?? undefined;
      else if (YOL_ONEKLERI.includes(parcalar[0] ?? "")) aday = parcalar[1];
      else if (parcalar.length === 0) aday = adres.searchParams.get("v") ?? undefined;
    }
    return aday && VIDEO_KIMLIGI.test(aday) ? aday : null;
  }

  async function videoBilgisi(videoId) {
    if (!gercekFetch) return { title: null, status: "bilinmiyor" };
    const denetim = typeof AbortController === "function" ? new AbortController() : null;
    const zamanlayici = setTimeout(() => denetim && denetim.abort(), 5000);
    try {
      const izle = `https://www.youtube.com/watch?v=${videoId}`;
      const cevap = await gercekFetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(izle)}`, {
        signal: denetim ? denetim.signal : undefined
      });
      if (cevap.status === 401 || cevap.status === 403) return { title: null, status: "gomme-kapali" };
      if (cevap.status === 404 || cevap.status === 400) return { title: null, status: "bulunamadi" };
      if (!cevap.ok) return { title: null, status: "bilinmiyor" };
      const veri = await cevap.json();
      return { title: typeof veri.title === "string" ? veri.title : null, status: "ok" };
    } catch {
      return { title: null, status: "bilinmiyor" };
    } finally {
      clearTimeout(zamanlayici);
    }
  }

  // ------------------------------------------------------------------ yapay zekâ istemi ve cevabı

  const YONERGE = `Öneri kuralları:
1. Soruları videoda ilgili konu ANLATILDIKTAN HEMEN SONRAKİ saniyeye yerleştir; konu anlatılmadan önce soru sorma.
2. Soru tipini içeriğe göre sen seç:
   - "single": tek doğru cevaplı, 3-4 seçenekli soru (en sık kullanılan).
   - "multiple": birden çok ifadenin doğru olduğu durumlar.
   - "truefalse": tek ve net bir iddia; seçenekler tam olarak "Doğru" ve "Yanlış".
3. Çeldiriciler inandırıcı ve doğru cevapla benzer uzunlukta olsun; "hepsi" ya da "hiçbiri" kullanma.
4. feedbackCorrect kısa bir onay, feedbackWrong doğru cevabı kısaca açıklayan metin olsun.
5. retryFrom: yanlış cevapta tekrar izletilecek bölümün başladığı saniye (sorunun zamanından önce).
6. Varsayılan sıklık: yaklaşık 1-3 dakikada bir soru; kullanıcı başka bir sayı isterse ona uy.
7. Pop-up (popup): önemli bir terim ya da kavram için 1-2 cümlelik bilgi kartı, 6-10 saniye, videoyu durdurmasın.
8. Yer imi (bookmark): her ana bölümün başladığı saniye ve kısa başlık.
9. Zamanlar saniye cinsinden sayı olsun ve video süresini aşmasın. İlk 10 saniyeye soru koyma.
10. Metin zaman damgası içermiyorsa konumları metindeki yere göre orantılı tahmin et ve bunu "konum_tahmini": true ile belirt.
11. Metnin dilinde yaz (Türkçe metin için Türkçe).`;

  const ORNEK_CEVAP = `{
  "konum_tahmini": false,
  "oneriler": [
    { "type": "bookmark", "at": 0, "title": "Giriş" },
    {
      "type": "question", "at": 95, "kind": "single",
      "prompt": "Soru metni?",
      "options": [
        { "text": "Doğru seçenek", "correct": true },
        { "text": "Çeldirici 1", "correct": false },
        { "text": "Çeldirici 2", "correct": false }
      ],
      "feedbackCorrect": "Doğru!",
      "feedbackWrong": "Doğru cevap ... çünkü ...",
      "retryFrom": 60
    },
    { "type": "popup", "at": 130, "duration": 8, "title": "Terim", "body": "Kısa açıklama." }
  ]
}`;

  function projeyiAnlat(proje) {
    const sure = proje.video.duration
      ? `${Math.round(proje.video.duration)} saniye (${sureYaz(proje.video.duration)})`
      : "bilinmiyor (editörde video bir kez açılınca öğrenilir)";
    const satirlar = [`Proje: ${proje.title} (kimlik: ${proje.id})`, `YouTube video kimliği: ${proje.video.videoId}`, `Video süresi: ${sure}`];
    const ogeler = ogeleriSirala(proje.items);
    if (ogeler.length) {
      satirlar.push("Projede zaten olan öğeler (tekrarlama):");
      for (const oge of ogeler) satirlar.push(`- ${sureYaz(oge.at)} ${TUR_ADLARI[oge.type]}: ${ogeOzeti(oge)}`);
    }
    return satirlar.join("\n");
  }

  function istemOlustur(proje, metin) {
    const govde = metin.trim()
      ? `Videonun metni:\n"""\n${metin.trim()}\n"""`
      : "Videonun metni henüz eklenmedi. Metni bu mesajın sonuna yapıştır.";
    return [
      "Bir YouTube videosu için etkileşimli öğe önerileri hazırlamanı istiyorum: bilgi kontrolü soruları, pop-up bilgi kartları ve yer imleri.",
      "",
      projeyiAnlat(proje),
      "",
      YONERGE,
      "",
      "Cevabını YALNIZCA şu biçimde, tek bir JSON kod bloğu olarak ver. JSON dışında açıklama yazma. Alan adlarını ve type, kind değerlerini örnekteki gibi İngilizce bırak; zamanları \"1:35\" gibi değil, 95 gibi saniye sayısıyla yaz:",
      "```json",
      ORNEK_CEVAP,
      "```",
      "",
      govde
    ].join("\n");
  }

  /** Metindeki ilk { ya da [ ile başlayan dengeli JSON parçasını bulur (dizgelerin içine bakmaz). */
  function dengeliParca(metin) {
    const bas = metin.search(/[[{]/);
    if (bas < 0) return null;
    const bekleyen = [];
    let dizgede = false;
    let kacis = false;
    for (let i = bas; i < metin.length; i++) {
      const c = metin[i];
      if (dizgede) {
        if (kacis) kacis = false;
        else if (c === "\\") kacis = true;
        else if (c === '"') dizgede = false;
      } else if (c === '"') dizgede = true;
      else if (c === "{" || c === "[") bekleyen.push(c === "{" ? "}" : "]");
      else if (c === "}" || c === "]") {
        if (bekleyen.pop() !== c) return null;
        if (!bekleyen.length) return metin.slice(bas, i + 1);
      }
    }
    return null;
  }

  // Yaygın yapay zekâ hataları: satır yorumu ve son öğeden sonra kalan virgül.
  const gevsekJson = (metin) => metin.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");

  function onerileriAyikla(ham) {
    const metin = String(ham ?? "").replace(/^﻿/, "").trim();
    if (!metin) throw new YerelHata("Cevap boş. Yapay zekânın verdiği JSON'u yapıştırın.", 400);
    const adaylar = [];
    const kod = /```(?:json)?\s*([\s\S]*?)```/i.exec(metin);
    if (kod) adaylar.push(kod[1].trim());
    adaylar.push(metin);
    const parca = dengeliParca(metin);
    if (parca) adaylar.push(parca);
    let veri;
    let bulundu = false;
    for (const aday of adaylar) {
      for (const deneme of [aday, gevsekJson(aday)]) {
        try {
          veri = JSON.parse(deneme);
          bulundu = true;
          break;
        } catch {
          /* sıradaki aday */
        }
      }
      if (bulundu) break;
    }
    if (!bulundu) {
      throw new YerelHata("Cevapta geçerli bir JSON bulunamadı. Yapay zekânın cevabındaki JSON kod bloğunun tamamını yapıştırın.", 400);
    }
    if (Array.isArray(veri)) return { items: veri, estimatedPosition: false };
    if (veri && typeof veri === "object") {
      const liste = veri.oneriler ?? veri.suggestions ?? veri.items;
      if (Array.isArray(liste)) return { items: liste, estimatedPosition: veri.konum_tahmini === true };
      if (veri.project || veri.projeler || veri.schemaVersion) {
        throw new YerelHata("Bu bir proje ya da yedek dosyası. Ana sayfadaki “Yedekten ya da proje dosyasından yükle” ile açın.", 400);
      }
    }
    throw new YerelHata('JSON içinde "oneriler" listesi bulunamadı.', 400);
  }

  // ------------------------------------------------------------------ tarayıcı deposu (IndexedDB)

  const VT_ADI = "haluku";
  const DEPO_ADI = "projeler";
  let vtSozu = null;

  function depolamaHatasi(hata) {
    if (hata instanceof YerelHata) return hata;
    if (hata && hata.name === "QuotaExceededError") {
      return new YerelHata("Tarayıcı depolaması dolu. Kullanmadığınız projeleri yedekleyip silin.", 507);
    }
    return new YerelHata(
      "Tarayıcı depolamasına erişilemedi. Gizli pencerede ya da site verileri engellendiğinde projeler kaydedilemez.",
      500,
      hata && hata.message ? [hata.message] : []
    );
  }

  function vt() {
    if (!vtSozu) {
      vtSozu = new Promise((coz, reddet) => {
        let istek;
        try {
          istek = window.indexedDB.open(VT_ADI, 1);
        } catch (hata) {
          reddet(depolamaHatasi(hata));
          return;
        }
        istek.onupgradeneeded = () => {
          if (!istek.result.objectStoreNames.contains(DEPO_ADI)) istek.result.createObjectStore(DEPO_ADI, { keyPath: "id" });
        };
        istek.onsuccess = () => {
          istek.result.onversionchange = () => istek.result.close();
          coz(istek.result);
        };
        istek.onerror = () => reddet(depolamaHatasi(istek.error));
        istek.onblocked = () => reddet(new YerelHata("Tarayıcı depolaması başka bir sekmede kilitli. Diğer haluku sekmelerini kapatıp sayfayı yenileyin.", 500));
      });
      vtSozu.catch(() => {
        vtSozu = null;
      });
    }
    return vtSozu;
  }

  const bekle = (istek) => new Promise((coz, reddet) => {
    istek.onsuccess = () => coz(istek.result);
    istek.onerror = () => reddet(istek.error);
  });

  const bitis = (islem) => new Promise((coz, reddet) => {
    islem.oncomplete = () => coz();
    islem.onerror = () => reddet(islem.error);
    islem.onabort = () => reddet(islem.error || new Error("Kayıt yarıda kaldı"));
  });

  async function kayitOku(id) {
    const v = await vt();
    return (await bekle(v.transaction(DEPO_ADI).objectStore(DEPO_ADI).get(id))) ?? null;
  }

  async function tumKayitlar() {
    const v = await vt();
    return bekle(v.transaction(DEPO_ADI).objectStore(DEPO_ADI).getAll());
  }

  async function kayitYaz(kayit) {
    const v = await vt();
    const islem = v.transaction(DEPO_ADI, "readwrite");
    islem.objectStore(DEPO_ADI).put(kayit);
    try {
      await bitis(islem);
    } catch (hata) {
      throw depolamaHatasi(hata);
    }
  }

  /** Aynı kimlikte kayıt yoksa ekler; varsa false döner. */
  async function kayitEkle(kayit) {
    const v = await vt();
    const islem = v.transaction(DEPO_ADI, "readwrite");
    let varOlan = false;
    const istek = islem.objectStore(DEPO_ADI).add(kayit);
    istek.onerror = (olay) => {
      if (istek.error && istek.error.name === "ConstraintError") {
        varOlan = true;
        olay.preventDefault();
        olay.stopPropagation();
      }
    };
    try {
      await bitis(islem);
    } catch (hata) {
      throw depolamaHatasi(hata);
    }
    return !varOlan;
  }

  async function kayitSil(id) {
    const v = await vt();
    const islem = v.transaction(DEPO_ADI, "readwrite");
    islem.objectStore(DEPO_ADI).delete(id);
    await bitis(islem);
  }

  let kaliciIstendi = false;
  function kaliciDepolamaIste() {
    if (kaliciIstendi) return;
    kaliciIstendi = true;
    try {
      navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      /* desteklenmiyor */
    }
  }

  // Aynı projeye yapılan yazmaları (sekmeler arasında da) sıraya koyar.
  const kilitZinciri = new Map();
  function ozel(id, is) {
    if (navigator.locks && typeof navigator.locks.request === "function") return navigator.locks.request(`haluku:${id}`, () => is());
    const onceki = kilitZinciri.get(id) ?? Promise.resolve();
    const calisan = onceki.then(is, is);
    kilitZinciri.set(id, calisan.catch(() => undefined));
    return calisan;
  }

  // Değişiklik bildirimleri: aynı sekmedeki ve (BroadcastChannel ile) diğer sekmelerdeki editörler.
  const dinleyiciler = new Set();
  let kanal = null;
  try {
    kanal = new BroadcastChannel("haluku");
    kanal.onmessage = (olay) => dagit(olay.data);
  } catch {
    kanal = null;
  }

  function dagit(degisiklik) {
    for (const dinleyici of [...dinleyiciler]) {
      try {
        dinleyici(degisiklik);
      } catch (hata) {
        console.error(hata);
      }
    }
  }

  function degisti(projectId, what) {
    const degisiklik = { projectId, what };
    setTimeout(() => {
      dagit(degisiklik);
      try {
        if (kanal) kanal.postMessage(degisiklik);
      } catch {
        /* sekmeler arası bildirim yok */
      }
    }, 30);
  }

  // ------------------------------------------------------------------ proje deposu

  function kimlikKontrol(id) {
    if (typeof id !== "string" || !PROJE_KIMLIGI.test(id)) throw new YerelHata("Geçersiz proje kimliği", 400);
  }

  async function projeKaydi(id) {
    kimlikKontrol(id);
    const kayit = await kayitOku(id);
    if (!kayit) throw new YerelHata("Proje bulunamadı", 404);
    const r = projeDogrula(kayit.project);
    if (!r.proje) throw new YerelHata(`${id} projesi bozuk`, 500, r.hatalar);
    const oneriler = Array.isArray(kayit.suggestions) ? kayit.suggestions.map(oneriDogrula).filter(Boolean) : [];
    return { kayit, project: r.proje, suggestions: oneriler, text: typeof kayit.text === "string" ? kayit.text : "" };
  }

  function ogeleriKontrol(ogeler, sure) {
    const gecerli = [];
    const hatalar = [];
    ogeler.forEach((aday, i) => {
      const r = ogeKontrol(aday, sure);
      if (r.ok) gecerli.push(r.oge);
      else hatalar.push(...r.hatalar.map((e) => `${i + 1}. öğe — ${e}`));
    });
    if (hatalar.length) throw new YerelHata("Bazı öğeler geçersiz", 400, hatalar);
    return gecerli;
  }

  function benzersiz(oge, alinan) {
    let aday = oge;
    while (alinan.has(aday.id)) aday = { ...aday, id: yeniKimlik(aday.id.split("_")[0] || "o") };
    alinan.add(aday.id);
    return aday;
  }

  const TR_HARFLER = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
  function kisaAd(metin) {
    const esli = Array.from(metin.toLocaleLowerCase("tr-TR")).map((c) => TR_HARFLER[c] ?? c).join("")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "");
    const kisa = esli.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
    return kisa || "proje";
  }

  const depo = {
    async list() {
      const ozetler = [];
      for (const kayit of await tumKayitlar()) {
        const { proje } = projeDogrula(kayit.project);
        if (!proje) continue;
        const say = (tur) => proje.items.filter((i) => i.type === tur).length;
        ozetler.push({
          id: proje.id,
          title: proje.title,
          videoId: proje.video.videoId,
          duration: proje.video.duration,
          counts: { question: say("question"), popup: say("popup"), bookmark: say("bookmark") },
          suggestions: Array.isArray(kayit.suggestions) ? kayit.suggestions.length : 0,
          hasText: typeof kayit.text === "string" && kayit.text.trim().length > 0,
          updatedAt: proje.updatedAt
        });
      }
      return ozetler.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async create({ videoId, title }) {
      const ad = title.trim() || `YouTube videosu ${videoId}`;
      const taban = kisaAd(ad);
      const zaman = simdi();
      for (let n = 1; n < 1000; n++) {
        const id = n === 1 ? taban : `${taban.slice(0, 55)}-${n}`;
        const { proje, hatalar } = projeDogrula({
          schemaVersion: 1, id, title: ad,
          video: { provider: "youtube", videoId, duration: null },
          settings: { preventSkippingRequired: true },
          items: [], revision: 0, createdAt: zaman, updatedAt: zaman
        });
        if (!proje) throw new YerelHata("Proje oluşturulamadı", 400, hatalar);
        if (await kayitEkle({ id, project: proje, suggestions: [], text: "" })) {
          degisti(id, "created");
          return proje;
        }
      }
      throw new YerelHata("Proje oluşturulamadı", 500);
    },

    async read(id) {
      const { project, suggestions, text } = await projeKaydi(id);
      return { project, suggestions, text };
    },

    /** Editörden gelen projeyi kaydeder. baseRevision kayıtlı sürümle aynı değilse 409 döner. */
    save(id, aday, taban) {
      return ozel(id, async () => {
        const { kayit, project: mevcut } = await projeKaydi(id);
        if (mevcut.revision !== taban) {
          throw new YerelHata("Proje bu arada başka bir yerden değişti. Sayfa yeniden yüklenecek.", 409);
        }
        const { proje: sonraki, hatalar } = projeDogrula({
          ...aday, schemaVersion: 1, id: mevcut.id, createdAt: mevcut.createdAt, updatedAt: simdi(), revision: mevcut.revision + 1
        });
        if (!sonraki) throw new YerelHata("Proje kaydedilemedi", 400, hatalar);
        sonraki.items = ogeleriSirala(ogeleriKontrol(sonraki.items, sonraki.video.duration));
        if (sonraki.video.videoId !== mevcut.video.videoId) throw new YerelHata("Projenin videosu değiştirilemez", 400);
        await kayitYaz({ ...kayit, project: sonraki });
        degisti(id, "project");
        return sonraki;
      });
    },

    setText(id, metin) {
      return ozel(id, async () => {
        const { kayit } = await projeKaydi(id);
        await kayitYaz({ ...kayit, text: metin });
        degisti(id, "text");
      });
    },

    /** Yapay zekâdan gelen kimliksiz önerileri doğrulayıp onay listesine ekler. */
    addSuggestions(id, hamOgeler, meta) {
      return ozel(id, async () => {
        const { kayit, project, suggestions } = await projeKaydi(id);
        const alinan = new Set([...project.items.map((i) => i.id), ...suggestions.map((s) => s.item.id)]);
        const added = [];
        const errors = [];
        hamOgeler.forEach((ham, i) => {
          const { girdi, hatalar } = girdiDogrula(girdiDuzelt(ham));
          if (!girdi) {
            errors.push(...hatalar.map((e) => `${i + 1}. öneri — ${e}`));
            return;
          }
          const r = ogeKontrol(girdidenOge(girdi), project.video.duration);
          if (!r.ok) {
            errors.push(...r.hatalar.map((e) => `${i + 1}. öneri — ${e}`));
            return;
          }
          added.push({
            item: benzersiz(r.oge, alinan),
            source: meta.source,
            estimatedPosition: meta.estimatedPosition ?? false,
            note: (meta.note ?? "").slice(0, 500),
            createdAt: simdi()
          });
        });
        if (!added.length) throw new YerelHata("Hiçbir öneri eklenemedi", 400, errors);
        await kayitYaz({ ...kayit, suggestions: [...suggestions, ...added].sort((a, b) => a.item.at - b.item.at) });
        degisti(id, "suggestions");
        return { added, errors };
      });
    },

    /** Öneriyi siler; oneriId "hepsi" ise tüm önerileri siler. Silinen sayısını döner. */
    removeSuggestion(id, oneriId) {
      return ozel(id, async () => {
        const { kayit, suggestions } = await projeKaydi(id);
        const kalan = oneriId === "hepsi" ? [] : suggestions.filter((s) => s.item.id !== oneriId);
        const silinen = suggestions.length - kalan.length;
        if (!silinen && oneriId !== "hepsi") throw new YerelHata(`Öneri bulunamadı: ${oneriId}`, 404);
        await kayitYaz({ ...kayit, suggestions: kalan });
        degisti(id, "suggestions");
        return silinen;
      });
    },

    approveSuggestion(id, oneriId, duzenlenmis) {
      return this.approve(id, (oneriler) => {
        const oneri = oneriler.find((s) => s.item.id === oneriId);
        if (!oneri) throw new YerelHata(`Öneri bulunamadı: ${oneriId}`, 404);
        return [{ id: oneriId, item: duzenlenmis === undefined ? oneri.item : duzenlenmis }];
      });
    },

    approveAll(id) {
      return this.approve(id, (oneriler) => oneriler.map((s) => ({ id: s.item.id, item: s.item })));
    },

    approve(id, sec) {
      return ozel(id, async () => {
        const { kayit, project, suggestions } = await projeKaydi(id);
        const secilen = sec(suggestions);
        if (!secilen.length) throw new YerelHata("Onaylanacak öneri yok", 400);
        const alinan = new Set(project.items.map((i) => i.id));
        const yeniler = ogeleriKontrol(secilen.map((s) => s.item), project.video.duration).map((oge) => benzersiz(oge, alinan));
        const sonraki = {
          ...project,
          items: ogeleriSirala([...project.items, ...yeniler]),
          revision: project.revision + 1,
          updatedAt: simdi()
        };
        const onaylanan = new Set(secilen.map((s) => s.id));
        await kayitYaz({ ...kayit, project: sonraki, suggestions: suggestions.filter((s) => !onaylanan.has(s.item.id)) });
        degisti(id, "project");
        degisti(id, "suggestions");
        return sonraki;
      });
    },

    remove(id) {
      return ozel(id, async () => {
        await projeKaydi(id);
        await kayitSil(id);
        degisti(id, "deleted");
      });
    }
  };

  // ------------------------------------------------------------------ SCORM ve web çıktısı

  function sablon() {
    if (!SABLON || typeof SABLON.css !== "string" || typeof SABLON.player !== "string") {
      throw new YerelHata("Oynatıcı şablonu yüklenemedi: sablon.js dosyası eksik.", 500);
    }
    return SABLON;
  }

  const isaretKac = (metin) => String(metin).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

  function paketVerisi(proje) {
    return {
      id: proje.id,
      title: proje.title,
      video: { videoId: proje.video.videoId, duration: proje.video.duration ?? null },
      settings: proje.settings ?? {},
      items: proje.items ?? [],
      surum: SURUM
    };
  }

  const dosyaAdi = (proje, uzanti) => `${String(proje.id || "haluku").replace(/[^A-Za-z0-9._-]/g, "-")}${uzanti}`;

  function webSayfasi(proje) {
    const { css, player } = sablon();
    const veri = JSON.stringify(paketVerisi(proje)).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="generator" content="haluku ${isaretKac(SURUM)}" />
    <title>${isaretKac(proje.title || "haluku")}</title>
    <style>
${css.replace(/<\/style/gi, "<\\/style")}
    </style>
  </head>
  <body>
    <div id="app"><p class="boot">Yükleniyor…</p></div>
    <noscript>Bu içerik için JavaScript gerekli.</noscript>
    <script>window.HALUKU_PROJE = ${veri};</script>
    <script>
${player.replace(/<\/script/gi, "<\\/script")}
    </script>
  </body>
</html>
`;
  }

  function scormIndex(baslik) {
    return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <title>${isaretKac(baslik)}</title>
    <link rel="stylesheet" href="assets/app.css" />
  </head>
  <body>
    <div id="app"><p class="boot">Yükleniyor…</p></div>
    <noscript>Bu içerik için JavaScript gerekli.</noscript>
    <script src="assets/proje.js"></script>
    <script src="assets/player.js"></script>
  </body>
</html>
`;
  }

  function scormManifest(proje, adlar) {
    const baslik = isaretKac(proje.title || "haluku");
    const kimlik = `haluku-${proje.id}`.replace(/[^A-Za-z0-9_.-]/g, "-");
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${kimlik}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="haluku-org">
    <organization identifier="haluku-org">
      <title>${baslik}</title>
      <item identifier="haluku-item" identifierref="haluku-sco" isvisible="true">
        <title>${baslik}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="haluku-sco" type="webcontent" adlcp:scormtype="sco" href="index.html">
${adlar.map((ad) => `      <file href="${isaretKac(ad)}"/>`).join("\n")}
    </resource>
  </resources>
</manifest>
`;
  }

  const CRC_TABLOSU = (() => {
    const tablo = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tablo[n] = c >>> 0;
    }
    return tablo;
  })();

  function crc32(veri) {
    let c = 0xffffffff;
    for (let i = 0; i < veri.length; i++) c = CRC_TABLOSU[(c ^ veri[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function sikistir(veri) {
    if (typeof CompressionStream !== "function") return null;
    try {
      const akis = new Blob([veri]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(akis).arrayBuffer());
    } catch {
      return null;
    }
  }

  async function zipOlustur(dosyalar) {
    const kodla = new TextEncoder();
    const an = new Date();
    const dosSaat = (an.getHours() << 11) | (an.getMinutes() << 5) | Math.floor(an.getSeconds() / 2);
    const dosTarih = ((an.getFullYear() - 1980) << 9) | ((an.getMonth() + 1) << 5) | an.getDate();
    const parcalar = [];
    const merkez = [];
    let konum = 0;
    for (const dosya of dosyalar) {
      const ad = kodla.encode(dosya.name);
      const veri = typeof dosya.data === "string" ? kodla.encode(dosya.data) : dosya.data;
      const sikisik = await sikistir(veri);
      const depolandi = !sikisik || sikisik.length >= veri.length;
      const govde = depolandi ? veri : sikisik;
      const crc = crc32(veri);
      const yerel = new DataView(new ArrayBuffer(30));
      yerel.setUint32(0, 0x04034b50, true);
      yerel.setUint16(4, 20, true);
      yerel.setUint16(6, 0x0800, true);
      yerel.setUint16(8, depolandi ? 0 : 8, true);
      yerel.setUint16(10, dosSaat, true);
      yerel.setUint16(12, dosTarih, true);
      yerel.setUint32(14, crc, true);
      yerel.setUint32(18, govde.length, true);
      yerel.setUint32(22, veri.length, true);
      yerel.setUint16(26, ad.length, true);
      parcalar.push(yerel, ad, govde);
      const giris = new DataView(new ArrayBuffer(46));
      giris.setUint32(0, 0x02014b50, true);
      giris.setUint16(4, 20, true);
      giris.setUint16(6, 20, true);
      giris.setUint16(8, 0x0800, true);
      giris.setUint16(10, depolandi ? 0 : 8, true);
      giris.setUint16(12, dosSaat, true);
      giris.setUint16(14, dosTarih, true);
      giris.setUint32(16, crc, true);
      giris.setUint32(20, govde.length, true);
      giris.setUint32(24, veri.length, true);
      giris.setUint16(28, ad.length, true);
      giris.setUint32(42, konum, true);
      merkez.push(giris, ad);
      konum += 30 + ad.length + govde.length;
    }
    const merkezBoyu = merkez.reduce((toplam, p) => toplam + p.byteLength, 0);
    const son = new DataView(new ArrayBuffer(22));
    son.setUint32(0, 0x06054b50, true);
    son.setUint16(8, dosyalar.length, true);
    son.setUint16(10, dosyalar.length, true);
    son.setUint32(12, merkezBoyu, true);
    son.setUint32(16, konum, true);
    return new Blob([...parcalar, ...merkez, son], { type: "application/zip" });
  }

  function scormPaketi(proje) {
    const { css, player } = sablon();
    const icerik = [
      { name: "index.html", data: scormIndex(proje.title || "haluku") },
      { name: "assets/app.css", data: css },
      { name: "assets/player.js", data: player },
      { name: "assets/proje.js", data: `window.HALUKU_PROJE = ${JSON.stringify(paketVerisi(proje))};\n` }
    ];
    const manifest = { name: "imsmanifest.xml", data: scormManifest(proje, icerik.map((d) => d.name)) };
    return zipOlustur([manifest, ...icerik]);
  }

  // ------------------------------------------------------------------ sunucunun yerine: /api/...

  async function api(yontem, adres, govde) {
    const [kaynak, id, alt, altId, eylem] = adres.pathname.split("/").filter(Boolean).map(decodeURIComponent).slice(1);
    const tamam = (veri, durum = 200) => ({ durum, veri });
    if (kaynak === "durum" && yontem === "GET") {
      return tamam({ ok: true, surum: SURUM, claudeBaglantisi: false, veriKlasoru: "bu tarayıcı", bagimsiz: true });
    }
    if (kaynak !== "projeler") throw new YerelHata("Bulunamadı", 404);
    if (!id) {
      if (yontem === "GET") return tamam({ projeler: await depo.list() });
      if (yontem === "POST") {
        const videoId = youtubeKimligi(typeof govde.link === "string" ? govde.link : "");
        if (!videoId) throw new YerelHata("Bu bir YouTube video bağlantısı gibi görünmüyor", 400);
        const bilgi = await videoBilgisi(videoId);
        if (bilgi.status === "bulunamadi") throw new YerelHata("YouTube bu videoyu bulamadı: silinmiş ya da özel olabilir", 400);
        const ad = typeof govde.title === "string" && govde.title.trim() ? govde.title : bilgi.title ?? "";
        const project = await depo.create({ videoId, title: ad });
        kaliciDepolamaIste();
        const uyari = bilgi.status === "gomme-kapali"
          ? "Video sahibi başka sitelere gömülmesine izin vermiyor olabilir; oynatıcıda açılmazsa başka bir video seçin."
          : null;
        return tamam({ project, uyari }, 201);
      }
      throw new YerelHata("İzin verilmeyen yöntem", 405);
    }
    if (!alt) {
      if (yontem === "GET") return tamam(await depo.read(id));
      if (yontem === "PUT") {
        const project = govde.project;
        if (!project || typeof project.revision !== "number") throw new YerelHata("Proje eksik", 400);
        return tamam({ project: await depo.save(id, project, project.revision) });
      }
      if (yontem === "DELETE") {
        await depo.remove(id);
        return tamam({ ok: true });
      }
      throw new YerelHata("İzin verilmeyen yöntem", 405);
    }
    if (alt === "metin" && yontem === "PUT") {
      if (typeof govde.text !== "string") throw new YerelHata("Metin eksik", 400);
      await depo.setText(id, govde.text);
      return tamam({ ok: true });
    }
    if (alt === "istem" && yontem === "GET") {
      const { project, text } = await depo.read(id);
      return tamam({ prompt: istemOlustur(project, text) });
    }
    if (alt === "oneriler") {
      if (!altId && yontem === "POST") {
        const cikan = onerileriAyikla(typeof govde.text === "string" ? govde.text : "");
        const sonuc = await depo.addSuggestions(id, cikan.items, { source: "ice-aktarma", estimatedPosition: cikan.estimatedPosition });
        return tamam({ eklenen: sonuc.added.length, hatalar: sonuc.errors }, 201);
      }
      if (altId === "hepsini-onayla" && yontem === "POST") return tamam({ project: await depo.approveAll(id) });
      if (altId && eylem === "onayla" && yontem === "POST") return tamam({ project: await depo.approveSuggestion(id, altId, govde.item) });
      if (altId && !eylem && yontem === "DELETE") return tamam({ silinen: await depo.removeSuggestion(id, altId) });
    }
    throw new YerelHata("Bulunamadı", 404);
  }

  async function apiYanitla(yontem, adres, govdeMetni) {
    let durum;
    let veri;
    try {
      let govde = {};
      if (typeof govdeMetni === "string" && govdeMetni) {
        try {
          govde = JSON.parse(govdeMetni);
        } catch {
          throw new YerelHata("İstek gövdesi geçerli JSON değil", 400);
        }
      }
      if (!govde || typeof govde !== "object") govde = {};
      ({ durum, veri } = await api(String(yontem).toUpperCase(), new URL(adres, "http://haluku.yerel"), govde));
    } catch (hata) {
      if (hata instanceof YerelHata) {
        durum = hata.durum;
        veri = { hata: hata.message, ayrintilar: hata.ayrintilar };
      } else {
        console.error("[haluku] beklenmeyen hata:", hata);
        durum = 500;
        veri = { hata: "Beklenmeyen bir hata oluştu", ayrintilar: [String((hata && hata.message) || hata)] };
      }
    }
    return new Response(JSON.stringify(veri), { status: durum, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // Editörün sunucuya giden istekleri ve canlı olay akışı buraya yönlendirilir.
  window.fetch = function (girdi, ayar) {
    const adres = typeof girdi === "string" ? girdi : girdi && typeof girdi.url === "string" ? girdi.url : String(girdi);
    if (adres.startsWith("/api/")) return apiYanitla((ayar && ayar.method) || "GET", adres, ayar && ayar.body);
    if (!gercekFetch) return Promise.reject(new TypeError("fetch desteklenmiyor"));
    return gercekFetch(girdi, ayar);
  };

  const GercekEventSource = window.EventSource;
  class YerelOlayAkisi {
    constructor() {
      this.readyState = 1;
      this.onmessage = null;
      this.onerror = null;
      this.onopen = null;
      this.ekler = new Set();
      this.ilet = (degisiklik) => {
        const olay = new MessageEvent("message", { data: JSON.stringify(degisiklik) });
        if (typeof this.onmessage === "function") this.onmessage(olay);
        for (const f of this.ekler) f(olay);
      };
      dinleyiciler.add(this.ilet);
    }
    addEventListener(tur, f) {
      if (tur === "message") this.ekler.add(f);
    }
    removeEventListener(tur, f) {
      this.ekler.delete(f);
    }
    close() {
      dinleyiciler.delete(this.ilet);
      this.readyState = 2;
    }
  }
  window.EventSource = function (adres, ayar) {
    if (String(adres).startsWith("/api/")) return new YerelOlayAkisi();
    return new GercekEventSource(adres, ayar);
  };

  // ------------------------------------------------------------------ indirme, yedek, önizleme

  function dosyaVer(blob, ad) {
    const adres = URL.createObjectURL(blob);
    const bag = document.createElement("a");
    bag.href = adres;
    bag.download = ad;
    bag.rel = "noopener";
    bag.style.display = "none";
    document.body.append(bag);
    bag.click();
    bag.remove();
    setTimeout(() => URL.revokeObjectURL(adres), 60000);
  }

  const jsonDosyasi = (veri) => new Blob([JSON.stringify(veri, null, 2)], { type: "application/json" });

  function bugun() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  async function indir(id, tur) {
    try {
      const { project, suggestions, text } = await depo.read(id);
      if (tur === "web") {
        dosyaVer(new Blob([webSayfasi(project)], { type: "text/html;charset=utf-8" }), dosyaAdi(project, ".html"));
      } else if (tur === "scorm") {
        dosyaVer(await scormPaketi(project), dosyaAdi(project, "-scorm.zip"));
      } else if (tur === "json") {
        dosyaVer(jsonDosyasi({ bicim: "haluku-proje", surum: SURUM, tarih: simdi(), project, suggestions, text }), dosyaAdi(project, "-proje.json"));
      }
    } catch (hata) {
      window.alert(`Dosya hazırlanamadı: ${(hata && hata.message) || hata}`);
    }
  }

  async function yedekAl() {
    try {
      const kayitlar = (await tumKayitlar()).filter((k) => projeDogrula(k.project).proje);
      if (!kayitlar.length) {
        window.alert("Yedeklenecek proje yok.");
        return;
      }
      const projeler = kayitlar.map((k) => ({ project: k.project, suggestions: k.suggestions ?? [], text: k.text ?? "" }));
      dosyaVer(jsonDosyasi({ bicim: "haluku-yedek", surum: SURUM, tarih: simdi(), projeler }), `haluku-yedek-${bugun()}.json`);
    } catch (hata) {
      window.alert(`Yedek alınamadı: ${(hata && hata.message) || hata}`);
    }
  }

  function yedekKayitlari(veri) {
    const kayit = (g) => ({
      project: g && g.project,
      suggestions: Array.isArray(g && g.suggestions) ? g.suggestions.map(oneriDogrula).filter(Boolean) : [],
      text: g && typeof g.text === "string" ? g.text : ""
    });
    if (Array.isArray(veri)) return { sorun: "bu bir öneri listesi; projeyi açıp “Cevabı içe aktar” ile ekleyin" };
    if (!veri || typeof veri !== "object") return { sorun: "haluku yedeği ya da proje dosyası değil" };
    if (Array.isArray(veri.projeler)) return { kayitlar: veri.projeler.map(kayit) };
    if (veri.project && typeof veri.project === "object") return { kayitlar: [kayit(veri)] };
    if (veri.schemaVersion === 1 && veri.video && typeof veri.id === "string") return { kayitlar: [kayit({ project: veri })] };
    if (Array.isArray(veri.oneriler)) return { sorun: "bu bir öneri listesi; projeyi açıp “Cevabı içe aktar” ile ekleyin" };
    if (Array.isArray(veri.suggestions)) return { sorun: "bu bir öneri dosyası (oneriler.json); proje dosyası proje.json'dır" };
    return { sorun: "haluku yedeği ya da proje dosyası değil" };
  }

  /** Yedek, proje dosyası (…-proje.json) ya da haluku veri klasöründeki proje.json dosyalarını yükler. */
  async function dosyalariYukle(dosyalar) {
    const sorunlar = [];
    const gecerli = [];
    for (const dosya of dosyalar) {
      let veri;
      try {
        veri = JSON.parse((await dosya.text()).replace(/^﻿/, ""));
      } catch {
        sorunlar.push(`${dosya.name}: geçerli bir JSON dosyası değil`);
        continue;
      }
      const { kayitlar, sorun } = yedekKayitlari(veri);
      if (sorun) {
        sorunlar.push(`${dosya.name}: ${sorun}`);
        continue;
      }
      for (const k of kayitlar) {
        const { proje, hatalar } = projeDogrula(k.project);
        if (proje) gecerli.push({ ...k, project: proje });
        else sorunlar.push(`${dosya.name}: bir proje okunamadı (${hatalar[0]})`);
      }
    }
    const mevcut = new Set((await tumKayitlar()).map((k) => k.id));
    const cakisan = gecerli.filter((k) => mevcut.has(k.project.id));
    let uzerineYaz = false;
    if (cakisan.length) {
      uzerineYaz = window.confirm(
        `Şu projeler bu tarayıcıda zaten var:\n${cakisan.map((k) => `• ${k.project.title}`).join("\n")}\n\n` +
          "Tamam: dosyadakiyle değiştir\nİptal: bunları atla"
      );
    }
    let yuklenen = 0;
    let atlanan = 0;
    for (const k of gecerli) {
      if (mevcut.has(k.project.id) && !uzerineYaz) {
        atlanan++;
        continue;
      }
      await kayitYaz({ id: k.project.id, project: k.project, suggestions: k.suggestions, text: k.text });
      degisti(k.project.id, "created");
      yuklenen++;
    }
    if (yuklenen) kaliciDepolamaIste();
    const ozet = [`${yuklenen} proje yüklendi.`];
    if (atlanan) ozet.push(`${atlanan} proje atlandı.`);
    if (sorunlar.length) ozet.push("", ...sorunlar);
    window.alert(ozet.join("\n"));
    return { yuklenen, atlanan, sorunlar };
  }

  function yedektenYukle() {
    const secici = document.createElement("input");
    secici.type = "file";
    secici.accept = ".json,application/json";
    secici.multiple = true;
    secici.addEventListener("change", () => {
      const dosyalar = [...(secici.files || [])];
      if (dosyalar.length) {
        dosyalariYukle(dosyalar).catch((hata) => window.alert(`Yüklenemedi: ${(hata && hata.message) || hata}`));
      }
    });
    secici.click();
  }

  /** index.html?duzenle=<kimlik> adresini editörün beklediği /duzenle/<kimlik> yoluna çevirir. */
  function yol() {
    const id = new URLSearchParams(window.location.search).get("duzenle");
    return id ? `/duzenle/${encodeURIComponent(id)}` : "/";
  }

  function hataGoster(kok, mesaj) {
    const sayfa = document.createElement("div");
    sayfa.className = "page";
    const geri = document.createElement("a");
    geri.href = "index.html";
    geri.className = "back";
    geri.textContent = "← Projeler";
    const kutu = document.createElement("p");
    kutu.className = "alert error";
    kutu.textContent = mesaj;
    sayfa.append(geri, kutu);
    kok.replaceChildren(sayfa);
  }

  /** oynat.html: projeyi depodan okuyup oynatıcıyı yayımlanan web sayfasıyla aynı biçimde başlatır. */
  async function onizle() {
    const kok = document.getElementById("app");
    const id = new URLSearchParams(window.location.search).get("id") || "";
    try {
      const { project } = await depo.read(id);
      document.title = `${project.title} · önizleme`;
      window.HALUKU_PROJE = paketVerisi(project);
      const betik = document.createElement("script");
      betik.src = "player.js";
      betik.onerror = () => hataGoster(kok, "Oynatıcı yüklenemedi (player.js bulunamadı).");
      document.body.append(betik);
    } catch (hata) {
      hataGoster(kok, hata instanceof YerelHata && hata.durum === 404
        ? "Bu proje bu tarayıcıda bulunamadı. Önizlemeyi editörü açtığınız tarayıcıda açın."
        : `Önizleme açılamadı: ${(hata && hata.message) || hata}`);
    }
  }

  window.halukuYerel = Object.freeze({
    surum: SURUM,
    yol,
    indir,
    onizle,
    yedekAl,
    yedektenYukle,
    dosyalariYukle,
    webSayfasi: async (id) => webSayfasi((await depo.read(id)).project),
    scormPaketi: async (id) => scormPaketi((await depo.read(id)).project)
  });
})();
