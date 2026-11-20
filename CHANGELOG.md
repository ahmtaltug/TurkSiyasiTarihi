# Değişiklik günlüğü

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
