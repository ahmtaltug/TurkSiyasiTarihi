# Değişiklik günlüğü

## 3.2.0 — 2026-11-20

- **Hata bildirimi:** Her kaydın panelinde ve siyasi tarih bölümünde "Hata bildir" bağlantısı; GitHub'da, görüntülenen kaydın bağlantısıyla doldurulmuş bir form açar. Veri hatası ve öneri için iki form şablonu (`.github/ISSUE_TEMPLATE/`).
- **Güncel durum, son değişiklikler:** Otomatik güncelleme bir il belediyesinin partisi ya da TBMM sandalyeleri değiştiğinde bunu günlüğe yazar; panelde son 12 değişiklik gösterilir.
- **Güncel durum, koruma:** Bir günde 8'den çok il ya da 60'tan çok sandalye değişirse güncelleme durur ve iş başarısız olur (Vikipedi'de hatalı düzenleme olasılığı); GitHub depo sahibine e-posta gönderir. Doğruysa Actions'tan "force" seçeneğiyle uygulanır.
- **Güncel durum, elle düzeltme:** `data/guncel-duzeltmeler.json` ile Vikipedi'deki yanlış ya da gecikmiş bir bilgi (il belediye başkanı, TBMM sandalyesi) kaynağıyla birlikte geçersiz kılınabilir; bitiş tarihi verilebilir.
- **Klavye:** Siyasi tarih grafiğinde ← → bir ay, Shift ile bir yıl ilerler; adres güncellenir.

## 3.1.4 — 2026-11-20

- Birinci Meclis (1920–1923) grupları meclis dağılımında: 10 Mayıs 1921'e dek grupsuz; sonra Birinci Grup; 22 Temmuz 1922'den itibaren muhalif İkinci Grup (63 milletvekili, İngilizce Vikipedi "Second Group (Turkey)"). Birinci Grubun tek başına üye sayısı kaynaklarda bulunmadığından grupsuzlarla birlikte gösterilir.

## 3.1.3 — 2026-11-20

- Siyasi tarihte erken Cumhuriyet meclisinin dönem içi değişiklikleri: Müdâfaa-i Hukuk grubunun Halk Fırkası'na dönüşmesi (9 Eylül 1923), muhalif Terakkiperver Cumhuriyet Fırkası (17 Kasım 1924 – 5 Haziran 1925, yaklaşık 29 milletvekili) ve Serbest Cumhuriyet Fırkası (12 Ağustos – 17 Kasım 1930, 15 milletvekili). Önceden 1923–1927 meclisi dönem boyunca Müdâfaa-i Hukuk olarak görünüyordu.
- Siyasi tarih bağlantısı (`#v=tarih…`) bölüm açıkken değiştirilince de uygulanır.

## 3.1.2 — 2026-11-20

- Yakınlaştırmada yalnız çizgi kalınlıkları güncellenir; renk ölçeği, lejant, demografi grafiği ve karşılaştırma paneli artık her yakınlaştırmada baştan çizilmez.
- Siyasi tarih verisi (seçim panelindeki "seçim tarihinde" satırı için) harita yüklendikten sonra, tarayıcı boştayken indirilir; ilk açılışta haritayla bant genişliği paylaşmaz.
- Yayımlanan sitede JavaScript ve CSS esbuild ile sıkıştırılır (157 KB'den 120 KB'ye; kaynak dosyalar değişmez).

## 3.1.1 — 2026-11-20

- Sürüm uyumsuzlukları giderildi: README (kayıt, parti ve olay sayıları, sürüm rozeti), doğrulama raporu, yol haritası ve değişiklik günlüğündeki eski sürüm ve "son sürüm" ifadeleri güncellendi.
- 16:9 tanıtım videosu (`docs/video/tanitim-16x9.mp4`).

## 3.1.0 — 2026-11-20

- **Güncel durum** (yeni kayıt, "Güncel durum" türü): TBMM'nin bugünkü sandalye dağılımı (2023 seçimine göre farklarla) ve 81 ilin (büyükşehir ya da il merkezi) belediye başkanının bugünkü partisi haritada. Parti değiştirmeler, yeni kurulan partiler (ör. Yeni Parti), vekâleten görevler ve kayyım atamaları yansır.
- **Otomatik güncelleme:** `.github/workflows/guncel.yml` her gün 06:17'de (TSİ) `scripts/build_current.py` ile Vikipedi'den derler; değişiklik varsa veriyi işler ve siteyi yeniden yayımlar.
- Siyasi tarihte son meclis döneminde ve animasyonun bugününde güncel TBMM dağılımı gösterilir.
- 1840 Muhassıllık meclisleri: üyelerin il/sancak dağılımına ya da meclis bileşimine ilişkin derlenebilir bir kaynak bulunamadı; harita ve meclis grafiği eklenmedi.

## 3.0.2 — 2026-11-20

- Yeni Parti (24 Temmuz 2026) eklendi: parti zaman çizelgesi, soy ağacı (öncülü CHP), olaylar ve "faal partiler". Kaynak: Vikipedi "Yeni Parti (2026)".
- 21 Mayıs 2026: CHP 38. Olağan Kurultayı hakkındaki "mutlak butlan" kararıyla Özgür Özel'in CHP genel başkanlığının sona ermesi olaylara eklendi.
- Not: Meclis grafiği seçim sonrası dağılımı gösterir; Yeni Parti'nin TBMM'deki 90 sandalyesi dönem içi değişiklik olduğu için grafikte yer almaz, parti kartında yazar.

## 3.0.1 — 2026-11-20

Projenin tamamlanmış sürümü. 3.0.0 ve önceki sürümlerdeki bütün özellikleri içerir: 1840–2026 arası 88 seçim kaydı döneminin sınırlarıyla haritada; 1876'dan bugüne meclisler, padişahlar, sadrazamlar, cumhurbaşkanları, hükûmetler, partiler ve olaylarla siyasi tarih; karşılaştırma modu, demografik analiz, zaman atlamalı oynatma, açık/koyu tema, çevrimdışı kullanım.

Bu sürümdeki düzeltmeler:
- Osmanlı ve 1920–1923 seçimlerinin panelinde seçim günündeki padişah, sadrazam ve TBMM Başkanı gösterilir.
- 1920–1923 Ankara hükûmetlerinin türü "tek parti" yerine "meclis hükûmeti" (Birinci Meclis'te parti yoktu).
- Siyasi tarih açıkken harita kısayolları (← → boşluk) çalışmaz; siyasi tarihe geçince zaman atlamalı oynatma durur.
- Adres çubuğuna `#v=tarih…` yazılınca siyasi tarih açılır.
- Proje sayfası: mobil ekran görüntüsü GitHub'da kapsam tablosunu daraltıyordu; düzeltildi. Her sürüm için etiket ve GitHub sürüm sayfası artık otomatik oluşturulur (`.github/workflows/release.yml`).

## 3.0.0 — 2026-11-20

### Tarihsel düzeltmeler
- İstibdat dönemi (1878–1908) grafikte yeniden gerçek ölçeğinde; "İstibdat: Meclis kapalı" diye işaretli.
- I. TBMM: "grup yok" ifadesi kaldırıldı. Bilgi kutusu, Birinci Meclis'te parti olmadığını; Birinci Grubun 10 Mayıs 1921'de, İkinci Grubun Temmuz 1922'de kurulduğunu ve grup sayılarının derlenmediğini açıklar. Son Meclis-i Mebusan (1920) için Felâh-ı Vatan notu.
- 1920–1923 arasında devlet başkanı bandında TBMM Başkanı Mustafa Kemal (saltanatın kaldırılmasına dek padişahla birlikte).
- Vekâleten cumhurbaşkanlığı dönemlerinde vekilin adı: Abdülhalik Renda (1938), Tekin Arıburun (1973), İhsan Sabri Çağlayangil (1980), Hüsamettin Cindoruk (1993).
- 1919 meclisi, Meclis'in kapalı olduğu aralığın üzerine taşmıyor.
- Meclis'in kapalı olduğu iki aralık eklendi: 28 Haziran – 13 Aralık 1877 (iki dönem arası) ve 18 Ocak – 18 Nisan 1912 (fesih ve erken seçim).
- Hürriyet ve İtilaf Fırkası'nın ilk faaliyet dönemi Haziran 1913'te (Mahmud Şevket Paşa suikastı sonrası) biter; kaynak bilgi kutusu Bâbıâli Baskını tarihini veriyordu.

### Proje sayfası
- README yeniden yazıldı (ekran görüntüleri, kapsam, kaynaklar); `CITATION.cff` atıf dosyası; sosyal medya önizleme görseli (`icons/og.jpg`).
- Grafikte 1920 öncesinde fareyle gezinme çalışmıyordu; düzeltildi.

### Yeni
- 30 kurumsal olay: Kanun-i Esasi, Meclis-i Umumi'nin açılışı ve tatili, II. Meşrutiyet, 31 Mart Vakası, Mondros, Misak-ı Millî, İstanbul'un işgali, TBMM'nin açılışı, Teşkilât-ı Esasiye, saltanat ve halifeliğin kaldırılması, 1924, 1961 ve 1982 anayasaları, kadınlara seçme ve seçilme hakkı (1934), 2007 ve 2017 halkoylamaları, padişahların tahta çıkışı.
- Siyasi tarih paylaşılabilir bağlantı: `#v=tarih&t=chart&d=1960-05-27` gibi; "Bağlantıyı kopyala" düğmesi.
- Olaylar listesinde bir olaya tıklayınca animasyon o tarihe gider.
- Grafik pencere boyutu değişince yeniden çizilir; olay etiketleri üç satıra dağıtılarak çakışmaz.

## 2.3.0 — 2026-11-20
- Siyasi tarihe Osmanlı sadrazamları (1876–1922, 43 dönem) eklendi: grafikte, bilgi kutusunda ve hükûmetler sekmesinde ayrı tabloda. Kaynak: Vikipedi "Osmanlı sadrazamları listesi" (31 Mart Vakası tarihi Rumi takvimden düzeltildi).
- İstibdat dönemi (1879–1907, Meclis kapalı) grafikte kısaltılmış ölçekte.
- 1919 Meclis-i Mebusan ve I. TBMM için "Belirtilmemiş" yerine "Grup verisi yok"; TBMM'de Mayıs 1921 öncesi parti grubu olmadığı notu.

## 2.2.0 — 2026-11-20
- 1877–1946 genel seçimlerinde haritanın panelinde meclis (yarım daire) grafiği.
- Siyasi tarih verisi sürüm parametresiyle yükleniyor; tarayıcı önbelleğindeki eski veri yüzünden 1920 öncesinin boş görünmesi düzeltildi.
- Meclisin kapalı olduğu dönemler grafikte yazıyla belirtiliyor.

## 2.1.0 — 2026-11-20
- Harita ve Siyasi tarih artık üst çubuktan geçilen iki ana bölüm.
- Meclis grafiği 1876'dan başlıyor: Meclis-i Mebusan (1877, 1908, 1912, 1914, 1919) ve I. TBMM; padişahlar devlet başkanı bandında; Meclis'in kapalı olduğu dönemler (1878–1908 vb.) taralı. Gruplama kaynağın sınıflandırmasıdır (1877 dinî, 1908 etnik, 1912–1914 siyasi).
- Olay animasyonu 1876'dan başlıyor; I. ve II. Meşrutiyet, Bâbıâli Baskını, TBMM'nin açılışı ve Cumhuriyet'in ilanı işaretli.

## 2.0.0 — 2026-11-20

### Siyasi tarih görünümü (yeni; üst çubukta "Siyasi tarih")
- **Meclis ve hükûmetler:** 1920'den bugüne tek grafik. Altta her genel seçim sonrası meclisin sandalye dağılımı (yüzde, parti renkleriyle); üstte cumhurbaşkanları, başbakanlar ve hükûmetlerin parti bileşimi. Koalisyon ortakları üst üste şeritlerle gösterilir; güvenoyu alamayan hükûmetler ✕ ile işaretlidir. Askerî yönetim dönemleri (1960–1961, 1980–1983) ve 27 Mayıs, 12 Mart, 12 Eylül, 28 Şubat, 15 Temmuz, 2018 sistem değişikliği çizgilerle gösterilir. Grafiğin üzerinde gezinince o tarihteki meclis, hükûmet ve cumhurbaşkanı yazar; meclisten haritaya geçilebilir.
- **Hükûmetler ve güvenoyu:** 73 hükûmetin (1920 Ankara hükûmetinden 67. hükûmete) başkanı, tarihleri, süresi, partileri, türü (tek parti, koalisyon, askerî, geçici) ve güvenoyu sonucu. Koalisyon süzgeci, arama ve özet istatistikler.
- **Partiler:** 56 parti ve 4 ittifakın faaliyet dönemleri zaman çizelgesinde; ad değişiklikleri ◆ ile. Bir partiye tıklayınca kuruluş ve kapanış tarihleri, ad değişiklikleri, öncül ve ardıl partiler, ayrılanların kurduğu partiler, birleşmeler ve ittifaklar açılır.
- **Olaylar ve animasyon:** 1908'den bugüne kaydırılabilir ve oynatılabilir zaman. O tarihteki meclis (yarım daire grafik), hükûmet, cumhurbaşkanı, faal partiler ve son olaylar (kuruluş, kapanış, ad değişikliği, ittifak, hükûmet, güvenoyu, cumhurbaşkanı, askerî müdahale) birlikte değişir.

### Harita
- **Karşılaştırma modu (⇆):** İki seçim yan yana iki haritada; haritalar birlikte kayar ve yakınlaşır, aynı görünümde renk ölçeği ortaktır. Panelde ülke geneli farklar, birinci partisi değişen iller (hangi partiden hangisine) ve seçili partinin en çok artıp azaldığı iller listelenir. Adreste saklanır (`&c=`).
- **Demografik karşılaştırma:** Panelde il nüfusu, nüfus yoğunluğu, yıllık nüfus artışı, kişi başı GSYH ve yaşam beklentisi ile seçili görünümün (parti oyu, katılım, değişim) saçılım grafiği ve korelasyon katsayısı. Eski seçimlerde günümüz illerinin nüfusu o dönemin illerine toplanır. İl kartında ilin nüfus göstergeleri.
- **Zaman atlamalı oynatmada olaylar:** İki seçim arasında kurulan ve kapanan partiler, ad değişiklikleri, cumhurbaşkanı değişiklikleri, askerî müdahaleler ve güvenoyu alamayan hükûmetler haritanın üzerinde gösterilir.
- **Seçim tarihindeki siyasi bağlam:** Her seçimin panelinde o gün görevdeki cumhurbaşkanı ve hükûmet.
- **Parti tarihçesi:** Parti geçmişi kartında partinin kuruluş/kapanış, ad değişikliği, öncül/ardıl ve ittifak bilgisi.

### Veri
- `data/history.json`: hükûmetler, cumhurbaşkanları, meclis dağılımları (1923–1946 seçim maddelerinin bilgi kutularından, 1950 sonrası bu sitenin seçim verisinden), parti soy ağacı ve olaylar. Kaynak: Türkçe Vikipedi (`scripts/build_history.py`).
- `data/demographics.json`: 81 ilin 1927–2025 nüfusları, alanları, 2024 kişi başı GSYH ve 2021–2023 yaşam beklentisi. Kaynak: Türkçe ve İngilizce Vikipedi (TÜİK verisine dayanan tablolar).
- Kaynakta kısaltılmış "Mustafa Kemal A" bağlantı etiketi düzeltildi; CHP, MHP ve Hürriyet ve İtilaf Fırkası'nın birden çok faaliyet dönemi madde metnine göre girildi.

## 1.3.0 — 2026-11-20 (kararlı sürüm)

### Özellikler
- **Parti geçmişi:** Ülke geneli çubuklarından bir partiye tıklayınca harita o partinin oy oranına geçer. Altta, partinin aynı türdeki bütün seçimlerde aldığı oy grafikle gösterilir. Parti bir seçime girmediyse (ör. CHP 1981–1992) çizgi o aralıkta kesilir. Aynı kısaltma başka bir partiyi gösteriyorsa (ör. DP) o seçim grafiğe alınmaz.
- **İl arama:** Haritanın sağ üstünde. Seçilen birime harita yakınlaşır; tablodan seçimde de aynısı olur.
- **Paneli gizle:** Masaüstünde haritayı tam genişlikte göstermek için.
- **Kısayollar:** `/` il arama, `Esc` seçili birimi kapatır (← → ve boşluk tuşlarına ek).
- **Çevrimdışı kullanım ve kurulabilirlik:** Service worker, açılmış seçimleri ve sınırları önbellekte tutar. Web uygulaması bildirimi (manifest) ve simgeler eklendi.

### Performans
- İlk açılışta arka plan haritası, ilk seçim ve sınırları paralel indirilir.
- Önceki ve sonraki seçim, tarayıcı boştayken önceden yüklenir; geçişler anında olur.
- Betikler `defer` ile yüklenir. 0,2 saniyeden uzun süren yüklemelerde "Yükleniyor…" göstergesi çıkar.

### Arayüz
- Mobilde başlık ve kontroller sadeleşti: kısa düğme adları, yatay kaydırılabilen tür çipleri, küçük lejant. Tema düğmesinde ☀/☾ simgesi.
- Parti geçmişi kartı, seçili seçimi vurgular; noktaya tıklayınca o seçime geçilir.

### Veri
- 1999 genel seçimine not eklendi: Kaynak veri seti CHP'yi (%8,71, sandalye yok) "Diğer" içinde toplar.

## 1.2.0 — 2026-11-20

### Özellikler
- **Koyu tema:** Sayfa tarayıcının açık/koyu tercihine göre açılır. Sağ üstteki düğme Sistem, Açık ve Koyu arasında geçiş yapar; tercih tarayıcıda saklanır. Parti renklerinin koyu temaya uygun karşılıkları kullanılır.
- **Parti tam adları:** İpuçlarında ve parti seçim kutusunda gösterilir. Kısaltma yılına göre çözülür; örneğin 1950'de "DP" Demokrat Parti, 1973'te Demokratik Parti'dir.
- **İl adları seçim tarihine göre:** Örneğin 1955'e kadar "Seyhan (Adana)" ve "Çoruh (Artvin)", 1984'e kadar "Urfa (Şanlıurfa)", 2002'ye kadar "İçel (Mersin)".

### Harita kalitesi
- Sınırlar daha az sadeleştirildi (Türkiye %30, Osmanlı %15, arka plan %50); yakınlaşınca köşeli görünüm azaldı.
- Çizgi kalınlığı yakınlaştırma düzeyine göre değişiyor.
- Tahmini sınırlar artık kesikli çizgiyle değil, sınır çizgisine dokunmayan hafif bir çapraz taramayla gösteriliyor. Lejanttaki kutucukla gizlenebilir.

### Veri doğrulama ve düzeltmeler (ayrıntı: [docs/DOGRULAMA.md](docs/DOGRULAMA.md))
- `scripts/verify_wiki.py`: 323 parti/aday–seçim çiftinin hepsi ilgili Vikipedi maddesiyle eşleşiyor.
- Kaynak veri setindeki dönemine uymayan parti etiketleri düzeltildi: 1968 ve 1969'da "CGP" → Güven Partisi, 1973 Sakarya'da "DP" → Demokratik Parti, 1989 Çorum'da "MHP" → MÇP.
- Tablo ayrıştırıcısındaki bir hata düzeltildi. 1912'de Yozgat mebusu Ahmet Münir Bey listeden düşüyordu, Aydın'daki üç mebusun bilgileri yanlış satıra kayıyordu.
- Kaynak listede art arda iki kez yazılmış iki ad (1912 Trablusşam, 1920 Saruhan) bir kez sayıldı.
- 1950–1957, 2014 cumhurbaşkanlığı, 2018 ve 2023 seçimlerine, ülke geneli oranların resmî/ansiklopedik değerlerden neden farklı olduğunu açıklayan notlar eklendi.
- Hatay (1939), Cumhuriyet Senatosu, 1930 Belediyeler Kanunu ve 1991 il sayısıyla ilgili ifadeler kaynaklara göre düzeltildi.

## 1.1.0 — 2026-11-20

### Özellikler
- **Veri güvenilirliği rozeti:** Her kayıtta dört düzeyden biri gösterilir (resmî kaynak, ansiklopedik derleme, kısmi/yaklaşık, sonuç verisi yok) ve dayanağı açıklanır. 1950 sonrası kayıtların düzeyi, kaynak veri setinin `sources.yml` dosyasındaki birincil kaynak kaydından alınır.
- **Tahmini sınırların işaretlenmesi:** Sınırı belgelenmiş bir kaynağa değil tahmine dayanan birimler haritada kesikli çizgiyle gösterilir; kartta neyin varsayıldığı yazar.
- **İl seçim geçmişi:** 1950 sonrası bir ilin aynı türdeki bütün seçimleri tabloda listelenir; seçili partinin oy oranı eğri olarak çizilir. Satıra tıklayınca o seçime geçilir.
- **Meclis sandalye grafiği:** Genel seçimlerde ve Senato seçimlerinde ülke geneli sandalye dağılımı yarım daire grafikle gösterilir.
- **CI:** Tarayıcı duman testi (`tests/smoke.js`) her PR'da ve `main`'e her gönderimde çalışır; yayın yalnız test geçerse yapılır.

### Değişiklikler
- 1920–1943 tek parti seçimlerinde varsayılan harita görünümü "Vekil sayısı" oldu; "Çoğunluk" görünümü bütün illeri aynı renge boyuyordu.
- 1908, 1912 ve 1914 kayıtlarına etnik sınıflandırmanın tartışmalı olduğunu belirten not eklendi.

## 1.0.0 — 2026-11-19

İlk sürüm.

### Özellikler
- 1840'tan 7 Haziran 2026 ara seçimine kadar 88 seçim kaydı. Kapsam: Meclis-i Mebusan, TBMM, mahalli idareler (belediye başkanlığı ve il genel meclisi), Cumhuriyet Senatosu, halkoylamaları ve cumhurbaşkanlığı seçimleri.
- Her seçim kendi döneminin il, sancak ya da vilayet sınırlarıyla çizilir. 1950 öncesi sınırlar yaklaşıktır.
- Harita görünümleri: birinci parti/aday, parti oy oranı, katılım, vekil sayısı, grup payı ve **değişim** (aynı türden bir önceki seçime göre puan farkı).
- **Zaman atlamalı oynatma:** Seçili dönem ve türdeki seçimleri sırayla oynatır. Dört hız ayarı ve yıl göstergesi vardır; boşluk tuşuyla başlatılıp durdurulur.
- Sıralanabilir **birim tablosu**, il/vilayet ayrıntı kartı ve 1950 öncesi için vekil adları.
- Görüntülenen seçimin il verisi için **CSV indirme** ve görünüm bağlantısını **kopyalama**.
- Zaman çizelgesi, dönem ve tür filtreleri, klavye kısayolları (← → boşluk), mobil uyumlu yerleşim.

### Veri notları
- 1923, 1927 ve 1943 seçimlerinin tarih etiketleri, aşamalı seçim tarihlerini gösterecek şekilde netleştirildi.
- 1931 açıklaması düzeltildi. Bağımsızlara ayrılan 30 sandalyenin yalnız 20'si dolduruldu.
- 1931, 1935, 1939 ve 1943'te dönem listeleri bağımsız vekilleri ayırmadığı için il düzeyinde parti etiketi gösterilmez. Toplam sandalye sayıları seçim maddelerinin bilgi kutularından alındı.
- 1968 Van il genel meclisi CGP oyu kaynakta 928.067 görünüyordu. Geçerli oy toplamıyla birebir tutan 28.067 olarak düzeltildi.

### Düzeltmeler
- Filtre dışındaki bir seçimden "önceki" düğmesine basınca listenin başına atlama hatası giderildi.
- Renk ölçeği her yeniden çizimde bir kez hesaplanıyor (oynatmada akıcılık).
- Seçimler arasında geçerken harita katmanı yenisi hazır olduktan sonra değişiyor; geçişte titreme yok.
