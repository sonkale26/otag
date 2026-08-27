/* Çöz-Öğren — içerik verisi. Elle de düzenleyebilirsiniz. */
window.EO_DATA = {
  "meta": {
    "id": "mmt4auu99gva7g6",
    "title": "Bölüm 7",
    "subtitle": "Veri Tabanı Yönetim Sistemleri",
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
          "title": "Veri Tabanı Temelleri ve İlişkisel Model",
          "items": [
            {
              "term": "Veri",
              "definition": "Ham gerçekler, gözlemler ya da ölçümler biçiminde toplanan, anlamı doğrudan çıkarılamayan sembollerdir."
            },
            {
              "term": "Bilgi",
              "definition": "Verilerin işlenmiş, analiz edilmiş ve anlamlandırılmış hâlidir."
            },
            {
              "term": "Veri Tabanı",
              "definition": "İlişkili verilerin sistemli biçimde depolandığı ve yönetildiği dijital ortamdır."
            },
            {
              "term": "Dosya Tabanlı Sistem",
              "definition": "Verilerin uygulama programlarına bağlı olarak düz veya sabit yapılı dosyalarda tutulduğu ve her programın kendi verisini ayrı yönettiği geleneksel veri saklama yapısıdır."
            },
            {
              "term": "İşlem",
              "definition": "Veri tabanı üzerinde bütünlük içinde gerçekleştirilen ve ya tamamen tamamlanan ya da hiç gerçekleşmemiş gibi geri alınan işlem birimidir."
            },
            {
              "term": "Eş Zamanlılık Kontrolü",
              "definition": "Birden fazla kullanıcının aynı anda veriyle çakışmadan işlem yapabilmesini sağlayan veri tabanı mekanizmasıdır."
            }
          ]
        },
        {
          "title": "Veri Tabanı Tasarımı ve Normalizasyon",
          "items": [
            {
              "term": "Veri Tabanı Yaşam Döngüsü",
              "definition": "Bir veri tabanının fikir olarak ortaya çıkmasından işletilmesine ve zaman içinde geliştirilmesine kadar geçen süreçlerin bütünüdür."
            },
            {
              "term": "Kavramsal Tasarım",
              "definition": "Sistemde hangi bilgilerin tutulacağının ve bu bilgiler arasında nasıl ilişkiler kurulacağının belirlendiği tasarım aşamasıdır."
            },
            {
              "term": "Mantıksal Tasarım",
              "definition": "Kavramsal yapıdaki varlıkların tablolara, özniteliklerin sütunlara ve ilişkilerin yabancı anahtarlara dönüştürüldüğü aşamadır."
            },
            {
              "term": "Fiziksel Tasarım",
              "definition": "Verilerin gerçek veri tabanı sisteminde nasıl saklanacağı, nasıl erişileceği, performansın nasıl artırılacağı ve güvenliğin nasıl sağlanacağına ilişkin teknik kararların verildiği aşamadır."
            },
            {
              "term": "ER Diyagramı",
              "definition": "Veri tabanında yer alacak varlıkları, öznitelikleri ve ilişkileri grafiksel olarak gösteren ve planlama aşamasında kullanılan diyagramdır."
            },
            {
              "term": "Normalizasyon",
              "definition": "Veri tekrarlarını azaltmak ve veri bütünlüğünü artırmak için tabloların belirli kurallara göre yapısal olarak düzenlenip parçalara ayrılması sürecidir."
            }
          ]
        },
        {
          "title": "SQL ve JOIN İşlemleri",
          "items": [
            {
              "term": "SQL",
              "definition": "İlişkisel veri tabanı sistemleri ile iletişim kurmak için kullanılan; verileri sorgulama, güncelleme, ekleme ve silme işlemlerine olanak tanıyan standart dildir."
            },
            {
              "term": "DDL",
              "definition": "Tablolar, sütunlar, veri türleri ve anahtarlar gibi veri tabanı yapılarını tanımlamak için kullanılan veri tanımlama komutları grubudur."
            },
            {
              "term": "DML",
              "definition": "Veri ekleme, güncelleme ve silme gibi doğrudan veri işlemlerini gerçekleştiren komutlar grubudur."
            },
            {
              "term": "DQL",
              "definition": "Verilerin sorgulanması ve görüntülenmesi için kullanılan komutlar grubudur; SELECT bu amaçla kullanılan temel komuttur."
            },
            {
              "term": "JOIN",
              "definition": "İlişkili tablolardaki verileri anahtar alanlar üzerinden birleştirerek tek bir sonuç kümesinde sunmak için kullanılan SQL işlemidir."
            },
            {
              "term": "NULL",
              "definition": "SQL'de bir değerin olmadığını, bilinmeyen veya tanımsız olduğunu ifade eden değerdir; sıfır ya da boşluk değildir."
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
          "title": "Veri Tabanı Temelleri ve İlişkisel Model",
          "items": [
            {
              "question": "Dosya tabanlı sistemlerde aynı müşteri bilgisinin farklı departmanlarda ayrı ayrı tutulmasının temel sonucu hangisidir?",
              "options": [
                "Veri tekrarı ve tutarsızlık oluşması",
                "Veri yapısının programlardan bağımsız hâle gelmesi",
                "Tüm güncellemelerin tek noktadan yapılması",
                "Farklı sistemlerin otomatik olarak bütünleşmesi"
              ],
              "answer": 0,
              "explanation": "Aynı bilginin birden fazla dosyada tutulması veri tekrarına yol açar; dosyalardan biri güncellenmediğinde eski ve yeni bilgiler birlikte bulunarak tutarsızlık oluşturur."
            },
            {
              "question": "Aynı öğrenci kaydının iki kullanıcı tarafından eş zamanlı güncellenmesi hangi probleme yol açabilir?",
              "options": [
                "Varlık bütünlüğü",
                "Kayıp güncelleme",
                "Normalizasyon",
                "İndeksleme"
              ],
              "answer": 1,
              "explanation": "Aynı veriye yapılan iki işlem çakıştığında önceki güncellemenin fark edilmeden silinmesi kayıp güncelleme problemidir."
            },
            {
              "question": "İlişkisel modelde bir tablodaki her satırı benzersiz biçimde tanımlayan yapı hangisidir?",
              "options": [
                "Nitelik",
                "Yabancı anahtar",
                "Birincil anahtar",
                "Kayıt"
              ],
              "answer": 2,
              "explanation": "Birincil anahtar tablodaki her satırı benzersiz şekilde tanımlar, boş bırakılamaz ve tekrar eden değerlere izin vermez."
            },
            {
              "question": "Bir tablodaki alanın başka bir tablonun birincil anahtarına referans vermesi hangi yapıyı oluşturur?",
              "options": [
                "Aday anahtar",
                "Bileşik anahtar",
                "Varlık bütünlüğü",
                "Yabancı anahtar"
              ],
              "answer": 3,
              "explanation": "Yabancı anahtar, bir tablodaki alanın başka bir tablonun birincil anahtarına referans vermesiyle tablolar arasında mantıksal bağ kurar."
            },
            {
              "question": "İlişkisel modelde bir bölümün birden fazla öğretim üyesiyle eşleşmesi, her öğretim üyesinin ise yalnızca bir bölümde yer alması hangi ilişki türüdür?",
              "options": [
                "Bire çok ilişki",
                "Bire bir ilişki",
                "Çoktan çoğa ilişki",
                "Anahtarsız ilişki"
              ],
              "answer": 0,
              "explanation": "Bir bölüm birden fazla öğretim üyesi içerebilirken her öğretim üyesi yalnızca bir bölüme bağlı olduğunda ilişki bire çok biçimindedir."
            }
          ]
        },
        {
          "title": "Veri Tabanı Tasarımı ve Normalizasyon",
          "items": [
            {
              "question": "Birinci Normal Formun temel koşulu hangisidir?",
              "options": [
                "Her hücrede yalnızca bir değer bulunması",
                "Tüm alanların yalnızca bölüm bilgisine bağlı olması",
                "Her tablonun tek satırdan oluşması",
                "Tüm ilişkilerin bire bir olması"
              ],
              "answer": 0,
              "explanation": "Birinci Normal Formda her alan tek bir değerden oluşmalı ve çoklu değerler ayrı satırlara bölünmelidir."
            },
            {
              "question": "İkinci Normal Formda veri hangi yapıya bağımlı olmalıdır?",
              "options": [
                "Yalnızca yabancı anahtara",
                "Bileşik anahtarın tamamına",
                "Herhangi bir sütuna",
                "Yalnızca tablo adına"
              ],
              "answer": 1,
              "explanation": "İkinci Normal Formda öz nitelikler bileşik anahtarın yalnızca bir bölümüne değil, anahtarın tamamına bağımlı olmalıdır."
            },
            {
              "question": "Üçüncü Normal Formda öz niteliklerin bağlı olması gereken yapı hangisidir?",
              "options": [
                "Diğer öz nitelikler",
                "Birleşim tablosu",
                "Birincil anahtar",
                "Fiziksel depolama alanı"
              ],
              "answer": 2,
              "explanation": "Üçüncü Normal Formda tüm öz niteliklerin yalnızca birincil anahtara bağlı olması gerekir."
            },
            {
              "question": "Veri tabanı yaşam döngüsünde örnek veri girişleriyle sistemin doğru çalışıp çalışmadığının sınandığı aşama hangisidir?",
              "options": [
                "Ön inceleme",
                "Kullanım",
                "Bakım ve gelişim",
                "Test ve değerlendirme"
              ],
              "answer": 3,
              "explanation": "Test ve değerlendirme aşamasında kurulan veri tabanı örnek verilerle sınanır ve beklenmedik durumlara verdiği tepkiler kontrol edilir."
            },
            {
              "question": "Sık sorgulanan bir alana indeks atanmasının temel amacı hangisidir?",
              "options": [
                "Arama işlemlerini hızlandırmak",
                "Veri tekrarını artırmak",
                "Tüm tabloları tek tabloda birleştirmek",
                "Kullanıcı yetkilerini kaldırmak"
              ],
              "answer": 0,
              "explanation": "İndeksleme, verilerin disk üzerindeki yerini referans alan yardımcı yapılar oluşturarak arama ve sorgu işlemlerini hızlandırır."
            }
          ]
        },
        {
          "title": "SQL ve JOIN İşlemleri",
          "items": [
            {
              "question": "Veri tabanında yeni bir tablo oluşturmak için hangi komut kullanılır?",
              "options": [
                "CREATE TABLE",
                "DELETE FROM",
                "UPDATE",
                "SELECT"
              ],
              "answer": 0,
              "explanation": "CREATE TABLE komutu veri tabanında yeni ve boş bir tablo oluşturmak için kullanılan veri tanımlama komutudur."
            },
            {
              "question": "UPDATE komutunda WHERE koşulunun yazılmaması hangi sonucu doğurabilir?",
              "options": [
                "Sorgunun yalnızca ilk kaydı etkilemesi",
                "Tablodaki tüm kayıtların güncellenmesi",
                "Yeni bir tablo oluşturulması",
                "Tüm sütunların silinmesi"
              ],
              "answer": 1,
              "explanation": "WHERE koşulu hangi kaydın değiştirileceğini sınırlar; koşul yazılmazsa UPDATE işlemi tablodaki tüm kayıtları etkileyebilir."
            },
            {
              "question": "Yalnızca iki tabloda da eşleşen kayıtları döndüren JOIN türü hangisidir?",
              "options": [
                "RIGHT JOIN",
                "LEFT JOIN",
                "INNER JOIN",
                "Birleşim tablosu"
              ],
              "answer": 2,
              "explanation": "INNER JOIN yalnızca her iki tabloda ortak anahtar değeri üzerinden eşleşen kayıtları sonuç kümesine alır."
            },
            {
              "question": "BETWEEN ifadesinin özelliği hangisidir?",
              "options": [
                "Yalnızca metin alanlarında kullanılabilmesi",
                "Sınır değerlerini dışarıda bırakması",
                "Sadece tek bir değeri karşılaştırması",
                "Belirlenen iki değer arasındaki kayıtları sınırlar dâhil seçmesi"
              ],
              "answer": 3,
              "explanation": "BETWEEN iki değer arasındaki kayıtları seçer ve belirtilen alt ile üst sınır değerlerini de aralığa dâhil eder."
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
          "title": "Veri Tabanı Temelleri ve İlişkisel Model",
          "items": [
            {
              "answer": "TUTARSIZLIK",
              "clue": "Aynı bilginin farklı dosyalarda birbiriyle çelişen biçimlerde bulunması durumu"
            },
            {
              "answer": "KİLİTLEME",
              "clue": "Aynı veriye eş zamanlı müdahaleyi geçici olarak engelleyen erişim kısıtlaması"
            },
            {
              "answer": "BÜTÜNLÜK",
              "clue": "Verilerin doğru, geçerli ve birbirini tamamlayan yapıda tutulmasına ilişkin özellik"
            },
            {
              "answer": "NİTELİK",
              "clue": "İlişkisel tabloda bir varlığın özelliklerinden birini temsil eden sütun"
            },
            {
              "answer": "KAYIT",
              "clue": "Tabloda bir varlığa ait tüm bilgileri içeren tekil satır"
            },
            {
              "answer": "TEKRAR",
              "clue": "Aynı bilginin sistemde birden fazla kopya hâlinde bulunması"
            }
          ]
        },
        {
          "title": "Veri Tabanı Tasarımı ve Normalizasyon",
          "items": [
            {
              "answer": "İNDEKSLEME",
              "clue": "Sık aranan kayıtların daha hızlı bulunmasını sağlayan fiziksel tasarım tekniği"
            },
            {
              "answer": "DEPOLAMA",
              "clue": "Verilerin kalıcı olarak disk üzerinde nasıl tutulacağını belirleyen fiziksel tasarım konusu"
            },
            {
              "answer": "YEDEKLEME",
              "clue": "Sistem arızası veya veri kaybı sonrasında geri yükleme amacıyla kopya oluşturma işlemi"
            },
            {
              "answer": "KURTARMA",
              "clue": "Kayıp veya bozulmuş verilerin alınmış kopyalardan geri getirilmesi süreci"
            },
            {
              "answer": "PERFORMANS",
              "clue": "Veriye hızlı ve tutarlı biçimde erişilebilmesiyle ilgili sistem özelliği"
            },
            {
              "answer": "GÜVENLİK",
              "clue": "Yetkisiz erişim ve veri kaybı risklerine karşı korunma boyutu"
            }
          ]
        },
        {
          "title": "SQL ve JOIN İşlemleri",
          "items": [
            {
              "answer": "SORGULAMA",
              "clue": "Veri tabanından belirli bilgileri istenen koşullara göre elde etme işlemi"
            },
            {
              "answer": "FİLTRELEME",
              "clue": "Tablodaki kayıtları belirli ölçütlere göre sınırlandırma işlemi"
            },
            {
              "answer": "EŞLEŞME",
              "clue": "İki tabloda ortak anahtar değerlerinin birbirine karşılık gelmesi durumu"
            },
            {
              "answer": "KOŞUL",
              "clue": "Hangi kayıtların seçileceğini, güncelleneceğini veya silineceğini belirleyen ölçüt"
            },
            {
              "answer": "JOKER",
              "clue": "LIKE ile desen ararken yüzde ve alt çizgi gibi kullanılan özel karakter türü"
            },
            {
              "answer": "KÜME",
              "clue": "IN ifadesinin bir değerin içinde bulunup bulunmadığını denetlediği belirli değerler grubu"
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
          "title": "Veri Tabanı Temelleri ve İlişkisel Model",
          "items": [
            {
              "term": "Aday Anahtar",
              "definition": "Bir tabloda eşsiz olma özelliği taşıyan ve birincil anahtar olarak seçilebilecek alanlardan biridir."
            },
            {
              "term": "Bileşik Anahtar",
              "definition": "Bir satırı eşsiz biçimde tanımlamak için birden fazla alanın birlikte kullanılmasıyla oluşturulan anahtardır."
            },
            {
              "term": "Varlık Bütünlüğü",
              "definition": "Bir tablonun birincil anahtarının boş bırakılamamasını gerektiren bütünlük kuralıdır."
            },
            {
              "term": "İlişkisel Bütünlük",
              "definition": "Yabancı anahtarın işaret ettiği değerin referans verilen tabloda bulunmasını gerektiren kuraldır."
            },
            {
              "term": "Birleşim Tablosu",
              "definition": "Çoktan çoğa bir ilişkiyi iki bire çok ilişkiye dönüştürerek yönetmek için kullanılan üçüncü tablodur."
            }
          ]
        },
        {
          "title": "Veri Tabanı Tasarımı ve Normalizasyon",
          "items": [
            {
              "term": "Veri Tabanı Ön İncelemesi",
              "definition": "Mevcut sistemin, sorunların, kısıtların ve kullanıcı ihtiyaçlarının analiz edildiği yaşam döngüsü aşamasıdır."
            },
            {
              "term": "Kurulum ve Veri Yükleme",
              "definition": "Veri tabanı yönetim sisteminin kurulduğu, tabloların oluşturulduğu ve mevcut verilerin sisteme aktarıldığı aşamadır."
            },
            {
              "term": "Test ve Değerlendirme",
              "definition": "Sistemin örnek verilerle sınandığı ve doğru çalışıp çalışmadığının kontrol edildiği aşamadır."
            },
            {
              "term": "Kullanım",
              "definition": "Testleri geçen veri tabanının kurum tarafından aktif olarak kullanılmaya başlandığı aşamadır."
            },
            {
              "term": "Bakım ve Gelişim",
              "definition": "Hataların giderildiği ve değişen kullanıcı ihtiyaçlarına göre yeni özelliklerin eklendiği aşamadır."
            }
          ]
        },
        {
          "title": "SQL ve JOIN İşlemleri",
          "items": [
            {
              "term": "INNER JOIN",
              "definition": "Her iki tabloda da eşleşen kayıtları döndürür."
            },
            {
              "term": "LEFT JOIN",
              "definition": "Sol tablodaki tüm kayıtları getirir; sağ tabloda eşleşme yoksa ilgili alanlarda NULL gösterir."
            },
            {
              "term": "WHERE",
              "definition": "Veriler üzerinde koşula dayalı seçim ve filtreleme yapılmasını sağlar."
            },
            {
              "term": "IN",
              "definition": "Bir sütun değerinin belirtilen değerler kümesi içinde olup olmadığını kontrol eder."
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
          "title": "Veri Tabanı Temelleri ve İlişkisel Model",
          "items": [
            {
              "category": "Veri Tabanı Temelleri",
              "title": "Dosya tabanlı yapılardan veri tabanı sistemlerine geçiş",
              "theory": "Dosya tabanlı sistemlerde her uygulama kendi veri dosyalarını yönettiği için aynı bilgi farklı dosyalarda tekrar edebilir. Bir dosyada yapılan güncellemenin diğer dosyalara yansımaması veri tutarsızlığına, yapısal değişikliklerin tüm programları etkilemesi ise bakım maliyetleri ve hata riskine yol açabilir. Veri tabanı yönetim sistemleri verileri merkezî ve bütünleşik bir yapıda tutarak tekrarları azaltır, kullanıcı erişimini kolaylaştırır ve güvenlik ile yetkilendirmeyi daha düzenli hâle getirir. Çok kullanıcılı ortamlarda işlem yönetimi, kilitleme ve eş zamanlılık kontrolü gibi mekanizmalarla çakışmaların önüne geçilir.",
              "keyPoints": [
                "Dosya tabanlı yapılarda veri tekrarı ve tutarsızlık görülebilir.",
                "Merkezî veri yönetimi güncellemeleri ve erişimi kolaylaştırır.",
                "Eş zamanlılık kontrolü çok kullanıcılı işlemlerde çakışmaları azaltır."
              ],
              "question": "Veri tabanı yönetim sistemlerinin dosya tabanlı sistemlere göre sağladığı temel üstünlüklerden biri hangisidir?",
              "options": [
                "Her uygulamanın aynı veriyi ayrı dosyada tutması",
                "Verilerin merkezî ve bütünleşik biçimde yönetilmesi",
                "Veri yapısındaki değişikliklerin tüm programları zorunlu olarak etkilemesi",
                "Kullanıcı erişiminin yalnızca programcılar aracılığıyla yapılması"
              ],
              "answer": 1,
              "explanation": "Veri tabanı yönetim sistemleri verileri merkezî ve bütünleşik yapıda yöneterek veri tekrarını azaltır ve farklı kullanıcıların güncel verilere kontrollü biçimde erişmesini sağlar."
            },
            {
              "category": "İlişkisel Model",
              "title": "Tablolar, anahtarlar ve ilişkiler",
              "theory": "İlişkisel veri tabanı modelinde veriler satır ve sütunlardan oluşan tablolarda tutulur. Her tablo belirli bir varlık türünü temsil eder; satırlar kayıtları, sütunlar ise nitelikleri gösterir. Tablolar arasındaki bağlar anahtarlar aracılığıyla kurulur ve birincil anahtarlar her kaydı benzersiz biçimde tanımlar. Yabancı anahtarlar farklı tabloları birbirine bağlarken bire bir, bire çok ve çoktan çoğa ilişki türleri veri yapısının mantıksal düzenini belirler.",
              "keyPoints": [
                "Her tablo tek bir varlık türünü temsil eder.",
                "Birincil anahtar kayıtları benzersiz biçimde tanımlar.",
                "Yabancı anahtarlar tablolar arasında ilişki kurar."
              ],
              "question": "Çoktan çoğa bir öğrenci-ders ilişkisinin ilişkisel modelde kurulması için hangi yapı kullanılır?",
              "options": [
                "Tek bir metin alanı",
                "Yalnızca birincil anahtar",
                "Birleşim tablosu",
                "Boş değer"
              ],
              "answer": 2,
              "explanation": "Çoktan çoğa ilişkiler doğrudan kurulmaz; öğrenci ve ders tablolarını yabancı anahtarlarla bağlayan bir birleşim tablosu kullanılır."
            }
          ]
        },
        {
          "title": "Veri Tabanı Tasarımı ve Normalizasyon",
          "items": [
            {
              "category": "Tasarım Aşamaları",
              "title": "Kavramsal modelden fiziksel uygulamaya geçiş",
              "theory": "Veri tabanı tasarımı kavramsal, mantıksal ve fiziksel olmak üzere üç temel aşamada ilerler. Kavramsal tasarımda kullanıcı gereksinimleri doğrultusunda hangi varlıkların ve ilişkilerin bulunacağı belirlenir ve ER diyagramlarıyla gösterilir. Mantıksal tasarımda varlıklar tablolara, öznitelikler sütunlara ve ilişkiler yabancı anahtarlara dönüştürülür; normalizasyonla tekrarlar ve mantıksal çakışmalar azaltılır. Fiziksel tasarımda ise depolama, indeksleme, performans, yetkilendirme, yedekleme ve kurtarma gibi uygulama ayrıntıları planlanır.",
              "keyPoints": [
                "Kavramsal tasarım bilgi gereksinimleri ve ilişkileri belirler.",
                "Mantıksal tasarım kavramsal modeli ilişkisel tablolara dönüştürür.",
                "Fiziksel tasarım depolama, performans ve güvenlik kararlarını içerir."
              ],
              "question": "ER diyagramının temel kullanım amacı hangisidir?",
              "options": [
                "Veri tabanındaki varlıkları, öznitelikleri ve ilişkileri grafiksel olarak göstermek",
                "SQL sorgularını otomatik olarak çalıştırmak",
                "Disk üzerindeki tüm verileri yedeklemek",
                "Kullanıcı parolalarını değiştirmek"
              ],
              "answer": 0,
              "explanation": "ER diyagramı veri tabanında yer alacak varlıkları, bunların özniteliklerini ve aralarındaki ilişkileri kavramsal düzeyde grafiksel olarak gösterir."
            },
            {
              "category": "Normalizasyon",
              "title": "1NF, 2NF ve 3NF ile veri tekrarını azaltma",
              "theory": "Normalizasyon, veri tekrarlarını azaltmak ve veri bütünlüğünü artırmak için tablolara belirli kurallar uygulayan yapısal düzenleme sürecidir. Birinci Normal Formda her hücre tek bir değer içerir. İkinci Normal Formda öz nitelikler bileşik anahtarın tamamına bağımlı olacak şekilde tablolar ayrılır. Üçüncü Normal Formda ise tüm öz niteliklerin yalnızca birincil anahtara bağlı olması sağlanır; bununla birlikte aşırı normalizasyonun fazla tablo oluşturarak sorgu performansını olumsuz etkileyebileceği belirtilmektedir.",
              "keyPoints": [
                "1NF çoklu değerleri tekil hücrelere ayırır.",
                "2NF kısmi bağımlılıkları ortadan kaldırır.",
                "3NF öz nitelikleri yalnızca birincil anahtara bağlar."
              ],
              "question": "Normalizasyon ile performans arasında neden denge kurulmalıdır?",
              "options": [
                "Normalizasyon veri güvenliğini tamamen kaldırdığı için",
                "Aşırı normalizasyon çok fazla tablo oluşturup sorgu performansını düşürebildiği için",
                "Normalizasyon yalnızca dosya tabanlı sistemlerde kullanılabildiği için",
                "Normalizasyon birincil anahtar kullanımını engellediği için"
              ],
              "answer": 1,
              "explanation": "Aşırı normalizasyon çok fazla tabloya bölünmeye yol açabilir ve bu durum sorgu performansını olumsuz etkileyebilir."
            }
          ]
        },
        {
          "title": "SQL ve JOIN İşlemleri",
          "items": [
            {
              "category": "Temel SQL Komutları",
              "title": "Tablo oluşturma ve veri üzerinde işlem yapma",
              "theory": "SQL komutları veri tanımlama, veri işleme ve veri sorgulama amaçlarıyla gruplandırılır. CREATE TABLE komutu yeni tablo oluşturur, INSERT INTO tabloya yeni kayıt ekler, UPDATE mevcut kayıtları günceller ve DELETE FROM kayıtları siler. SELECT komutu verileri görüntülemek için kullanılır. UPDATE ve DELETE gibi işlemlerde WHERE koşulunun doğru yazılması özellikle önemlidir; aksi durumda istenmeyen çok sayıda kayıt etkilenebilir.",
              "keyPoints": [
                "CREATE TABLE veri tabanı yapısını oluşturur.",
                "INSERT, UPDATE ve DELETE veriler üzerinde değişiklik yapar.",
                "SELECT verileri sorgulamak ve görüntülemek için kullanılır."
              ],
              "question": "Bir öğrencinin yalnızca belirli kaydını silmek için DELETE komutunda hangi ifade kullanılmalıdır?",
              "options": [
                "VALUES",
                "WHERE",
                "PRIMARY KEY",
                "VARCHAR"
              ],
              "answer": 1,
              "explanation": "WHERE ifadesi silme işleminin hangi koşulu sağlayan kayda uygulanacağını belirler ve diğer kayıtların etkilenmesini önler."
            },
            {
              "category": "Birleşik ve Koşullu Sorgular",
              "title": "JOIN ve filtreleme ifadeleriyle anlamlı sonuç kümeleri",
              "theory": "İlişkisel veri tabanlarında farklı tablolarda bulunan veriler JOIN işlemleriyle bir araya getirilebilir. INNER JOIN yalnızca eşleşen kayıtları, LEFT JOIN sol tablodaki tüm kayıtları ve RIGHT JOIN sağ tablodaki tüm kayıtları döndürür; eşleşmeyen alanlar NULL olabilir. WHERE koşula dayalı filtreleme yaparken karşılaştırma operatörleri ile AND, OR ve NOT birden fazla ölçütün kullanılmasını sağlar. BETWEEN aralık, LIKE desen ve IN belirli bir değerler kümesi üzerinden seçim yapılmasına olanak tanır.",
              "keyPoints": [
                "JOIN işlemleri ilişkili tabloları tek sonuç kümesinde birleştirir.",
                "LEFT ve RIGHT JOIN eşleşmeyen alanlarda NULL üretebilir.",
                "WHERE, BETWEEN, LIKE ve IN farklı filtreleme gereksinimlerini karşılar."
              ],
              "question": "Not kaydı bulunmayan öğrencileri de öğrenci listesinde göstermek için hangi JOIN türü uygundur?",
              "options": [
                "INNER JOIN",
                "LEFT JOIN",
                "Yalnızca SELECT",
                "BETWEEN"
              ],
              "answer": 1,
              "explanation": "LEFT JOIN sol taraftaki öğrenci tablosunun tüm kayıtlarını getirir; not tablosunda eşleşme yoksa notla ilgili alanlar NULL olarak görünür."
            }
          ]
        }
      ]
    }
  ]
};
