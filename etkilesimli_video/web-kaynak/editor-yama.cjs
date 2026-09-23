// haluku editör paketini (haluku/web/editor.js, küçültülmüş) bağımsız sürüm için uyarlar:
// sayfa adresleri statik dosyalara, indirme bağlantıları tarayıcıda üretilen dosyalara yönlenir,
// Claude'a özgü metinler her yapay zekâya uyan metinlerle değişir. Her hedefin beklenen sayıda
// geçtiği denetlenir; editör değişir de bir hedef bulunamazsa derleme durur.
"use strict";

// Küçültülmüş paket ASCII kalsın diye yeni metinlerdeki Türkçe harfler \uXXXX biçimine çevrilir.
const ascii = (metin) =>
  metin.replace(/[^\x00-\x7f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));

const indirme = (degisken, tur) =>
  `href:"#",onClick:ev=>{ev.preventDefault();window.halukuYerel.indir(${degisken}.id,"${tur}")}`;

const YAMALAR = [
  // --- adresler: /duzenle/<id> ve /oynat/<id> yerine index.html?duzenle=<id> ve oynat.html?id=<id>
  {
    ad: "sayfa yönlendirici",
    hedef: "function tk(){let e=/^\\/duzenle\\/([^/]+)/.exec(window.location.pathname);",
    yeni: "function tk(){let e=/^\\/duzenle\\/([^/]+)/.exec(window.halukuYerel.yol());"
  },
  {
    ad: "yeni projeden editöre geçiş",
    hedef: "window.location.href=`/duzenle/${encodeURIComponent($.project.id)}${x}`",
    yeni: 'window.location.href=`index.html?duzenle=${encodeURIComponent($.project.id)}${x.replace("?","&")}`'
  },
  {
    ad: "proje kartı: Düzenle",
    hedef: "href:`/duzenle/${encodeURIComponent(g.id)}`",
    yeni: "href:`index.html?duzenle=${encodeURIComponent(g.id)}`"
  },
  {
    ad: "proje kartı: Önizle",
    hedef: "href:`/oynat/${encodeURIComponent(g.id)}`",
    yeni: "href:`oynat.html?id=${encodeURIComponent(g.id)}`"
  },
  {
    ad: "editör: Önizle",
    hedef: "href:`/oynat/${encodeURIComponent(i.id)}`",
    yeni: "href:`oynat.html?id=${encodeURIComponent(i.id)}`"
  },
  {
    ad: "Projeler bağlantıları",
    hedef: 'p("a",{href:"/",class:"back",',
    yeni: 'p("a",{href:"index.html",class:"back",',
    adet: 2
  },

  // --- indirme: sunucu adresi yerine tarayıcıda üretilen dosya
  { ad: "proje kartı: SCORM", hedef: 'href:`/api/projeler/${encodeURIComponent(g.id)}/scorm`,download:""', yeni: indirme("g", "scorm") },
  { ad: "proje kartı: Web", hedef: 'href:`/api/projeler/${encodeURIComponent(g.id)}/web`,download:""', yeni: indirme("g", "web") },
  { ad: "editör: SCORM", hedef: 'href:`/api/projeler/${encodeURIComponent(i.id)}/scorm`,download:""', yeni: indirme("i", "scorm") },
  { ad: "editör: Web", hedef: 'href:`/api/projeler/${encodeURIComponent(i.id)}/web`,download:""', yeni: indirme("i", "web") },
  {
    ad: "proje kartı: JSON",
    hedef: 'title:"Tek dosyal\\u0131k web sayfas\\u0131 indir",children:"Web \\u2193"})',
    yeni:
      'title:"Tek dosyal\\u0131k web sayfas\\u0131 indir",children:"Web \\u2193"}),' +
      'p("a",{class:"button",' + indirme("g", "json") +
      ',title:"Projeyi başka bir bilgisayara taşımak ya da paylaşmak için proje dosyası",children:"JSON ↓"})'
  },

  // --- ana sayfa alt bilgisi: veri klasörü yerine tarayıcı deposu ve yedek düğmeleri
  {
    ad: "ana sayfa alt bilgisi",
    hedef: 'e&&p("footer",{class:"muted",children:["Projeler \\u015Fu klas\\xF6rde saklan\\u0131yor: ",e.veriKlasoru]})',
    yeni:
      'e&&p("footer",{class:"card yerel-alt",children:[' +
      'p("p",{children:[p("strong",{children:"Projeler bu tarayıcıda saklanır."}),' +
      '" Aynı adresi açan başkaları sizin projelerinizi göremez. Başka bir bilgisayara geçmek ve verileri kaybetmemek için ara ara yedek alın."]}),' +
      'p("div",{class:"actions",children:[' +
      'p("button",{type:"button",onClick:()=>window.halukuYerel.yedekAl(),children:"Tüm projeleri yedekle ↓"}),' +
      'p("button",{type:"button",onClick:()=>window.halukuYerel.yedektenYukle(),children:"Yedekten ya da proje dosyasından yükle…"})' +
      "]})]})"
  },
  {
    ad: "proje silme onayı",
    hedef: '`"${g.title}" silinsin mi?\nProje, veri klas\\xF6r\\xFCndeki _silinenler klas\\xF6r\\xFCne ta\\u015F\\u0131n\\u0131r.`',
    yeni: '`"${g.title}" silinsin mi?\nBu işlem geri alınamaz; gerekirse önce ana sayfadaki “Tüm projeleri yedekle” ile yedek alın.`'
  },
  {
    ad: "bağlantı rozeti",
    hedef:
      'p("span",{class:"badge muted",title:"Edit\\xF6r baslat.bat ile a\\xE7\\u0131ld\\u0131; Claude i\\xE7in kopyala-yap\\u0131\\u015Ft\\u0131r kullan\\u0131n",children:"Claude ba\\u011Flant\\u0131s\\u0131 yok"})',
    yeni: 'p("span",{class:"badge muted",title:"Projeler bu tarayıcıda saklanır; sunucu ya da Claude gerekmez",children:"Bağımsız sürüm"})'
  },
  {
    ad: "sunucuya ulaşılamadı hatası",
    hedef: '"haluku sunucusuna ula\\u015F\\u0131lamad\\u0131. Claude Desktop a\\xE7\\u0131k m\\u0131 (ya da baslat.bat \\xE7al\\u0131\\u015F\\u0131yor mu)?"',
    yeni: '"Tarayıcı depolamasına ulaşılamadı. Sayfayı yenileyip tekrar deneyin."'
  },

  // --- yapay zekâ bölümü: Claude yerine herhangi bir yapay zekâ
  { ad: "öneri kutusu başlığı", hedef: 'p("h2",{children:"Claude ile \\xF6neri al"})', yeni: 'p("h2",{children:"Yapay zekâ ile öneri al"})' },
  {
    ad: "öneri kutusu açıklaması",
    hedef:
      'p("p",{children:"Claude ba\\u011Flant\\u0131s\\u0131 yok. \\u0130stemi kopyalay\\u0131p Claude\'a yap\\u0131\\u015Ft\\u0131r\\u0131n, gelen cevab\\u0131 i\\xE7e aktar\\u0131n."})',
    yeni:
      'p("p",{children:"İstemi kopyalayıp ChatGPT, Gemini, Copilot ya da Claude gibi bir yapay zekâya yapıştırın; verdiği JSON cevabını içe aktarın. Aşağıya video metnini eklerseniz öneriler doğru saniyelere yerleşir."})'
  },
  { ad: "istem düğmesi", hedef: 'onClick:()=>S("prompt"),children:"Claude i\\xE7in istem"', yeni: 'onClick:()=>S("prompt"),children:"İstemi al"' },
  { ad: "istem penceresi başlığı", hedef: 'p(Cd,{title:"Claude i\\xE7in istem",', yeni: 'p(Cd,{title:"Yapay zekâ için istem",' },
  {
    ad: "istem penceresi açıklaması",
    hedef:
      "Bu metni kopyalay\\u0131p Claude'a (Claude Desktop ya da claude.ai) yeni bir sohbette yap\\u0131\\u015Ft\\u0131r\\u0131n. Claude'un verdi\\u011Fi JSON cevab\\u0131n\\u0131",
    yeni: "Bu metni kopyalayıp kullandığınız yapay zekâya (ChatGPT, Gemini, Copilot, Claude…) yeni bir sohbette yapıştırın. Verdiği JSON cevabını"
  },
  {
    ad: "içe aktarma penceresi başlığı",
    hedef: "p(Cd,{title:\"Claude'un cevab\\u0131n\\u0131 i\\xE7e aktar\",",
    yeni: 'p(Cd,{title:"Yapay zekânın cevabını içe aktar",'
  },
  {
    ad: "içe aktarma: açıklama ve JSON dosyası seçici",
    hedef:
      "p(\"p\",{children:\"Claude'un cevab\\u0131n\\u0131 (JSON kod blo\\u011Fu dahil) a\\u015Fa\\u011F\\u0131ya yap\\u0131\\u015Ft\\u0131r\\u0131n. \\xD6neriler onay\\u0131n\\u0131za d\\xFC\\u015Fer.\"}),p(\"textarea\",{class:\"prompt-text\",rows:12,value:i,onInput:m=>o(m.target.value)})",
    yeni:
      'p("p",{children:"Yapay zekânın cevabını (JSON kod bloğu dahil) aşağıya yapıştırın ya da JSON dosyasını seçin. Öneriler onayınıza düşer."}),' +
      'p("input",{type:"file",class:"ice-aktar-dosya",accept:".json,.txt,application/json,text/plain","aria-label":"JSON dosyası seç",' +
      "onChange:async ev=>{let dosya=ev.target.files&&ev.target.files[0];if(dosya)o(await dosya.text())}})," +
      'p("textarea",{class:"prompt-text",rows:12,value:i,onInput:m=>o(m.target.value)})'
  },
  {
    ad: "metin kaydedildi bildirimi",
    hedef: '"Metin kaydedildi. Claude art\\u0131k bu metni okuyabilir."',
    yeni: '"Metin kaydedildi. Yapay zekâ istemi artık bu metni de içerecek."'
  },
  { ad: "boş öğe listesi", hedef: "ya da Claude'dan \\xF6neri isteyin.\"", yeni: 'ya da yapay zekâdan öneri alın."' }
];

function yamala(kaynak) {
  let metin = kaynak;
  for (const yama of YAMALAR) {
    const beklenen = yama.adet ?? 1;
    const bulunan = metin.split(yama.hedef).length - 1;
    if (bulunan !== beklenen) {
      throw new Error(`editör yaması "${yama.ad}": hedef ${bulunan} kez bulundu, ${beklenen} bekleniyordu`);
    }
    metin = metin.split(yama.hedef).join(ascii(yama.yeni));
  }
  return metin;
}

module.exports = { yamala, YAMALAR };
