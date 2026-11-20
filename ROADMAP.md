# Olası gelecek çalışmalar

Proje 3.4 sürümüyle tamamlanmış durumdadır; güncel durum verisi her gün otomatik yenilenir. Bu liste, ileride biri projeyi sürdürmek isterse ele alınabilecek işleri öncelik sırasıyla toplar. İlk sürümü, projenin iki bağımsız değerlendirmesinden (Claude ve ChatGPT, Kasım 2026) çıkarıldı.
Her iki değerlendirmenin ortak sonucu şudur: Yeni görsel özelliklerden önce **1950 öncesi verinin kaynaklandırılması ve doğrulanması** gelir.

## 1. Veri doğrulama (en yüksek öncelik)
- [ ] **1920–1946:** İl bazındaki vekil ve parti verisini TBMM Albümü (1920–2010) ile karşılaştırmak. Ara seçimle gelenleri tek tek işaretlemek; seçim günündeki sandalye dağılımını ayrı tutmak.
- [ ] **1877–1919:** Vilayet ve sancak bazındaki mebus sayılarını akademik çalışmalarla karşılaştırmak (örn. Hasan Kayalı, *Elections and the Electoral Process in the Ottoman Empire, 1876–1919*, 1995; TBMM Vakfı, *Türk Parlamento Tarihi*).
- [ ] Doğrulanan kayıtlara **"Literatür"** düzeyi eklemek: güvenilirlik rozetinde akademik kaynak ve sayfa numarası gösterilecek.
- [ ] Her kayıtta kaynak bağlantısının yanında, mümkünse sayfa numarası vermek (YSK, Resmî Gazete, DİE yayınları, meclis zabıtları).
- [ ] Tahmini sınır atamalarını (`scripts/build_historical.py` içinde `tr_unit` ve `boundary_note`) dönemin idari bölünüş kaynaklarıyla (Dahiliye salnameleri, Resmî Gazete'deki kanunlar) doğrulamak.
- [ ] Doğrulanan 1950 öncesi veriyi kaynak projeye (hamiKumbasae/turkiye-secim-haritasi) katkı olarak önermek.
- [ ] 1950 sonrası seçim açıklamalarını (`scripts/descriptions.py`) seçim maddeleriyle tek tek kaynaklandırmak; 3.4.0'daki metinler temel bilgilerle sınırlı tutuldu.

## 2. Analiz özellikleri
- [x] İki seçimi yan yana karşılaştırma görünümü (2.0.0).
- [x] Parti zaman çizgisi: aynı türdeki seçimlerde ülke geneli oy oranı (1.3.0). Öncül/ardıl partileri birleştirme ve kazanılan il sayısı henüz yok.
- [x] Partilerin kuruluş, kapanış ve birleşmelerini zaman çizelgesinde göstermek (2.0.0). Öncül/ardıl bilgisi Vikipedi bilgi kutularına dayanır; birincil kaynakla karşılaştırılmadı.
- [x] Seçim sonuçlarını nüfus, yoğunluk, nüfus artışı, gelir ve yaşam beklentisiyle karşılaştırmak (2.0.0).
- [ ] İl bazında kentleşme oranı ve iç göç (TÜİK) verisi; ilçe sınırları değişen illerde dönemin nüfusunu birebir kurmak.
- [ ] Meclis grafiğinde dönem içi değişiklikler (parti değiştirme, ara seçim) ve Cumhuriyet Senatosu. 1920–1930 gruplaşmaları ve muhalefet partileri (3.1.3–3.1.4) ile bugünkü TBMM dağılımı (3.1.0) var; 1950 sonrası dönem içi değişiklikler yok.
- [x] İlçe düzeyi: 1950/1955 yerel ve 1961 sonrası seçimler, döneminin ilçe sınırlarıyla (3.3.0).

## 3. Arayüz ve erişilebilirlik
- [x] İngilizce arayüz (3.3.0). Seçim açıklamaları ve notlar Türkçe kalır.
- [ ] Haritanın klavyeyle gezilebilmesi. Şimdilik birim tablosu, il arama (`/`) ve klavye kısayolları bu işlevi kısmen karşılıyor.

## 4. Uzun vadeli kapsam
Site seçimlerin ötesinde siyasi tarihi de kapsıyor: hükûmetler, cumhurbaşkanları ve partiler 2.0.0'da eklendi. Kalan olası modüller: vekil biyografileri ve anayasa değişiklikleri. Bu, bakım yükünü belirgin biçimde artıracağından ancak 1. bölüm tamamlandıktan sonra ele alınmalı.
