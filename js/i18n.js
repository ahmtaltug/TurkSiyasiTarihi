/* Türkiye Seçim Atlası — arayüz dili (Türkçe / English).
   Uygulama metni Türkçe yazılır; İngilizce seçiliyse sayfadaki metinler bu sözlük ve kalıplarla çevrilir.
   Özel adlar (il, ilçe, parti, kişi) ve kaynaklardan gelen açıklama metinleri çevrilmez. */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search).get('lang');
  let lang = q || localStorage.getItem('lang') || ((navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en');
  if (lang !== 'en') lang = 'tr';
  if (q) localStorage.setItem('lang', lang);

  const MONTH = { Ocak: 'January', Şubat: 'February', Mart: 'March', Nisan: 'April', Mayıs: 'May', Haziran: 'June', Temmuz: 'July', Ağustos: 'August', Eylül: 'September', Ekim: 'October', Kasım: 'November', Aralık: 'December' };
  const MRE = Object.keys(MONTH).join('|');
  const ord = (n) => { n = +n; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const date = (s) => s.replace(new RegExp(`(\\d{1,2}) (${MRE}) (\\d{4})`, 'g'), (_, d, m, y) => `${MONTH[m]} ${d}, ${y}`)
    .replace(new RegExp(`\\b(${MRE}) (\\d{4})`, 'g'), (_, m, y) => `${MONTH[m]} ${y}`)
    .replace(new RegExp(`(\\d{1,2}(?:–\\d{1,2})?) (${MRE})\\b`, 'g'), (_, d, m) => `${MONTH[m]} ${d}`)
    .replace(new RegExp(`\\b(${MRE})\\b`, 'g'), (_, m) => MONTH[m])
    .replace(/Meclis (.+?)'(?:de|da|te|ta) (İstanbul'da )?(açıldı|toplandı)/, (_, d, ist, v) => `parliament ${v === 'açıldı' ? 'opened' : 'convened'} ${ist ? 'in Istanbul ' : ''}${/\d,/.test(d) ? 'on' : 'in'} ${d}`)
    .replace(/(\d{4})–(\d{4}) kışı/, 'winter $1–$2').replace(/(\d{4}) sonu/, 'late $1').replace(' tarihli nizamname', ' regulation')
    .replace('(ikinci seçmenler)', '(second-stage electors)').replace('(milletvekilleri)', '(deputies)').replace('(iki dereceli)', '(two-stage)')
    .replace(/\) ve /g, ') and ').replace('günümüz', 'present').replace('görevde', 'in office');

  // ---------------------------------------------------------------- tam eşleşmeler
  const EN = {
    'Türkiye Seçim Atlası': 'Turkey Election Atlas',
    'Türkiye Seçim Atlası · 1840–2026': 'Turkey Election Atlas · 1840–2026',
    '1840–2026 · Osmanlı ve Cumhuriyet seçimleri': '1840–2026 · Ottoman and Republican elections',
    'Harita': 'Map', 'Siyasi tarih': 'Political history', 'Kaynaklar ve yöntem': 'Sources and method', 'Hakkında': 'About',
    'Tümü': 'All', 'Osmanlı': 'Ottoman', 'Cumhuriyet': 'Republic',
    'Genel seçim': 'General election', 'Yerel seçim': 'Local election', 'Cumhurbaşkanlığı': 'Presidential', 'Halkoylaması': 'Referendum',
    'Senato': 'Senate', 'Güncel durum': 'Current state', 'Ara seçim': 'By-election',
    '▶ Oynat': '▶ Play', '❚❚ Durdur': '❚❚ Pause', 'Hız': 'Speed', 'Haritasız kayıtları atla': 'Skip records without a map',
    'Karşılaştır': 'Compare', 'Bağlantıyı kopyala': 'Copy link', 'Paylaş': 'Share', 'CSV indir': 'Download CSV', 'Kopyalandı ✓': 'Copied ✓',
    'Paneli gizle': 'Hide panel', 'Paneli göster': 'Show panel', 'Yükleniyor…': 'Loading…', 'Tarih': 'History',
    'Sınırlar: © OpenStreetMap katkıcıları, OCHA/HDX, Natural Earth · Sonuçlar: YSK/TÜİK, Vikipedi (CC BY-SA 4.0)': 'Boundaries: © OpenStreetMap contributors, OCHA/HDX, Natural Earth · Results: YSK/TÜİK, Wikipedia (CC BY-SA 4.0)',
    'Birinci parti': 'Leading party', 'Ton koyulaştıkça oy oranı artar': 'Darker shade = higher vote share', 'Veri yok / seçim yapılmadı': 'No data / no election held',
    'Osmanlı dönemi': 'Ottoman era', 'Cumhuriyet dönemi': 'Republican era', 'Siyasi tarihte göster': 'Show in political history',
    'Ülke geneli oy': 'National vote', 'Ülke geneli': 'National', 'Ülke geneli (aday)': 'National (candidates)',
    'Bir partiye tıklayınca haritada oy oranı ve aşağıda geçmişi gösterilir.': 'Click a party to map its vote share and see its history below.',
    'Meclis dağılımı': 'Seats in parliament', 'Kayıtlı seçmen': 'Registered voters', 'Geçerli oy': 'Valid votes', 'Geçerli oy / seçmen': 'Valid votes / voters',
    'Toplam sandalye': 'Total seats', 'İl': 'Province', 'İlçe': 'District', 'Birim': 'Unit', 'Harita görünümü': 'Map view',
    'Parti oy oranı': 'Party vote share', 'Katılım': 'Turnout', 'Değişim': 'Swing', 'Sonuç': 'Result', 'Önde olan aday': 'Leading candidate',
    'Seçenek oranı': 'Option share', 'Aday oy oranı': 'Candidate vote share', 'Grup payı': 'Group share', 'Vekil sayısı': 'Number of deputies',
    'SCF belediye sayısı': 'SCF municipalities', 'İl merkezi': 'Provincial centre', 'Çoğunluk': 'Majority', 'Çoğunluk (vekil)': 'Majority (deputies)',
    'Yoğunluk': 'Density', 'Yaşam beklentisi': 'Life expectancy', 'Kişi başı GSYH (2024)': 'GDP per capita (2024)', 'Oy oranı': 'Vote share', 'Oylar': 'Votes',
    'Bu ilin seçim geçmişi (aynı tür, 1950 sonrası)': 'Election history of this province (same type, since 1950)',
    'Demografik karşılaştırma (nüfus, yoğunluk, nüfus artışı, gelir, yaşam beklentisi)': 'Demographic comparison (population, density, growth, income, life expectancy)',
    'Bu kayıtta hata mı var? Bildirin': 'Spotted an error in this record? Report it', 'Hata bildir': 'Report error',
    'Meclis ve hükûmetler': 'Parliament and governments', 'Hükûmetler ve güvenoyu': 'Governments and confidence votes', 'Partiler': 'Parties', 'Olaylar ve animasyon': 'Events and animation',
    'Notlar': 'Notes', 'Kaynak': 'Source', 'Birim tablosu': 'Unit table', 'Birinci': 'Leading', 'Önde': 'Leading', 'Parti': 'Party', 'Yıl': 'Year',
    'Vekil': 'Deputies', 'Oran': 'Share', 'Belediye başkanı': 'Mayor', 'Resmî sandalye': 'Official seats', 'Seçim bölgeleri': 'Constituencies',
    'Listedeki vekil': 'Deputies listed', 'Sonradan katılan hariç': 'Excluding later entrants', 'Dağılım': 'Distribution', 'Bilinmiyor': 'Unknown',
    'Dönemin sınırları': 'Boundaries of the period', 'İl düzeyinde sonuç verisi yok': 'No province-level results', 'Yaklaşık sınırlar': 'Approximate boundaries',
    'Belediye başkanının bugünkü partisi': "Mayor's current party", 'İl merkezi belediyesi': 'Provincial-centre municipality',
    'Birinci parti (oy; bilinmiyorsa vekil)': 'Leading party (votes; deputies if unknown)', 'Ayrıntı için haritada bir il ya da vilayete tıklayın.': 'Click a province on the map for details.',
    'Ayrıntı için haritada bir ilçeye tıklayın.': 'Click a district on the map for details.', 'Bu il için başka kayıt yok.': 'No other records for this province.',
    'Bütün partiler zaman çizelgesinde': 'All parties on the timeline', 'Parti tarihçesi: kuruluş, kapanış, ad değişikliği, öncül ve ardıllar': 'Party history: founding, dissolution, renaming, predecessors and successors',
    'Faaliyet dönemi': 'Active period', 'Ad değişiklikleri': 'Renamings', 'TBMM sandalyesi': 'Seats in parliament', 'Öncülleri (selef):': 'Predecessors:', 'Ardılları (halef):': 'Successors:',
    'Ayrılanların kurduğu partiler:': 'Splinter parties:', 'Birleşmeler / katılımlar:': 'Mergers:', 'İttifaklar:': 'Alliances:', 'Kuruluş – sona eriş': 'Founded – ended',
    'günümüz': 'present', 'görevde': 'in office', 'Cumhurbaşkanı': 'President', 'Padişah': 'Sultan', 'Sadrazam': 'Grand vizier', 'Hükûmet': 'Government',
    'Meclis': 'Parliament', 'Başbakan': 'Prime minister', 'Devlet başkanı': 'Head of state', 'Sadrazam / Başbakan': 'Grand vizier / PM', 'Hükûmet partileri': 'Government parties',
    '(sandalye %)': '(seat share)', 'TBMM Başkanı': 'Speaker of the Grand National Assembly', 'Bugünkü TBMM': 'Parliament today', 'haritada aç': 'open on map',
    'Karşılaştırma': 'Comparison', 'Sağ harita:': 'Right map:', 'İki harita aynı renk ölçeğini kullanır.': 'Both maps use the same colour scale.',
    'Eşleşen birim': 'Matched units', 'Birinci partisi/sonucu değişen': 'Units where the leader changed', 'En çok artan': 'Largest gains', 'En çok azalan': 'Largest losses',
    'Nüfus': 'Population', 'Yoğunluk (kişi/km²)': 'Density (people/km²)', 'Yıllık nüfus artışı (%)': 'Annual population growth (%)', 'Kişi başı GSYH (ABD $, 2024)': 'GDP per capita (US$, 2024)',
    'Yaşam beklentisi (yıl)': 'Life expectancy (years)', 'Bu seçim için karşılaştırılabilir değer yok.': 'No comparable values for this election.', 'Yeterli il yok.': 'Not enough provinces.',
    'TBMM — bugünkü sandalye dağılımı': 'Grand National Assembly — seats today', '2023 seçimi': '2023 election', 'Bugün': 'Today', 'Fark': 'Change',
    'İl belediye başkanlıkları (büyükşehir ya da il merkezi)': 'Provincial mayors (metropolitan or provincial centre)', 'Son değişiklikler': 'Recent changes',
    'Değişiklik günlüğü, otomatik güncelleme bir değişiklik bulduğunda dolmaya başlar.': 'The change log fills up once the daily update detects a change.',
    'Fareyi grafiğin üzerinde gezdirin ya da tıklayın: o tarihteki meclis, hükûmet ve cumhurbaşkanı aşağıda yazar. Klavyede ← → bir ay, Shift ile bir yıl ilerler.': 'Hover or click on the chart to see the parliament, government and head of state at that date. Keys: ← → one month, with Shift one year.',
    'Yalnız koalisyonlar': 'Coalitions only', 'Başkan': 'Head', 'Başlangıç': 'Start', 'Bitiş': 'End', 'Gün': 'Days', 'Güvenoyu': 'Confidence vote', 'Bir partiye tıklayın.': 'Click a party.',
    'Olaylar': 'Events', 'Kuruluş': 'Founding', 'Kapanış': 'Dissolution', 'Ad değişikliği': 'Renaming', 'İttifak': 'Alliance', 'Askerî müdahale': 'Military intervention',
    'Sistem': 'System', 'Siyasi olay': 'Political event', 'Bugünkü TBMM dağılımı.': 'Seats in parliament today.', 'Bu tarihte seçilmiş meclis bileşimi yok.': 'No elected parliament at this date.',
    'Bu tarihe kadar seçili türde olay yok.': 'No events of the selected types up to this date.', 'Hükûmetler': 'Governments', 'Tema: Sistem': 'Theme: System', 'Tema: Açık': 'Theme: Light', 'Tema: Koyu': 'Theme: Dark',
    'tek parti': 'single party', 'koalisyon': 'coalition', 'askerî': 'military', 'geçici': 'caretaker', 'meclis hükûmeti': 'assembly government',
    'Bağımsız': 'Independent', 'Bağımsızlar': 'Independents', 'Boş': 'Vacant', 'Diğer': 'Other', 'Evet': 'Yes', 'Hayır': 'No', 'Kayyım': 'Trustee (appointed)',
    'Belirtilmemiş': 'Not specified', 'Grup dağılımı derlenmedi': 'Group breakdown not compiled', 'Grupsuz (henüz grup yok)': 'No groups yet', 'Birinci Grup ve grupsuzlar': 'First Group and unaffiliated',
    'İkinci Grup': 'Second Group', 'Askerî Hükûmet': 'Military government', 'Geçici Hükûmet': 'Caretaker government', 'Meclis kapalı': 'Parliament closed',
    'Çok partili dönem': 'Multi-party era', 'I. Meşrutiyet': 'First Constitutional Era', 'II. Meşrutiyet': 'Second Constitutional Era', 'Bâbıâli Baskını': '1913 coup (Raid on the Sublime Porte)',
    'Cumhurbaşkanlığı hükûmet sistemi': 'Presidential system', 'TBMM': 'Grand National Assembly', '27 Mayıs': '27 May (1960 coup)', '12 Mart': '12 March (1971 memorandum)', '12 Eylül': '12 September (1980 coup)', '28 Şubat': '28 February (1997)', '15 Temmuz': '15 July (2016 coup attempt)',
    'Muhassıllık meclisleri': 'Muhassıl councils', 'Vilayet ara…': 'Search province (vilayet)…', 'Sancak / vilayet ara…': 'Search sanjak / province…', 'İlçe ara…': 'Search district…', 'İl ara…': 'Search province…',
    'Seçim tarihinde —': 'On election day —', 'Bugün —': 'Today —', 'Faal partiler': 'Active parties', 'dönem içi değişiklik': 'change during the term', 'Gösterge': 'Indicator',

    'Ana bölümler': 'Main sections', 'Seçim seçimi': 'Election picker', 'Dönem': 'Era', 'Seçim türü': 'Election type', 'Önceki seçim': 'Previous election', 'Seçim': 'Election',
    'Sonraki seçim': 'Next election', 'Zaman atlamalı oynatma': 'Time-lapse playback', 'Seçili dönem ve türlerdeki seçimleri sırayla oynat (boşluk tuşu)': 'Play the elections of the selected era and types in sequence (space bar)',
    'Oynatma hızı': 'Playback speed', 'İki seçimi yan yana haritada karşılaştır': 'Compare two elections side by side', 'Bu görünümün bağlantısını kopyala': 'Copy the link to this view',
    'Bu seçimin il verisini CSV olarak indir': "Download this election's data as CSV", 'Zaman çizelgesi': 'Timeline', 'Haritada il, sancak ya da vilayet ara (kısayol: /)': 'Search a province or district on the map (shortcut: /)',
    'Harita birimi': 'Map unit', 'Harita modu': 'Map mode', 'Siyasi tarih görünümleri': 'Political history views', 'Siyasi tarih verisindeki bir hatayı bildir': 'Report an error in the political history data',
    'Bu sitedeki derlenmiş veri, kaynaklarının lisansı gereği CC BY-SA 4.0 ile paylaşılır.': 'Compiled data on this site is shared under CC BY-SA 4.0, as required by its sources.', 'Kaynak kod': 'Source code',
    'Karşılaştırılan seçimin haritası': 'Map of the compared election', 'Karşılaştırılacak seçim': 'Election to compare', 'Başbakan ya da parti ara…': 'Search prime minister or party…',
    'Hükûmetlerde ara': 'Search governments', 'Partilerin kuruluş ve kapanış zaman çizelgesi': 'Timeline of party foundings and dissolutions', 'Parti ara…': 'Search party…', 'Partilerde ara': 'Search parties',
    'Kapat': 'Close', 'Tarih': 'Date', 'Language / Dil': 'Language / Dil', 'değiştirmek için tıklayın': 'click to change', 'Bu kayıt için harita verisi yok.': 'No map for this record.',
    'Ayrıntılar sağdaki panelde.': 'Details are in the panel.', 'Bu seçimde kazanılan sandalyeler': 'Seats won in this election', 'Kayıtlı seçmen sayısı': 'Registered voters',
    '1. tur': 'round 1', '2. tur': 'round 2', '1961 Anayasası': '1961 Constitution', '1982 Anayasası': '1982 Constitution', 'Anayasa değişikliği paketi': 'Constitutional amendment package',
    'Belediye başkanlığı (yalnız seçim yapılan birimler)': 'Mayors (only units that held elections)', 'Cumhurbaşkanlığı hükûmet sistemine geçiş (anayasa değişikliği)': 'Switch to the presidential system (constitutional amendment)',
    'Cumhurbaşkanının halk tarafından seçilmesi dahil anayasa değişikliği': 'Constitutional amendment incl. popular election of the president', 'Siyasi yasakların kaldırılması (Anayasa 4. geçici madde)': 'Lifting of political bans (provisional article 4)',
    'Yerel seçimlerin bir yıl öne alınması': 'Bringing local elections forward by one year', 'İl genel meclisi oyları': 'Provincial council votes', 'İl merkezi / büyükşehir belediye başkanlığı': 'Provincial centre / metropolitan mayors',
    'Birincil kaynak: Türkçe Wikipedia (il-başına alt makaleler); resmî yayınla tam karşılaştırılmadı.': 'Primary source: Turkish Wikipedia (per-province articles); not fully checked against official publications.',
    'Birincil kaynak: YSK (kaynak veri seti üzerinden).': 'Primary source: Supreme Election Council (via the open dataset).',
    'Bu kayıt için il düzeyinde derlenmiş sonuç verisi yok; yalnız açıklama ve dönemin sınırları gösterilir.': 'No compiled province-level results; only a description and the boundaries of the period.',
    'Senato sonuçları Vikipedi il maddelerinden ve TÜİK ilçe tablolarından derlendi (kaynak veri seti).': 'Senate results compiled from Wikipedia province articles and TurkStat district tables (open dataset).',
    'Vekil sayıları ve mensubiyetler Vikipedi dönem listelerinden sayıldı; birincil kaynakla (meclis albümleri, zabıtlar) karşılaştırılmadı.': 'Deputies and affiliations counted from Wikipedia lists of the term; not checked against primary sources.',
    'Vikipedi maddelerinden günlük otomatik derlenir; resmî kaynakla karşılaştırılmaz.': 'Compiled daily from Wikipedia articles; not checked against official sources.',
    'YSK açık verisi (kaynak veri seti üzerinden).': 'Supreme Election Council open data (via the open dataset).', "Yalnız SCF'nin kazandığı belediyelerin listesi biliniyor (Vikipedi); oy sayısı yok.": 'Only the list of municipalities won by the SCF is known (Wikipedia); no vote counts.',
    'İl genel meclisi oyları DİE/TÜİK yayınları ve YSK verisinden (kaynak veri seti üzerinden).': 'Provincial council votes from DİE/TurkStat publications and YSK data (via the open dataset).',
    'İl oyları Vikipedi\'nin seçim mazbatalarından derlediği tablodan; bir kısmı yaklaşık ("+/-"), bazı partilerin oyu bilinmiyor. Resmî il sonuçları yayımlanmadı.': 'Provincial votes from a Wikipedia table compiled from election certificates; some approximate, some unknown. No official provincial results were published.',
    '12 Eylül 1980 askerî darbesinden sonra devlet başkanlığı.': 'Head of state after the coup of September 12, 1980.', '1982 referandumu ile cumhurbaşkanı oldu.': 'Became president with the 1982 referendum.',
    '27 Mayıs 1960 askerî darbesinden sonra devlet başkanlığı.': 'Head of state after the coup of May 27, 1960.', '27 Mayıs Darbesi sonunda görevden alındı.': 'Removed from office by the coup of May 27, 1960.',
    'Görevdeyken öldü.': 'Died in office.', 'Kaynak tabloda seçilmiş cumhurbaşkanı yok; görev vekâleten yürütüldü.': 'No elected president; the office was held in an acting capacity.', 'TBMM tarafından görevden alındı.': 'Removed by the Grand National Assembly.',
    'Dönem listesinden sayılan vekiller; gruplama kaynağın sınıflandırmasıdır.': 'Deputies counted from the list of the term; grouping follows the source.',
    'siyasi mensubiyet': 'political affiliation', 'dinî mensubiyet': 'religious affiliation', 'etnik mensubiyet (vikipedi listesine göre)': 'ethnic affiliation (per Wikipedia list)',
    'Dinî mensubiyet': 'Religious affiliation', 'Siyasi mensubiyet': 'Political affiliation', 'Etnik mensubiyet (Vikipedi listesine göre)': 'Ethnic affiliation (per Wikipedia list)',
    'Müslüman': 'Muslim', 'Gayrimüslim': 'Non-Muslim', 'Türk': 'Turkish', 'Arap': 'Arab', 'Arnavut': 'Albanian', 'Rum': 'Greek', 'Ermeni': 'Armenian', 'Bulgar': 'Bulgarian', 'Yahudi': 'Jewish', 'Sırp': 'Serbian', 'Ulah': 'Vlach', 'Gürcü': 'Georgian', 'Kürt': 'Kurdish', 'Asuri': 'Assyrian', 'Süryani': 'Syriac', 'Slav': 'Slavic',
    'Evet / Hayır': 'Yes / No', 'Sınır notu:': 'Boundary note:', 'Vekiller': 'Deputies', 'sonradan': 'later', '(sonradan)': '(later)', 'Saltanat kaldırıldı': 'Sultanate abolished', 'Cumhuriyet ilan edildi': 'Republic proclaimed',
    'Halifelik kaldırıldı': 'Caliphate abolished', 'II. Meşrutiyet ilan edildi': 'Second Constitutional Era proclaimed', '31 Mart Vakası': '31 March Incident', 'Mondros Mütarekesi imzalandı': 'Armistice of Mudros signed',
    'Teşkilât-ı Esasiye Kanunu kabul edildi': 'Constitution of 1921 adopted', 'Büyük Millet Meclisi Ankara\'da açıldı': 'Grand National Assembly opened in Ankara', 'Kanun-i Esasi ilan edildi (I. Meşrutiyet)': 'Ottoman constitution proclaimed (First Constitutional Era)',
    'Kadınlara milletvekili seçme ve seçilme hakkı tanındı': 'Women granted the right to vote and stand in general elections', '1924 Anayasası (Teşkilât-ı Esasiye) kabul edildi': '1924 Constitution adopted',
    '1961 Anayasası halkoylamasıyla kabul edildi': '1961 Constitution approved in a referendum', '1982 Anayasası halkoylamasıyla kabul edildi': '1982 Constitution approved in a referendum',
    'Cumhurbaşkanlığı hükûmet sistemi halkoylamasıyla kabul edildi': 'Presidential system approved in a referendum', 'Cumhurbaşkanının halk tarafından seçilmesi halkoylamasıyla kabul edildi': 'Popular election of the president approved in a referendum',
    'Cumhurbaşkanlığı hükûmet sistemi yürürlüğe girdi; başbakanlık kaldırıldı': 'Presidential system took effect; office of prime minister abolished', '15 Temmuz 2016 darbe girişimi (başarısız oldu)': 'Coup attempt of July 15, 2016 (failed)',
    'Misak-ı Millî Meclis-i Mebusan\'da kabul edildi': 'National Pact adopted by the Ottoman Chamber of Deputies', "İstanbul İtilaf Devletlerince resmen işgal edildi": 'Istanbul formally occupied by the Allies',
    'Meclis-i Mebusan yeniden açıldı': 'Ottoman Chamber of Deputies reopened', "Son Meclis-i Mebusan İstanbul'da açıldı": 'Last Ottoman Chamber of Deputies opened in Istanbul',
    "TBMM'de Müdâfaa-i Hukuk (Birinci) Grubu kuruldu": 'Defence of Rights (First) Group formed in parliament', 'Muhalif İkinci Grup kuruldu (63 milletvekili)': 'Opposition Second Group formed (63 deputies)',
    'Meclis-i Umumi (Meclis-i Mebusan ve Âyan) ilk kez toplandı': 'Ottoman General Assembly convened for the first time', "II. Abdülhamid Meclis-i Mebusan'ı süresiz tatil etti": 'Abdülhamid II prorogued the Chamber indefinitely',
    "VI. Mehmed Meclis-i Mebusan'ı feshetti": 'Mehmed VI dissolved the Chamber of Deputies',
    'Devlet Başkanı ve Başbakan': 'Head of State and PM', 'Seçildiği parti': 'Party elected for', 'Seçildiği liste': 'List elected on',
    'Dönem içinde geçtiği parti': 'Party joined during the term', 'Dini mensubiyet': 'Religious affiliation', 'Etnik mensubiyet': 'Ethnic affiliation',
    '1980 öncesi siyasetçilere getirilen siyasi yasaklar halkoylamasıyla kaldırıldı': 'Political bans on pre-1980 politicians lifted in a referendum',
    'Yargı yapısını değiştiren ve bireysel başvuru hakkı getiren anayasa değişikliği halkoylamasıyla kabul edildi': 'Constitutional amendments reshaping the judiciary and introducing individual application approved in a referendum',
    'Değişen birimler': 'Units that changed', "27 Mayıs 1960 askerî darbesi (Bayar'ın görevi sona erdi; Millî Birlik Komitesi yönetimi)": 'Military coup of May 27, 1960 (President Bayar removed; rule of the National Unity Committee)',
    "28 Şubat 1997 Millî Güvenlik Kurulu kararları (Haziran 1997'de 54. hükûmet istifa etti)": 'National Security Council decisions of February 28, 1997 (the 54th government resigned in June 1997)',
    '12 Eylül 1980 askerî darbesi (43. hükûmet ve Cumhuriyet Senatosu sona erdi; Millî Güvenlik Konseyi yönetimi)': 'Military coup of September 12, 1980 (43rd government and the Senate ended; rule of the National Security Council)',
    '12 Mart 1971 muhtırası (Demirel hükûmeti istifa etti)': 'Military memorandum of March 12, 1971 (the Demirel government resigned)',
    'Ankara Bölge Adliye Mahkemesi\'nin CHP 38. Olağan Kurultayı hakkındaki "mutlak butlan" kararıyla Özgür Özel\'in CHP genel başkanlığı sona erdi': 'Özgür Özel\'s CHP chairmanship ended after the Ankara Regional Court ruled the party\'s 38th congress "null and void"',
    'Millî Güvenlik Konseyi bütün siyasi partileri kapattı (CHP, MHP, AP, CGP, MSP, TİP, MP, TBP)': 'The National Security Council closed all political parties (CHP, MHP, AP, CGP, MSP, TİP, MP, TBP)', 'Katılım (%)': 'Turnout (%)', "SCF'nin kazandığı belediye": 'Municipalities won by the SCF', "SCF'nin kazandığı belediyeler": 'Municipalities won by the SCF', "1876'dan bugüne meclis sandalye dağılımı, hükûmetler ve devlet başkanları": 'Seats in parliament, governments and heads of state since 1876', 'Gelecek seçim yok': 'No upcoming election', 'Kazanılan seçim bölgesi (belediye)': 'Constituencies won (municipalities)', '(Kuruluştan kısa süre sonra)': '(shortly after founding)', '(madde bilgi kutusundaki güncel sayı)': '(current number in the article infobox)', 'Bağımsız / Adalet ve Kalkınma Partisi': 'Independent / Adalet ve Kalkınma Partisi', 'filtre dışı': 'outside filter', 'Sürüm': 'Version', 'Hükûmet başkanı': 'Head of government',
  };
  // ---------------------------------------------------------------- kalıplar (sıra önemli)
  const PAT = [
    [/^Tema: (Sistem|Açık|Koyu) — değiştirmek için tıklayın$/, (m, x) => `Theme: ${{ Sistem: 'System', Açık: 'Light', Koyu: 'Dark' }[x]} — click to change`],
    [/^(Seçim tarihinde|Bugün) — (.+):$/, (m, a, b) => `${a === 'Bugün' ? 'Today' : 'On election day'} — ${tr(b)}:`],
    [/^· (.+):$/, (m, a) => `· ${tr(a)}:`],
    [/^\((Cumhurbaşkanı|Başbakan|İcra Vekilleri Heyeti Reisi|Devlet Başkanı ve Başbakan|Muvakkat İcra Encümeni Reisi) (.+)\)$/, (m, a, b) => `(${{ Cumhurbaşkanı: 'President', Başbakan: 'PM', 'İcra Vekilleri Heyeti Reisi': 'Head of the Executive Council', 'Devlet Başkanı ve Başbakan': 'Head of State and PM', 'Muvakkat İcra Encümeni Reisi': 'Head of the Provisional Executive Committee' }[a]} ${b})`],
    [/^Veri güvenilirliği — (.+):$/, (m, l) => `Data reliability — ${tr(l)}:`],
    [/^Meclis dağılımı — (.+)$/, (m, x) => `Seats in parliament — ${tr(x)}`],
    [/^Birim: (il|ilçe|sancak|vilayet|liva)$/, (m, x) => `Unit: ${{ il: 'province', ilçe: 'district', sancak: 'sanjak', vilayet: 'vilayet', liva: 'liva' }[x]}`],
    [/^Sadrazam (.+): (.+)$/, (m, a, b) => `Grand vizier ${a}: ${date(b)}`],
    [/^Osmanlı hükûmeti — Sadrazam (.+)$/, 'Ottoman government — Grand vizier $1'],
    [/^Padişah (.+) \((.+)\)$/, (m, a, b) => `Sultan ${a} (${date(b)})`],
    [/^(.+): (.+) \((\d+) hükûmet\)$/, (m, a, b, n) => `${a}: ${date(b).replace('görevde', 'in office')} (${n} ${n === '1' ? 'government' : 'governments'})`],
    [/^(.+) · (.+) meclisi$/, (m, a, b) => `${tr(a)} · ${b.replace('(Haziran)', '(June)').replace('(Kasım)', '(November)')} parliament`],
    [/^(dönemi|sonrası), (\d+) (sandalye|vekil \(listede\))(.*)$/, (m, a, n, u, r) => `${a === 'dönemi' ? 'term' : 'after the election'}, ${n} ${u === 'sandalye' ? 'seats' : 'deputies (listed)'}${r.replace('· gruplama:', '· grouping:')}`],
    [/^dönem içi değişiklik · (.+)$/, (m, a) => `change during the term · ${date(a)}`],
    [/^Vikipedi: (.+)$/, 'Wikipedia: $1'],
    [/^Toplam (\d+) sandalye\.(.*)$/, null],
    [/^Meclis sandalye dağılımı, (\d+) sandalye$/, 'Seats in parliament, $1 seats'],
    [/^Cumhuriyet \((.+)\)$/, (m, d) => `Republic (${date(d)})`],
    [/^Değişen birimler \((.+) → (.+)\)$/, (m, a, b) => `Units that changed (${tr(a)} → ${tr(b)})`],
    [/^Cumhurbaşkanlığı Seçimi \((\d)\. tur\)$/, 'Presidential Election (round $1)'],
    [/^(İstibdat: )?Meclis kapalı \((.+)\)$/, (m, a, b) => `${a ? 'Hamidian era: ' : ''}Parliament closed (${b})`],
    [/^Askerî yönetim — (.+) \((Millî Birlik Komitesi|Millî Güvenlik Konseyi) Başkanı\)(.*)$/, (m, a, b, r) => `Military rule — ${a} (Chairman of the ${b === 'Millî Birlik Komitesi' ? 'National Unity Committee' : 'National Security Council'})${tr(r)}`],
    [/^Vekâleten — (.+) \((TBMM|Cumhuriyet Senatosu) Başkanı\)(.*)$/, (m, a, b, r) => `Acting — ${a} (Speaker of the ${b === 'TBMM' ? 'Grand National Assembly' : 'Senate'})${tr(r)}`],
    [/^TBMM Başkanı (.+) \((.+)\)\. .+$/, (m, a, b) => `Speaker of the Grand National Assembly ${a} (${date(b)}). Until the abolition of the sultanate (November 1, 1922) there was a sultan in Istanbul and a Speaker of the Assembly in Ankara; the Speaker exercised the powers of head of state until the Republic was proclaimed.`],
    [/^(.+) ülke geneli oy oranı$/, '$1 national vote share'],
    [/^(.+): parti geçmişini göster$/, '$1: show party history'],
    [/^(.+): Nüfus ([\d.,]+) · (.+)$/, '$1: Population $2 · $3'],
    [/^(\d{4}) Milletvekili Genel Seçimi(.*)$/, (m, y, r) => `${y} General Election${r.replace('(Haziran)', '(June)').replace('(Kasım)', '(November)').replace(/\(TBMM (\w+)\. dönem\)/, '(Grand National Assembly, term $1)')}`],
    [/^(\d{4}) Mahalli İdareler Seçimi \(Belediye Başkanlığı\)$/, '$1 Local Elections (Mayors)'],
    [/^(\d{4}) Mahalli İdareler Seçimi \(İl Genel Meclisi\)$/, '$1 Local Elections (Provincial Councils)'],
    [/^(\d{4}) Mahalli İdareler Ara Seçimi$/, '$1 Local By-elections'],
    [/^(\d{4}) Cumhuriyet Senatosu Üye Seçimi$/, '$1 Senate Election'],
    [/^(\d{4}) Cumhurbaşkanlığı Seçimi(?: \((\d)\. tur\))?$/, (m, y, t) => `${y} Presidential Election${t ? ` (round ${t})` : ''}`],
    [/^(\d{4}) Halkoylaması$/, '$1 Constitutional Referendum'],
    [/^(\d{4}) Meclis-i Mebusan Seçimi(.*)$/, (m, y, r) => `${y} Ottoman Chamber of Deputies Election${r.replace('(I. dönem)', '(1st term)').replace('(II. dönem)', '(2nd term)').replace('("Sopalı Seçim")', '("Election of Clubs")').replace('(Son Osmanlı Meclisi)', '(last Ottoman parliament)')}`],
    [/^1920 Büyük Millet Meclisi Seçimi \(TBMM I\. dönem\)$/, '1920 Grand National Assembly Election (term I)'],
    [/^(\d{4}) Belediye( ve İl Genel Meclisi)? Seçimleri( — sınırlar)?$/, (m, y, i, s) => `${y} Municipal${i ? ' and Provincial Council' : ''} Elections${s ? ' — boundaries only' : ''}`],
    [/^1840 Muhassıllık Meclisleri$/, '1840 Muhassıl Councils'],
    [/^Güncel durum: meclis ve il belediyeleri$/, 'Current state: parliament and provincial mayors'],
    [/^Güncelleme: (.+)$/, 'Updated: $1'],
    [/^(.+) — (.+)$/, null],   // seçim listesi: iki parçayı ayrı çevir
    [/^(.+) oy oranı$/, '$1 vote share'],
    [/^(.+) oyundaki değişim \(puan\)$/, '$1 vote swing (points)'],
    [/^(.+) değişim \(puan\)$/, '$1 swing (points)'],
    [/^Nüfus \((\d{4})\)$/, 'Population ($1)'],
    [/^Yıllık artış \((.+)\)$/, 'Annual growth ($1)'],
    [/^([\d.,]+) kişi\/km²$/, '$1 people/km²'],
    [/^([\d.,]+) yıl$/, '$1 years'],
    [/^Nüfus \(log ölçek\)$/, 'Population (log scale)'],
    [/^(.+) \(log ölçek\)$/, '$1 (log scale)'],
    [/^Veri güvenilirliği — (.+):$/, (m, l) => `Data reliability — ${tr(l)}:`],
    [/^Resmî kaynak$/, 'Official source'], [/^Ansiklopedik derleme$/, 'Encyclopedic compilation'], [/^Kısmi \/ yaklaşık$/, 'Partial / approximate'], [/^Sonuç verisi yok$/, 'No result data'],
    [/^Karşılaştırılan: (.+)$/, (m, x) => `Compared with: ${tr(x)}`],
    [/^Karşılaştırma: (.+) \((.+)\)\. İl sınırları değişmişse yalnız eşleşen iller boyanır\.$/, (m, x, d) => `Comparison: ${tr(x)} (${date(d)}). If provincial boundaries changed, only matching provinces are coloured.`],
    [/^Sürüm (.+)$/, 'Version $1'],
    [/^(\d+) ilçe, seçim tarihindeki sınırlarıyla \(sonradan kurulan ilçeler ayrıldıkları ilçeyle birlikte\); kalın çizgiler il sınırı\.(.*)$/, (m, n, r) => `${n} districts with the boundaries of election day (later districts merged into their parent); thick lines are provincial borders.${r.replace('Haritası olmayan:', 'Without map:')}`],
    [/^Bu seçim için ilçe verisi yok; il düzeyi gösteriliyor\..*$/, 'No district data for this election; showing provinces. District results exist for the 1950 and 1955 local elections and all elections since 1961.'],
    [/^Birim tablosu \((\d+)\)$/, 'Unit table ($1)'],
    [/^(\d+) sandalye$/, '$1 seats'], [/^(\d+) snd\.$/, '$1 seats'], [/^(.+) · (\d+) snd\.$/, '$1 · $2 seats'],
    [/^Tema: (Sistem|Açık|Koyu) — değiştirmek için tıklayın$/, (m, x) => `Theme: ${{ Sistem: 'System', Açık: 'Light', Koyu: 'Dark' }[x]} — click to change`],
    [/^Tema: (Sistem|Açık|Koyu) \(değiştirmek için tıklayın\)$/, (m, x) => `Theme: ${{ Sistem: 'System', Açık: 'Light', Koyu: 'Dark' }[x]} (click to change)`],
    [/^ ?Tema: (Sistem|Açık|Koyu)$/, (m, x) => ` Theme: ${{ Sistem: 'System', Açık: 'Light', Koyu: 'Dark' }[x]}`],
    [/^(\d+) \/ (\d+)$/, null],
    [/^(\d+) hükûmet kuruldu$/, '$1 governments formed'],
    [/^(\d{4})–(\d{4}) arasında$/, 'Between $1 and $2'],
    // "yeniden kuruldu" genel "kuruldu" kalıbından önce denenmeli
    [/^(.+) yeniden kuruldu$/, '$1 re-founded'], [/^(.+) kuruldu$/, '$1 founded'], [/^(.+) kapandı \/ kapatıldı$/, '$1 dissolved / closed'],
    [/^(.+) cumhurbaşkanı oldu$/, '$1 became president'], [/^(.+) tahta çıktı$/, '$1 ascended the throne'],
    [/^(\d+)\. Türkiye Hükûmeti kuruldu(.*)$/, (m, n, r) => `${ord(n)} Government of Turkey formed${r}`],
    [/^(\d+)\. Türkiye Hükûmeti güvenoyu alamadı \((.+)\)$/, (m, n, x) => `${ord(n)} Government of Turkey lost the confidence vote (${x.replace('Güvensizlik oyu', 'vote of no confidence')})`],
    [/^(\d+)\. Türkiye Hükûmeti$/, (m, n) => `${ord(n)} Government of Turkey`],
    [/^(\d+)\. hükûmet$/, (m, n) => `${ord(n)} government`],
    [/^(\d+) gün\)$/, '$1 days)'], [/^(.+), ([\d.]+) gün\)$/, (m, a, n) => `${date(a)}, ${n} days)`],
    [/^Faal partiler \((\d+) \/ derlenen (\d+)\)$/, 'Active parties ($1 of $2 compiled)'],
    [/^Güvenoyu: (.+)$/, (m, x) => `Confidence vote: ${x.replace('Güvenoyu gerekmiyor.', 'Not required.').replace('(Başkanlık sistemi)', '(presidential system)').replace('Güven oylaması yapılmadı.', 'No confidence vote held.').replace('(Güvensizlik oyu)', '(no confidence)').replace(' — hükûmet güvenoyu alamadı', ' — the government lost the vote')}`],
    [/^Güvenoyu gerekmiyor\.(.*)$/, 'Not required.$1'],
    [/^· (.+)$/, (m, a) => `· ${tr(a)}`],
    [/ · /, 'SPLIT'],
    [new RegExp(`^(\\d{1,2} )?(${MRE}) (\\d{4})(.*)$`), (m) => date(m)],
    // seçim tarih etiketleri: "1913–1914 kışı (…)", "1919 sonu (…)", "1877 (Meclis … toplandı)", "15–20 Şubat (ikinci seçmenler) ve …"
    [new RegExp(`^(\\d{4}( sonu| \\(|–\\d{4} kışı)|\\d{1,2}(–\\d{1,2})? (${MRE}) \\().*$`), (m) => date(m)],
    [/^(.+) – (.+)$/, (m, a, b) => `${date(a)} – ${date(b)}`],
  ];

  // metnin içine gömülü kalıp ifadeler (özel adlara dokunmaz)
  const SUB = [
    [/(\d+)\. Türkiye Hükûmeti/g, (m, n) => `${ord(n)} Government of Turkey`], [/Ankara Hükûmeti/g, 'Ankara Government'],
    [/(\d+)\. İcra Vekilleri Heyeti/g, (m, n) => `${ord(n)} Executive Council`], [/\(Güvensizlik oyu\)/g, '(no confidence)'],
    [/ — hükûmet güvenoyu alamadı/g, ' — the government lost the vote'], [/\(Seçim hükûmeti\)/g, '(election government)'],
    [/· Başbakan /g, '· PM '], [/· Devlet Başkanı ve Başbakan /g, '· Head of State and PM '], [/· Cumhurbaşkanı /g, '· President '], [/· İcra Vekilleri Heyeti Reisi /g, '· Head of the Executive Council '], [/· Muvakkat İcra Encümeni Reisi /g, '· Head of the Provisional Executive Committee '], [/Askerî Hükûmet/g, 'Military government'], [/Geçici Hükûmet/g, 'Caretaker government'], [/^Bağımsız \/ /, 'Independent / '], [/ \(il merkezi belediyesi\)/g, ' (provincial centre municipality)'], [/ · Bağımsız \/ /, ' · Independent / '],
    [/Güvenoyu gerekmiyor\./g, 'Not required.'], [/Güven oylaması yapılmadı\./g, 'No confidence vote held.'], [/\(Başkanlık sistemi\)/g, '(presidential system)'],
  ];
  function tr(s) {
    if (lang !== 'en' || !s) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], k = s.trim();
    if (!k || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(k)) return s;
    let r = EN[k];
    if (r === undefined) {
      for (const [re, rep] of PAT) {
        const m = k.match(re);
        if (!m) continue;
        if (rep === null) {
          if (re.source.startsWith('^(.+) — (.+)')) { r = `${tr(m[1])} — ${date(tr(m[2]))}`; }
          else r = k;
        } else if (rep === 'SPLIT') r = k.split(' · ').map((x) => tr(x)).join(' · ');
        else r = typeof rep === 'function' ? rep(...m) : k.replace(re, rep);
        break;
      }
    }
    let out = r === undefined ? k : r;
    if (/[çğıöşüÇĞİÖŞÜû]/.test(out)) for (const [re, rep] of SUB) out = out.replace(re, rep);
    return out === k ? s : lead + out + trail;
  }
  const ATTR = ['title', 'placeholder', 'aria-label'];
  function trNode(n) {
    if (n.nodeType === 3) { const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || n.closest('script,style,.no-tr')) return;
    for (const a of ATTR) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let x; while ((x = w.nextNode())) {
      if (x.nodeType === 3) { if (!x.parentElement.closest('script,style,.no-tr')) { const v = x.nodeValue, t = tr(v); if (t !== v) x.nodeValue = t; } }
      else for (const a of ATTR) { const v = x.getAttribute(a); if (v) { const t = tr(v); if (t !== v) x.setAttribute(a, t); } }
    }
  }
  function start() {
    document.documentElement.lang = 'en';
    document.title = tr(document.title);
    const tpl = document.getElementById('about-en');
    if (tpl) document.getElementById('aboutBody').innerHTML = tpl.innerHTML;
    trNode(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') trNode(m.target);
        else if (m.type === 'attributes') trNode(m.target);
        else m.addedNodes.forEach(trNode);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  window.I18N = { lang, t: tr, date, LOC: lang === 'en' ? 'en-US' : 'tr-TR',
    set(l) { localStorage.setItem('lang', l); const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); } };
  if (lang === 'en') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
})();
