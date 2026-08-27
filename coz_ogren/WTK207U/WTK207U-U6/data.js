/* Çöz-Öğren — içerik verisi. Elle de düzenleyebilirsiniz. */
window.EO_DATA = {
  "meta": {
    "id": "mmt89qfinwti9zr",
    "title": "Bölüm 6",
    "subtitle": "Bölüm ve Kanvas Yapılarının Kullanımı",
    "footer": "",
    "eyebrow": "Çöz-Öğren"
  },
  "lessons": [
    {
      "id": "tikla",
      "kind": "cards",
      "title": "Tıkla-Öğren",
      "intro": "Kavramları görmek için kartlara tıklayın; ön yüzde kavram, arka yüzde açıklaması yer alır.",
      "activities": [
        {
          "title": "Bölüm Etiketleri ve CSS Yerleşim Özellikleri",
          "items": [
            {
              "term": "div",
              "definition": "Sayfa içinde genel amaçlı bölümler oluşturmak için kullanılan, varsayılan display değeri block olan kapsayıcı HTML etiketidir."
            },
            {
              "term": "Anlamsal Etiketler",
              "definition": "HTML5 ile gelen header, footer, section, article, nav, aside ve main gibi, içerik türünü açıkça tanımlayan bölüm etiketleridir."
            },
            {
              "term": "display",
              "definition": "Bir elemanın block, inline, inline-block, none, table ve benzeri biçimlerde nasıl görüntüleneceğini belirleyen CSS özelliğidir."
            },
            {
              "term": "position",
              "definition": "Bir elemanın static, relative, absolute veya fixed konum türlerinden hangisine göre yerleştirileceğini belirleyen CSS özelliğidir."
            },
            {
              "term": "overflow",
              "definition": "İçerik belirlenen genişlik veya yüksekliğe sığmadığında taşan kısmın visible, hidden, scroll veya auto değerleriyle nasıl davranacağını belirler."
            },
            {
              "term": "float",
              "definition": "Bir elemanın sağa veya sola yerleşmesini ve sonraki içeriğin çevresinden akmasını sağlayabilen CSS özelliğidir."
            }
          ]
        },
        {
          "title": "Menüler ve Esnek Bölüm Tasarımı",
          "items": [
            {
              "term": "Menü",
              "definition": "Kullanıcıların web sitesi içindeki sayfalar arasında gezinebilmesini sağlayan bağlantı grubudur."
            },
            {
              "term": "nav",
              "definition": "Ana menü, yan menü veya alt menü bağlantılarını anlamsal olarak gruplandırmak için kullanılan HTML5 etiketidir."
            },
            {
              "term": "Esnek Tasarım",
              "definition": "Web sayfasının farklı ekran büyüklüklerine otomatik olarak uyum sağlayacak biçimde düzenlenmesidir."
            },
            {
              "term": "viewport",
              "definition": "Web tarayıcısının web sayfasını gösterdiği alandır."
            },
            {
              "term": "Ortam Sorgusu",
              "definition": "Tarayıcı genişliği, yüksekliği, yönü veya çözünürlüğü gibi özelliklere göre farklı CSS kurallarının çalıştırılmasını sağlayan CSS3 yapısıdır."
            },
            {
              "term": "max-width",
              "definition": "Bir elemanın ulaşabileceği en büyük genişliği belirleyerek daha küçük ortamlara uyum sağlamasına yardımcı olabilen CSS özelliğidir."
            }
          ]
        },
        {
          "title": "Grid Yapısı, Esnek Resimler ve Kanvas",
          "items": [
            {
              "term": "Grid",
              "definition": "Sayfa genişliğinin genel olarak 12 eşit parçaya bölünerek tasarım öğelerinin yerleştirilmesini kolaylaştıran düzen yapısıdır."
            },
            {
              "term": "box-sizing",
              "definition": "border-box değeriyle tanımlanan genişliğin içerik yanında padding ve border-width değerlerini de kapsamasını sağlayan CSS özelliğidir."
            },
            {
              "term": "Esnek Resim",
              "definition": "max-width:100% ve gerektiğinde height:auto kullanılarak bulunduğu ortamın genişliğini aşmadan görüntülenebilen resimdir."
            },
            {
              "term": "canvas",
              "definition": "HTML5 ile web sayfası içinde boş bir tuval oluşturan etikettir."
            },
            {
              "term": "JavaScript",
              "definition": "Canvas etiketiyle oluşturulan tuval üzerine çizim yapmak ve etkileşimli içerikler oluşturmak için kullanılan programlama dilidir."
            },
            {
              "term": "Kanvas Çizimi",
              "definition": "Canvas üzerinde çizgi, dikdörtgen, daire ve benzeri grafiklerin JavaScript aracılığıyla oluşturulmasıdır."
            }
          ]
        }
      ]
    },
    {
      "id": "yanitla",
      "kind": "quiz",
      "title": "Yanıtla-Öğren",
      "intro": "Soruları yanıtlayın; her seçimden sonra doğru yanıt ve gerekçesi gösterilir.",
      "activities": [
        {
          "title": "Bölüm Etiketleri ve CSS Yerleşim Özellikleri",
          "items": [
            {
              "question": "Genel amaçlı bölüm oluşturmak için en sık kullanılan HTML etiketi hangisidir?",
              "options": [
                "div",
                "span",
                "img",
                "a"
              ],
              "answer": 0,
              "explanation": "div etiketi genel amaçlı bölüm oluşturmak için kullanılan kapsayıcı etikettir."
            },
            {
              "question": "Tematik olarak ilişkili içerikleri gruplandırmak için hangi HTML5 etiketi kullanılır?",
              "options": [
                "aside",
                "section",
                "footer",
                "main"
              ],
              "answer": 1,
              "explanation": "section etiketi tematik olarak ilişkili içeriği gruplandırmak için kullanılır."
            },
            {
              "question": "Bir elemanı sayfada hiç yer kaplamayacak biçimde gizleyen kullanım hangisidir?",
              "options": [
                "visibility:hidden",
                "display:block",
                "display:none",
                "overflow:hidden"
              ],
              "answer": 2,
              "explanation": "display:none elemanı görünmez yapar ve sayfada yer kaplamasını engeller."
            },
            {
              "question": "Kaydırma sırasında tarayıcı penceresine göre yeri değişmeyen eleman için hangi position değeri kullanılır?",
              "options": [
                "static",
                "relative",
                "absolute",
                "fixed"
              ],
              "answer": 3,
              "explanation": "fixed konumlu eleman tarayıcı penceresine sabitlenir."
            },
            {
              "question": "Blok düzeyindeki bir elemanı yatay olarak ortalamada hangi kullanım uygulanabilir?",
              "options": [
                "margin:auto",
                "float:left",
                "overflow:auto",
                "display:none"
              ],
              "answer": 0,
              "explanation": "Sağ ve sol margin değerlerinin auto olması blok elemanın yatay ortalanmasını sağlar."
            }
          ]
        },
        {
          "title": "Menüler ve Esnek Bölüm Tasarımı",
          "items": [
            {
              "question": "HTML5 standartlarına göre ana menü bağlantılarını gruplandırmak için hangi etiket uygundur?",
              "options": [
                "section",
                "article",
                "aside",
                "nav"
              ],
              "answer": 3,
              "explanation": "nav etiketi menü ve alt menü bağlantılarını gruplandırmak için kullanılır."
            },
            {
              "question": "Menü oluştururken yaygın biçimde kullanılan HTML yapısı hangisidir?",
              "options": [
                "ul ile sırasız bağlantı listesi",
                "table ile veri tablosu",
                "canvas ile çizim",
                "textarea ile metin alanı"
              ],
              "answer": 0,
              "explanation": "Menüler çoğunlukla ul etiketiyle sırasız bağlantı listesi biçiminde oluşturulur."
            },
            {
              "question": "Farklı ekran büyüklüklerine otomatik uyum sağlayan tasarıma ne ad verilir?",
              "options": [
                "Sabit tasarım",
                "Esnek tasarım",
                "Mutlak tasarım",
                "Gizli tasarım"
              ],
              "answer": 1,
              "explanation": "Farklı ekran büyüklüklerine otomatik uyum sağlayan tasarım esnek tasarım olarak adlandırılır."
            },
            {
              "question": "Bir ortam sorgusunda tarayıcı genişliğinin en fazla belirli bir değer olmasını hangi özellik denetler?",
              "options": [
                "min-height",
                "orientation",
                "max-width",
                "display"
              ],
              "answer": 2,
              "explanation": "max-width ortam genişliği için üst sınır koşulu oluşturur."
            },
            {
              "question": "İki ayrı ortam sorgusunu mantıksal veya anlamında birleştirmek için hangi yazım kullanılır?",
              "options": [
                "and",
                "not",
                "only",
                "virgül"
              ],
              "answer": 3,
              "explanation": "Virgülle ayrılan sorgulardan herhangi birinin doğru olması yeterlidir."
            }
          ]
        },
        {
          "title": "Grid Yapısı, Esnek Resimler ve Kanvas",
          "items": [
            {
              "question": "Grid kullanımında sayfa genişliği genel olarak kaç eşit parçaya bölünür?",
              "options": [
                "6",
                "8",
                "12",
                "16"
              ],
              "answer": 2,
              "explanation": "Grid yapısında sayfa genişliği genel olarak 12 eşit parçaya bölünür."
            },
            {
              "question": "Tanımlanan genişliğe padding ve border-width değerlerini de dâhil etmek için hangi box-sizing değeri kullanılır?",
              "options": [
                "content-box",
                "inherit",
                "initial",
                "border-box"
              ],
              "answer": 3,
              "explanation": "border-box genişlik hesabına içerikle birlikte padding ve kenarlık değerlerini de dâhil eder."
            },
            {
              "question": "Bir resmin bulunduğu bloğun genişliğini aşmaması için hangi kullanım uygundur?",
              "options": [
                "max-width:100%",
                "width:200%",
                "height:100%",
                "position:fixed"
              ],
              "answer": 0,
              "explanation": "max-width:100% resmin genişliğinin en fazla bulunduğu bloğun genişliği kadar olmasını sağlar."
            },
            {
              "question": "Canvas etiketi HTML'nin hangi sürümüyle gelen önemli yeniliklerden biridir?",
              "options": [
                "HTML2",
                "HTML5",
                "HTML3",
                "HTML4"
              ],
              "answer": 1,
              "explanation": "Canvas etiketi HTML5 ile birlikte gelmiştir."
            },
            {
              "question": "Canvas üzerine çizim yapmak için hangi dil kullanılır?",
              "options": [
                "CSS",
                "HTML",
                "JavaScript",
                "SQL"
              ],
              "answer": 2,
              "explanation": "Canvas üzerine JavaScript kullanılarak çizim yapılabilir."
            }
          ]
        }
      ]
    },
    {
      "id": "bul",
      "kind": "crossword",
      "title": "Bul-Öğren",
      "intro": "İpuçlarından yola çıkarak kelimeleri bulun. Izgara, verdiğiniz kelimelerden otomatik kurulur.",
      "activities": [
        {
          "title": "Bölüm Etiketleri ve CSS Yerleşim Özellikleri",
          "items": [
            {
              "answer": "BÖLÜM",
              "clue": "Sayfa içindeki içeriklerin kapsayıcı yapılarla ayrıldığı mantıksal kısım"
            },
            {
              "answer": "BAŞLIK",
              "clue": "header etiketinin çoğunlukla logo ve üst bağlantılarla birlikte oluşturduğu üst alan"
            },
            {
              "answer": "GEZİNTİ",
              "clue": "nav etiketinin bağlantıları gruplandırırken temsil ettiği yön bulma işlevi"
            },
            {
              "answer": "KONUM",
              "clue": "static, relative, absolute ve fixed değerleriyle belirlenen yerleşim türü"
            },
            {
              "answer": "TAŞMA",
              "clue": "Bir kutunun içeriğinin belirlenen genişlik veya yüksekliğe sığmaması durumu"
            },
            {
              "answer": "YÜZME",
              "clue": "Bir elemanın sağa ya da sola yerleşip sonraki içeriğin çevresinden akmasını sağlayan davranış"
            },
            {
              "answer": "TEMİZLİK",
              "clue": "clear özelliğiyle önceki float etkisinin kaldırılması işlemi"
            }
          ]
        },
        {
          "title": "Menüler ve Esnek Bölüm Tasarımı",
          "items": [
            {
              "answer": "MENÜ",
              "clue": "Kullanıcıların site içindeki sayfalar arasında dolaşmasını sağlayan bağlantı grubu"
            },
            {
              "answer": "YATAY",
              "clue": "Geniş ekranlarda bağlantıların yan yana sıralandığı yerleşim yönü"
            },
            {
              "answer": "DİKEY",
              "clue": "Dar ekranlarda bağlantıların alt alta sıralanabildiği yerleşim yönü"
            },
            {
              "answer": "VİEWPORT",
              "clue": "Tarayıcının web sayfasını gösterdiği görüntüleme alanının teknik adı"
            },
            {
              "answer": "EKRAN",
              "clue": "screen ortam türünün bilgisayar, tablet ve cep telefonunda temsil ettiği görüntüleme yüzeyi"
            },
            {
              "answer": "SORGU",
              "clue": "CSS3 ile pencere genişliği veya yön gibi koşulları kontrol eden yapının genel adı"
            },
            {
              "answer": "UYUMLULUK",
              "clue": "Sayfanın farklı cihaz boyutlarında uygun biçimde görüntülenmesiyle sağlanan özellik"
            }
          ]
        },
        {
          "title": "Grid Yapısı, Esnek Resimler ve Kanvas",
          "items": [
            {
              "answer": "IZGARA",
              "clue": "Sayfa genişliğini eşit parçalara ayırarak yerleşimi kolaylaştıran düzen yaklaşımının Türkçe karşılığı"
            },
            {
              "answer": "SÜTUN",
              "clue": "On iki parçalı düzende sayfa genişliğinin belirli bir oranını kaplayan dikey yerleşim birimi"
            },
            {
              "answer": "GENİŞLİK",
              "clue": "col sınıflarında yüzde değerleriyle belirlenen yatay ölçü"
            },
            {
              "answer": "RESİM",
              "clue": "max-width yüzde yüz kullanılarak bulunduğu alanın dışına çıkması engellenebilen görsel öğe"
            },
            {
              "answer": "KANVAS",
              "clue": "HTML5 içinde JavaScript ile grafik üretmek için oluşturulan boş tuval"
            },
            {
              "answer": "ÇİZİM",
              "clue": "Tuval üzerinde çizgi, daire veya dikdörtgen gibi şekiller üretme işlemi"
            },
            {
              "answer": "OYUN",
              "clue": "Etkileşimli grafiklerle HTML5 tuvali üzerinde geliştirilebilen içerik türlerinden biri"
            }
          ]
        }
      ]
    },
    {
      "id": "eslestir",
      "kind": "match",
      "title": "Eşleştir-Öğren",
      "intro": "Açıklamayı seçip karşısındaki kavramla eşleştirin.",
      "activities": [
        {
          "title": "Bölüm Etiketleri ve CSS Yerleşim Özellikleri",
          "items": [
            {
              "term": "header",
              "definition": "Sayfanın veya bir bölümün başlık alanını gruplandırabilir."
            },
            {
              "term": "footer",
              "definition": "Sayfa veya bölüm sonundaki alt bilgi içeriğini gruplandırabilir."
            },
            {
              "term": "article",
              "definition": "Kendi başına anlamlı ve diğer içeriklerden bağımsız içeriği gruplandırır."
            },
            {
              "term": "aside",
              "definition": "Ana içerikle ilgili ancak ondan ayrı duran yan bilgileri gruplandırır."
            },
            {
              "term": "main",
              "definition": "Belgenin veya uygulamanın ana içeriğini temsil eder."
            }
          ]
        },
        {
          "title": "Menüler ve Esnek Bölüm Tasarımı",
          "items": [
            {
              "term": "screen",
              "definition": "Bilgisayar, tablet ve cep telefonu gibi cihaz ekranları için kullanılan ortam türüdür."
            },
            {
              "term": "print",
              "definition": "Yazıcı çıktısı için kullanılan ortam türüdür."
            },
            {
              "term": "speech",
              "definition": "Ekrandaki metni sesli okuyan ekran okuyucularına yönelik ortam türüdür."
            },
            {
              "term": "min-width",
              "definition": "Ortam genişliği için alt sınır koşulu tanımlar."
            },
            {
              "term": "orientation",
              "definition": "Ortamın yatay veya dikey yerleşimini sorgulamak için kullanılabilir."
            }
          ]
        },
        {
          "title": "Grid Yapısı, Esnek Resimler ve Kanvas",
          "items": [
            {
              "term": "col-3",
              "definition": "12 parçalı grid yapısında yüzde 25 genişlikte bir alanı temsil eder."
            },
            {
              "term": "box-sizing:border-box",
              "definition": "Tanımlanan genişliğin içerik, padding ve kenarlık değerlerini birlikte kapsamasını sağlar."
            },
            {
              "term": "max-width:100%",
              "definition": "Resmin bulunduğu alanın genişliğini aşmamasını sağlar."
            },
            {
              "term": "height:auto",
              "definition": "Resmin yüksekliğinin genişliğe bağlı olarak orantılı ayarlanmasına yardımcı olur."
            }
          ]
        }
      ]
    },
    {
      "id": "dene",
      "kind": "study",
      "title": "Dene-Öğren",
      "intro": "Kısa metni okuyun, öne çıkan noktaları inceleyin ve kontrol sorusunu yanıtlayın.",
      "activities": [
        {
          "title": "Bölüm Etiketleri ve CSS Yerleşim Özellikleri",
          "items": [
            {
              "category": "Bölüm Etiketleri",
              "title": "Genel Amaçlı ve Anlamsal Bölümlendirme",
              "theory": "HTML sayfalarında içerikler kapsayıcı etiketlerle bölümlere ayrılabilir. div genel amaçlıdır. HTML5 ile gelen header, footer, section, article, nav, aside ve main etiketleri ise içeriğin anlamını daha açık biçimde belirtir ve sayfa yapısında ortak bir düzen kurulmasına yardımcı olur.",
              "keyPoints": [
                "div genel amaçlı kapsayıcı etikettir.",
                "section tematik içerik için kullanılabilir.",
                "article bağımsız ve kendi başına anlamlı içerik için kullanılabilir."
              ],
              "question": "Bir blog yazısı gibi kendi başına anlamlı bağımsız içeriği gruplandırmak için hangi etiket uygundur?",
              "options": [
                "section",
                "article",
                "nav",
                "aside"
              ],
              "answer": 1,
              "explanation": "article etiketi kendi başına anlamlı ve bağımsız içeriği gruplandırır."
            },
            {
              "category": "CSS Yerleşimi",
              "title": "Display, Position, Overflow ve Float",
              "theory": "Bölümlerin sayfadaki yerleşimi CSS ile düzenlenir. display görünüm davranışını, position konum türünü, overflow taşan içeriğin davranışını ve float elemanların sağa ya da sola yerleşmesini belirler. clear ise önceki float etkisini temizlemek için kullanılabilir.",
              "keyPoints": [
                "display:none elemanı gizler ve yer kaplamasını engeller.",
                "fixed elemanı tarayıcı penceresine göre sabitler.",
                "clear önceki float etkisini temizleyebilir."
              ],
              "question": "float:left etkisinden sonra gelen içeriğin yeni satırdan başlaması için hangi kullanım uygundur?",
              "options": [
                "overflow:hidden",
                "position:relative",
                "clear:left",
                "display:block"
              ],
              "answer": 2,
              "explanation": "clear:left önceki float:left etkisini temizler."
            }
          ]
        },
        {
          "title": "Menüler ve Esnek Bölüm Tasarımı",
          "items": [
            {
              "category": "Menü Uygulamaları",
              "title": "Yatay, Dikey ve Açılır Menü",
              "theory": "Web menüleri çoğunlukla nav etiketi içinde ul ve li kullanılarak bağlantı listesi şeklinde oluşturulur. CSS ile aynı HTML yapısı yatay veya dikey menüye dönüştürülebilir. Açılır menülerde alt bölüm başlangıçta display:none ile gizlenip fare ile üzerine gelindiğinde display:block ile görünür hâle getirilebilir.",
              "keyPoints": [
                "Menüler bağlantı listelerinden oluşturulabilir.",
                "CSS ile yatay veya dikey görünüm elde edilebilir.",
                "Açılır alt bölüm hover ile görünür hâle getirilebilir."
              ],
              "question": "Alt menünün sayfa ilk açıldığında görünmemesi için hangi kullanım uygundur?",
              "options": [
                "display:none",
                "float:right",
                "margin:auto",
                "position:fixed"
              ],
              "answer": 0,
              "explanation": "display:none alt menüyü gizler ve yer kaplamasını engeller."
            },
            {
              "category": "Esnek Tasarım",
              "title": "Viewport ve Ortam Sorguları",
              "theory": "Mobil cihazların ekranları daha küçük olduğu için sayfanın farklı genişliklere göre biçim değiştirmesi gerekebilir. viewport bilgisi meta etiketiyle tarayıcıya aktarılabilir. Ortam sorguları min-width, max-width, orientation ve benzeri koşullara göre farklı CSS kurallarının uygulanmasını sağlar.",
              "keyPoints": [
                "width=device-width sayfa genişliğini cihaz ekranıyla ilişkilendirir.",
                "initial-scale=1.0 başlangıç yakınlaştırmasını belirler.",
                "and bağlacı birden fazla koşulun birlikte sağlanmasını gerektirir."
              ],
              "question": "Bir ortam sorgusunda iki koşulun da doğru olması gerektiğinde hangi bağlaç kullanılır?",
              "options": [
                "not",
                "and",
                "virgül",
                "only"
              ],
              "answer": 1,
              "explanation": "and bağlacıyla bağlanan koşulların tamamının doğru olması gerekir."
            }
          ]
        },
        {
          "title": "Grid Yapısı, Esnek Resimler ve Kanvas",
          "items": [
            {
              "category": "Grid ve Esnek Resimler",
              "title": "Yüzdelik Sütunlarla Sayfa Yerleşimi",
              "theory": "Grid kullanımında sayfa genişliği genel olarak 12 eşit parçaya bölünür ve parçaların toplamı yüzde yüz genişliği oluşturur. Her parça yaklaşık yüzde 8,33 genişliktedir. box-sizing:border-box genişlik hesabına padding ve kenarlığı da dâhil eder. Resimlerde max-width:100% taşmayı engelleyebilir ve height:auto oranı korumaya yardımcı olur.",
              "keyPoints": [
                "12 parçanın toplamı yüzde yüz genişliği oluşturur.",
                "border-box padding ve kenarlığı genişlik hesabına dâhil eder.",
                "max-width:100% resim taşmasını önleyebilir."
              ],
              "question": "12 parçalı grid yapısında yüzde 25 genişlik hangi sınıfla örneklendirilmiştir?",
              "options": [
                "col-9",
                "col-6",
                "col-12",
                "col-3"
              ],
              "answer": 3,
              "explanation": "col-3, 12 parçanın üçüne karşılık geldiği için yüzde 25 genişliği temsil eder."
            },
            {
              "category": "Canvas",
              "title": "HTML5 Tuvali Üzerinde Çizim",
              "theory": "Canvas etiketi HTML5 ile web sayfası içinde boş bir tuval oluşturur. Bu tuval üzerinde JavaScript ile çizimler yapılabilir; etkileşimli canlandırmalar, oyunlar ve üç boyutlu çalışmalar geliştirilebilir.",
              "keyPoints": [
                "Canvas HTML5 ile gelmiştir.",
                "Çizimler JavaScript ile yapılır.",
                "Etkileşimli içerikler ve oyunlar geliştirilebilir."
              ],
              "question": "Canvas etiketinin temel görevi nedir?",
              "options": [
                "Çizim yapılabilecek boş bir tuval oluşturmak",
                "Menü bağlantılarını gruplandırmak",
                "Form verilerini göndermek",
                "Tablo satırlarını biçimlendirmek"
              ],
              "answer": 0,
              "explanation": "Canvas etiketi JavaScript ile çizim yapılabilecek boş bir tuval oluşturur."
            }
          ]
        }
      ]
    }
  ]
};
