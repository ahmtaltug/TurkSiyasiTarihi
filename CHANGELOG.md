# Değişiklik günlüğü

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
