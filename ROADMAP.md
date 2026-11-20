# Yol haritası

Bu liste, projenin iki bağımsız değerlendirmesinden (Claude ve ChatGPT, Kasım 2026) çıkan ve henüz yapılmamış önerileri öncelik sırasıyla toplar.
Her iki değerlendirmenin ortak sonucu şudur: Yeni görsel özelliklerden önce **1950 öncesi verinin kaynaklandırılması ve doğrulanması** gelir.

## 1. Veri doğrulama (en yüksek öncelik)
- [ ] **1920–1946:** İl bazındaki vekil ve parti verisini TBMM Albümü (1920–2010) ile karşılaştırmak. Ara seçimle gelenleri tek tek işaretlemek; seçim günündeki sandalye dağılımını ayrı tutmak.
- [ ] **1877–1919:** Vilayet ve sancak bazındaki mebus sayılarını akademik çalışmalarla karşılaştırmak (örn. Hasan Kayalı, *Elections and the Electoral Process in the Ottoman Empire, 1876–1919*, 1995; TBMM Vakfı, *Türk Parlamento Tarihi*).
- [ ] Doğrulanan kayıtlara **"Literatür"** düzeyi eklemek: güvenilirlik rozetinde akademik kaynak ve sayfa numarası gösterilecek.
- [ ] Her kayıtta kaynak bağlantısının yanında, mümkünse sayfa numarası vermek (YSK, Resmî Gazete, DİE yayınları, meclis zabıtları).
- [ ] Tahmini sınır atamalarını (`scripts/build_historical.py` içinde `tr_unit` ve `boundary_note`) dönemin idari bölünüş kaynaklarıyla (Dahiliye salnameleri, Resmî Gazete'deki kanunlar) doğrulamak.
- [ ] Doğrulanan 1950 öncesi veriyi kaynak projeye (hamiKumbasae/turkiye-secim-haritasi) katkı olarak önermek.

## 2. Analiz özellikleri
- [ ] İki seçimi yan yana karşılaştırma görünümü.
- [ ] Parti zaman çizgisi: bir partinin (ve öncül/ardıl partilerin) ülke geneli oy oranı ve kazandığı il sayısı.
- [ ] Partilerin kuruluş, kapanış ve birleşmelerini zaman çizelgesinde göstermek.
- [ ] Seçim sonuçlarını nüfus, kentleşme ve göç gibi demografik göstergelerle karşılaştırmak (TÜİK verisi gerekir).
- [ ] İlçe düzeyi (kaynak veri setinde 1961 sonrası mevcut).

## 3. Arayüz ve erişilebilirlik
- [ ] İngilizce arayüz.
- [ ] Haritanın klavyeyle gezilebilmesi (şimdilik birim tablosu bu işlevi kısmen karşılıyor).

## 4. Uzun vadeli kapsam
Depo adı (`TurkSiyasiTarihi`), seçimlerin ötesinde daha geniş bir siyasi tarih platformuna alan bırakıyor. Olası modüller: parlamentolar ve vekil biyografileri, hükûmetler, anayasa değişiklikleri, siyasi partiler. Bu, bakım yükünü belirgin biçimde artıracağından ancak 1. bölüm tamamlandıktan sonra ele alınmalı.
