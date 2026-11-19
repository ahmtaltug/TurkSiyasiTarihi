# Türkiye Seçim Atlası (1840–2026)

Osmanlı ve Türkiye Cumhuriyeti seçimlerini **döneminin il, sancak ve vilayet sınırlarıyla** gösteren etkileşimli harita.
Sunucu gerektirmeyen statik bir sitedir; GitHub Pages, Netlify ya da Cloudflare Pages üzerinde ücretsiz barındırılabilir.

## Kapsam

| Dönem | Seçimler | Haritada gösterilen |
|---|---|---|
| 1840 | Muhassıllık meclisleri | Açıklama. Derlenmiş seçim sonucu olmadığı için harita yok. |
| 1877–1919 | Meclis-i Mebusan: 1877 (I ve II), 1908, 1912, 1914, 1919 | Vilayet ya da sancak başına mebus sayısı. Kaynakta varsa dinî, etnik ya da siyasi mensubiyet. |
| 1920–1946 | TBMM I.–VIII. dönem seçimleri | İl (liva) başına milletvekili ve parti. 1946 için yaklaşık il oyları. |
| 1930–1946 | Belediye seçimleri | 1930: SCF'nin kazandığı belediyeler ve il merkezleri. 1934–1946: yalnız dönemin sınırları. |
| 1950–2024 | 20 genel, 15 yerel (belediye başkanlığı ve il genel meclisi), 8 Senato, 7 halkoylaması, 4 cumhurbaşkanlığı (2014, 2018, 2023 iki tur) | İl düzeyinde oy, oran, sandalye ve katılım. |
| 2026 | 7 Haziran 2026 mahalli idareler ara seçimi | Seçim yapılan birimlerin il toplamı. |

Toplam 88 kayıt vardır. Canlı site: **https://ahmtaltug.github.io/TurkSiyasiTarihi/**

### Özellikler
- **Harita görünümleri:** birinci parti ya da aday, seçilen partinin oy oranı, katılım, vekil sayısı, grup payı ve **değişim** (aynı türden bir önceki seçime göre il il puan farkı).
- **Zaman atlamalı oynatma:** "Oynat" düğmesi seçili dönem ve türlerdeki seçimleri sırayla gösterir (hız 0,5×–4×; boşluk tuşu). Örneğin yalnız "Genel seçim" açıkken 1877'den 2023'e milletvekili seçimleri art arda oynar.
- **Ayrıntılar:** Bir il ya da vilayete tıklayınca oylar, sandalyeler ve 1950 öncesi için vekil adları açılır. Sıralanabilir birim tablosu da vardır.
- **Paylaşma ve indirme:** Adres çubuğu görünümü saklar (ör. `#e=1946&u=istanbul&m=winner`). "Bağlantıyı kopyala" ve "CSV indir" düğmeleri bulunur.

Sürüm geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına bakın.

## Ücretsiz yayınlama (GitHub Pages)

1. GitHub'da **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
2. `main` dalına her push'ta `.github/workflows/pages.yml` veriyi denetler ve siteyi yayınlar.
   Adres: `https://<kullanıcı-adı>.github.io/<depo-adı>/`

Alternatif yöntem: depo kökündeki `index.html`, `css/`, `js/`, `vendor/` ve `data/` klasörlerini Netlify Drop ya da Cloudflare Pages'e
yükleyin. Derleme adımı gerekmez.

Yerelde denemek için:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Veriyi yeniden üretmek

Yayındaki veri (`data/`) depoda hazır gelir. Baştan üretmek için Python 3, `pip install shapely` ve `npm i -g mapshaper` gerekir:

```bash
scripts/build_all.sh          # kaynakları indirir, data/ klasörünü yeniden yazar, denetler
scripts/build_all.sh --wiki   # Vikipedi metinlerini de yeniden indirir (sonuçlar değişebilir)
```

| Betik | Görevi |
|---|---|
| `scripts/fetch_sources.sh` | Kaynak veri setinin sabit sürümünü (yalnız gerekli klasörler) ve Natural Earth'ü indirir. |
| `scripts/build_modern.py` | 1950–2026 il sonuçlarını ve 1950–1999 il sınırlarını uygulamanın biçimine çevirir. |
| `scripts/build_historical.py` | 1877–1946 vekil listelerini ayrıştırır ve dönemin sınırlarını kurar. Sınırlar, günümüz ilçelerinin o yıldaki bağlılığına ve Natural Earth bölgelerinin birleştirilmesine dayanır. |
| `scripts/build_geo.sh` | Sınırları birleştirir, sadeleştirir ve TopoJSON'a çevirir. |
| `scripts/build_index.py` | Seçim listesini ve parti renklerini üretir. |
| `scripts/validate.py` | Seçim dosyalarının ve sınırların tutarlılığını denetler; CI'da da çalışır. |
| `tests/smoke.js` | Tarayıcı testi: bütün seçimleri ve görünümleri açar (yerelde, Playwright ile). |

### Veri biçimi

`data/index.json` seçimlerin listesidir. `data/elections/<id>.json` dosyalarında şu alanlar bulunur:
`units` (birim kimliği → `name`, `winner`, `votes`, `pct`, `seats`, `turnout`, `members`…), `national`, `notes` ve `sources`.
`data/geo/<geo>.json` TopoJSON biçimindedir ve özellik kimlikleri `units` anahtarlarıyla eşleşir.
Yeni bir seçim eklemek için aynı biçimde bir dosya yazmak ve `scripts/build_index.py`'yi çalıştırmak yeterlidir.

## Yöntem ve sınırlamalar

- **1950 öncesi sınırlar yaklaşıktır.** Türkiye içindeki birimler, günümüz ilçelerinin o yıldaki il ya da sancak bağlılığına göre
  birleştirildi. Bu, kaldırılan illeri (Gelibolu, Ergani, Genç, Siverek, Kozan, Cebelibereket, Şebinkarahisar, Aksaray, Oltu,
  Ardahan), 1933–1936 arasındaki Çoruh ilini ve Hatay'ın 1939'da katılmasını kapsar. Bazı ilçelerin tarihî bağlılığı tahmine
  dayanır; ayrıntılar `scripts/build_historical.py` içindeki `tr_unit` işlevindedir. Türkiye dışındaki vilayetler günümüz idari
  bölgelerinden kurulduğu için kenar hatları tarihî sınırlarla örtüşmez.
- **1950 öncesinde il düzeyinde oy sayısı yoktur.** Seçimler iki dereceliydi. Gösterilen değerler Vikipedi listelerinden sayılan vekil
  sayılarıdır. Listeler dönem boyunca görev yapan herkesi içerir. Açıklamasında "yerine" ya da "ara seçim" geçenler ayrıldı, ama
  bütün ara seçimler bu şekilde işaretli değildir. Bu yüzden toplamlar resmî sandalye sayısından fazla olabilir.
- **1912 ve 1914 listelerindeki parti mensubiyetleri** literatürdeki toplu rakamlarla uyuşmaz; örneğin 1912 için genellikle
  "İttihat ve Terakki 269/275" denir. Osmanlı seçimlerinde harita bu nedenle varsayılan olarak vekil sayısını gösterir.
- **1946 il oyları** Vikipedi'nin seçim mazbatalarından derlediği tablodan alındı. Bazı değerler yaklaşıktır, bazıları bilinmemektedir.
- **1950 sonrası** kaynak veri setinin değerleri kullanıldı. Kaynaktaki yalnız bir değer düzeltildi: 1968 Van il genel meclisi CGP oyu,
  geçerli oy toplamıyla birebir tutan değere çevrildi. Parti toplamı geçerli oyu aşan birkaç kayıt değiştirilmeden işaretlendi.
- Ülke toplamları il verilerinin toplanmasıyla hesaplandığından resmî ilan edilen oranlardan birkaç onda bir puan farklı olabilir.

## Lisans

Kod MIT lisanslıdır. Veri, kaynaklarının lisansı gereği CC BY-SA 4.0'dır; sınır geometrileri ODbL ve CC BY-IGO kaynaklıdır.
Ayrıntılar [LICENSE-DATA.md](LICENSE-DATA.md) dosyasındadır.
