# Veri doğrulama raporu

Son güncelleme: 20 Kasım 2026 (sürüm 3.1.1). Bu rapor, sitedeki tarihî ve siyasi bilgilerin (parti adları, aday adları, il adları, tarihler,
mebus/milletvekili listeleri) neyle, nasıl karşılaştırıldığını ve neyin **karşılaştırılamadığını** listeler.

Kaynak olarak Türkçe ve İngilizce Vikipedi maddeleri kullanıldı. Birincil kaynaklarla (TBMM Albümü, YSK arşivi, Resmî Gazete)
karşılaştırma bu derlemede **yapılamadı**; bu kaynakların sitelerine erişim yoktu (bkz. [ROADMAP.md](../ROADMAP.md)).

## 1. Parti adları (otomatik)

`scripts/party_names.py` her parti kısaltmasına, yılına göre tam ad verir. Örneğin "DP" 1946–1960'ta Demokrat Parti, 1970–1980'de Demokratik Parti'dir.
`scripts/verify_wiki.py`, 1950 sonrası her genel, yerel ve cumhurbaşkanlığı seçiminde haritada görünen partinin tam adını
(cumhurbaşkanlığında aday adını) o seçimin Vikipedi maddesinde arar.

- Sonuç: **323 parti/aday–seçim çiftinin 323'ü** maddede bulundu (ayrıntı: [dogrulama-raporu.md](dogrulama-raporu.md)).
- İlk çalıştırmada bulunamayan 5 çift, kaynak veri setindeki dönemine uymayan parti etiketlerini ortaya çıkardı. Bunlar düzeltildi:

| Seçim | Verideki etiket | Doğrusu | Dayanak |
|---|---|---|---|
| 1968 yerel, 1968 Senato | CGP | GP (Güven Partisi) | CGP Mart 1973'te Millî Güven Partisi ile Cumhuriyetçi Parti'nin birleşmesiyle kuruldu (Vikipedi: Cumhuriyetçi Güven Partisi); 1969 seçim maddesi partiyi "Güven Partisi (GP)" olarak verir. |
| 1969, Sakarya | CGP | GP (Güven Partisi) | Aynı gerekçe |
| 1973, Sakarya | DP | Demokratik Parti | Demokrat Parti 1960'ta kapatılmıştı; 1970–1980'de "DP" Demokratik Parti'dir. |
| 1989 yerel, Çorum | MHP | MÇP | Parti 30 Kasım 1985 – 24 Ocak 1993 arasında Milliyetçi Çalışma Partisi adını taşıyordu (Vikipedi: Milliyetçi Çalışma Partisi). |
| 2004 yerel | SHP (ad listesinde) | Sosyaldemokrat Halk Partisi | 2002'de kurulan parti, 1985–1995'teki Sosyaldemokrat Halkçı Parti'den ayrıdır. Bu hata projenin ad listesindeydi. |

Düzeltmeler derleme sırasında uygulanır (`party_names.KEY_FIXES`) ve ilgili seçimin notlarında açıklanır.

## 2. Ülke geneli sonuçlar

1950–2023 genel seçimlerinde ülke geneli oranlar, Vikipedi bilgi kutularıyla karşılaştırıldı.

- **1961–2015:** Fark 0,5 puanın altında. Örneğin Kasım 2015'te dört büyük partide fark en çok 0,01 puan.
- **1950, 1954, 1957:** 0,7–1,0 puan fark var. Liste usulü çoğunluk sisteminde ülke oranı hesaplama yöntemine göre değişir. Vikipedi'nin değerleri seçim notlarına eklendi.
- **2018, 2023:** Kaynak veri, yalnız ittifaka verilen oyları ayrı tutar; YSK ise bunları ittifak partilerine paylaştırır. 2018'de AK Parti burada %41,8, resmî sonuçta %42,6'dır. Bu durum notlarda açıklandı.
- **Halkoylamaları (1961–2017) ve 2018, 2023 cumhurbaşkanlığı seçimleri:** Resmî oranlarla 0,05 puan içinde örtüşüyor.
- **1999:** Kaynak veri seti CHP'yi (Vikipedi: %8,71, sandalye kazanamadı) "Diğer" içinde toplar. Bu durum notta açıklandı.
- **2014 cumhurbaşkanlığı:** Kaynak veride yurt dışı oyları yok (burada %51,65, resmî %51,79). Bu durum notta açıklandı.

## 3. İl adları

1950 sonrası veride bütün iller günümüz adıyla yazılıydı. Artık seçim tarihindeki resmî ad gösterilir; günümüz adı parantez içinde yer alır.

| İl | Eski ad | Değişiklik | Dayanak |
|---|---|---|---|
| Adana | Seyhan | 1933 → Şubat 1956 | Vikipedi: Adana (il) |
| Artvin | Çoruh | 17 Şubat 1956, 6668 sayılı kanun | Vikipedi: Artvin (il) |
| Mersin | İçel | 28 Haziran 2002 | Vikipedi: Mersin Province |
| Kahramanmaraş | Maraş | 1973 (gün kaynakta yok) | Vikipedi: Kahramanmaraş |
| Şanlıurfa | Urfa | 22 Haziran 1984, 3020 sayılı kanun | Vikipedi: Şanlıurfa (il) |
| Afyonkarahisar | Afyon | 2004 (gün kaynakta yok) | Vikipedi: Afyonkarahisar |

1950 öncesi seçimlerde birim adları dönemin vekil listelerinden alınır; örneğin "Karesi (Balıkesir)", "Bayazıt (Ağrı)", "Seyhan (Adana)".

## 4. Açıklama metinleri

Sitedeki açıklama metinlerinin tarih ve olgu iddiaları ilgili Vikipedi maddeleriyle karşılaştırıldı. Düzeltilenler:

- **1931:** "30 bağımsız seçildi" ifadesi yanlıştı. Bağımsızlara ayrılan 30 sandalyenin 20'si doldu, 10'u boş kaldı (sürüm 1.1.0).
- **1935, 1939, 1943:** Dönem listeleri herkesi CHP'li gösteriyor. Oysa seçim maddelerinin bilgi kutuları CHP'ye 444'ten 401, 470'ten 466 ve 492'den 488 sandalye verir. İl düzeyindeki "hepsi CHP" etiketi kaldırıldı (1.1.0).
- **Hatay (1939):** Hatay Devleti Meclisi 29 Haziran 1939'da Türkiye'ye katılma kararı aldı; Hatay ili 7 Temmuz 1939 tarihli kanunla kuruldu.
- **Cumhuriyet Senatosu:** Üyelerinin üçte biri iki yılda bir yenilenirdi ve Senato 12 Eylül 1980'de feshedildi.
- **1930 Belediyeler Kanunu:** Kanun 4 Nisan 1930'da yürürlüğe girdi. Metin "4 Nisan 1930 tarihli" diyordu; düzeltildi.
- **İl sayıları:** "1991'de 73 il" yazıyordu; veride ve kaynakta 74.

Değişmeden doğrulananlar:

- **Halkoylaması konuları:** 1987 siyasi yasaklar, 1988 yerel seçimlerin öne alınması, 2007, 2010 ve 2017 anayasa değişiklikleri.
- **1946 seçim usulü:** Tek dereceli; açık oy, gizli sayım.
- **1923:** 72 seçim çevresi, 286 milletvekili.
- **1877 Meclis-i Mebusan:** I. dönem 115 (69 Müslüman, 46 gayrimüslim), II. dönem 96 (56 Müslüman, 40 gayrimüslim) mebus.
- **1927 seçim tarihleri:** İkinci seçmenler 20 Temmuz'da, milletvekilleri 1 Eylül 1927'de seçildi.

## 5. 1877–1946 mebus/milletvekili listeleri

Kişi adları tek tek birincil kaynakla karşılaştırılamadı. Ayrıştırma hatalarına karşı otomatik tarama yapıldı:

- **Ayrıştırıcı hatası (düzeltildi):** Vikipedi tablolarındaki hücresiz satırlar, birleştirilmiş hücrelerin kaymasına yol açıyordu. 1912'de Yozgat mebusu Ahmet Münir Bey listeden düşüyordu; Aydın'daki üç mebusun parti ve kimlik bilgileri yanlış satıra kayıyordu. Ayrıştırıcı MediaWiki'nin davranışına göre düzeltildi; diğer listelerde değişiklik olmadı.
- **Kaynakta art arda yinelenen adlar:** 1912 Trablusşam'da "Fuat Hulusi Bey" ve 1920 Saruhan'da "Çerkes Reşit" iki kez yazılmıştı. Aynı kişi olarak bir kez sayıldılar ve birim kartında not düşüldü.
- **Biçim taraması:** Ad sütununda dosya adı, şablon ya da başlık metni kalmadığı denetlendi.

## 6. Siyasi tarih ve demografi verisi (2.0.0)

`scripts/build_history.py` şu maddeleri ayrıştırır: "Türkiye hükûmetleri listesi", "Türkiye cumhurbaşkanları listesi", 61 parti/ittifak maddesinin bilgi kutusu, "Türkiye'nin illeri nüfuslarına göre" ve il bazında GSYH ile yaşam beklentisi tabloları (İngilizce Vikipedi). Yapılan denetimler ve düzeltmeler:

- **Hükûmetler:** 73 kayıt. Her birinin başlangıcı bir öncekinin bitişiyle karşılaştırıldı: 63 geçiş kesintisiz, 10 geçişte 1 günle 24 gün arasında boşluk var (ör. 20 Kasım 1961, 21 Eylül 1980, 25 Haziran 1993 öncesi). Bunlar yeni hükûmetin kurulmasını bekleyen dönemlerdir ve kaynakta olduğu gibi bırakıldı. Güvenoyu alamayan üç hükûmet (38. Irmak, 40. Ecevit, 51. Çiller) kaynaktaki "Güvensizlik oyu" ibaresinden işaretlendi. Kaynakta 1. İcra Vekilleri Heyeti başkanının adı "Mustafa Kemal A" diye kısaltılmıştı; düzeltildi.
- **Cumhurbaşkanlığı boşlukları:** 27 Mayıs 1960 – 26 Ekim 1961 ve 12 Eylül 1980 – 9 Kasım 1982 askerî yönetim (Millî Birlik Komitesi ve Millî Güvenlik Konseyi başkanları), 6 Nisan – 12 Eylül 1980 vekâleten görev olarak ayrıldı.
- **Meclis dağılımları:** 1923–1946 değerleri seçim maddelerinin bilgi kutularından elle girildi (1931'de 10 boş sandalye, 1935–1943'te partisi belirtilmeyen sandalyeler ayrı). 1950 sonrası sitenin seçim verisindendir.
- **Partiler:** Kuruluş/kapanış tarihleri bilgi kutusundan alındı. Birden çok dönemi olan partilerde (CHP 1923–1981 ve 1992–; MHP 1969–1981 ve 1993–; Hürriyet ve İtilaf 1911–1913 ve 1918–1919) dönemler madde metnine göre elle girildi. Yönlendirme nedeniyle iki kez gelen Yeşil Sol Parti/DEM Parti kaydı teke indirildi. Öncül, ardıl, bölünme ve birleşme ilişkileri bilgi kutusundaki bağlantılardır; madde yazarlarının seçimine bağlıdır.
- **Demografi:** 81 ilin tamamında nüfus (1927–2025), alan, GSYH ve yaşam beklentisi bulundu. İngilizce tabloda "Istanbul" yazımı eşlemede ayrıca ele alındı.

- **Osmanlı dönemi (2.3.0–3.0.0):** Sadrazamlar Vikipedi "Osmanlı sadrazamları listesi"nden alındı. Listenin ayrıntılı tablosu 31 Mart Vakası'nı Rumi tarihle (31 Mart 1325) yazar; Miladi 13 Nisan 1909'a çevrildi. Padişahların saltanat tarihleri, Meclis'in kapalı olduğu dönemler (14 Şubat 1878 – 17 Aralık 1908, 5 Ağustos 1912 – 14 Mayıs 1914, 21 Aralık 1918 – 12 Ocak 1920, 18 Mart – 23 Nisan 1920) ve kurumsal olay tarihleri elle girildi; birincil kaynakla karşılaştırılmadı.
- **I. TBMM grupları:** İkinci Grubun 63 milletvekiliyle kurulduğu İngilizce Vikipedi "Second Group (Turkey)" maddesinden alındı. Birinci Grubun üye sayısı incelenen maddelerde yok; dağılımda grupsuzlarla birlikte gösterilir. 1920 seçim maddesine göre I. dönemde 349 seçilmiş ve İstanbul'dan gelen 88 vekil vardı (437); 34'ü istifa etti. Dönem listesinde 434 ad sayıldı.
- **Dönem içi değişiklikler (1923–1930):** Terakkiperver Cumhuriyet Fırkası'na katılan milletvekili sayısı Vikipedi maddesine göre Tunçay'da 29, Tunaya'da 28'dir; 29 kullanıldı. Serbest Cumhuriyet Fırkası'nın 15 milletvekili vardı (Vikipedi). Kapanışlardan sonra bu milletvekilleri partisiz gösterildi; yeniden CHF'ye katılanlar ayrıca izlenmedi.
- **Vekâleten cumhurbaşkanlığı:** Vekil adları Anayasa'nın öngördüğü Meclis/Senato başkanlarıdır ve elle girildi.

Doğrulanamayanlar: Hükûmet tarihleri ve güvenoyu sayıları TBMM tutanaklarıyla; nüfuslar TÜİK yayınlarıyla birebir karşılaştırılmadı.

## 7. İlçe düzeyi sonuçlar (3.3.0)

İlçe sonuçları ve tarihî ilçe şekilleri Türkiye Seçim Haritası veri setinden alındı; birincil kaynakla karşılaştırılmadı. Yapılanlar:
- Seçim satırlarındaki her geometri kimliği bugünkü ilçe sınırlarına, bölünme öncesi tarihî şekillere ya da veri setinin birleştirme planına (sonradan kurulan ilçenin ayrıldığı ilçeyle birleşimi) eşlendi; 34.927 satırdan 14'ünün geometrisi yok (ör. 1961–1983 Ankara "Merkez"), bunlar haritada boş kalır ve panelde adıyla belirtilir.
- İlçenin bağlı olduğu il, veri setinin seçim tarihli idari anlık görüntüsünden alındı; il adı o seçimin il düzeyi verisindeki adıdır.
- İl düzeyinde uygulanan parti anahtarı düzeltmeleri (CGP → GP 1967–1972, DP → Demokratik Parti 1970–1980, MHP → MÇP 1986–1992) ilçe satırlarına da uygulandı.

## Doğrulanamayanlar

- **1877–1946 vekil sayıları ve kişi adları:** TBMM Albümü ile karşılaştırma gerekir. Bu oturumda TBMM sitesine ağ erişimi verilmedi.
- **1908–1914 etnik ve siyasi mensubiyetler:** Vikipedi listesindeki sınıflandırmadır ve tartışmalıdır. Sitede bu yönde uyarı var.
- **1950 öncesi tahmini sınırlar:** Haritada taramayla işaretlidir; ayrıntı [ROADMAP.md](../ROADMAP.md) dosyasında.
- **1950 sonrası il sonuçları:** Kaynak veri setinin değerleridir. Yalnız ülke toplamları ve parti etiketleri denetlendi; il il resmî yayınla karşılaştırma yapılmadı.
