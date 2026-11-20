#!/usr/bin/env python3
"""1950 sonrası seçim kayıtlarının kısa açıklamaları (panelde başlığın altında gösterilir).

Kaynak veri setinde açıklama alanı yoktur. Buradaki metinler yalnız şu türden bilgileri içerir:
  - sitenin kendi verisinden okunabilenler (sonuçlar, sınırlar, seçimden sonra kurulan hükûmetler),
  - sources/wikipedia/ altındaki madde kopyalarında geçenler (ör. 1965 millî bakiye, 1991 ittifakı, 2002 barajı),
  - seçim sistemi ve halkoylaması konusu gibi genel kabul gören temel bilgiler.
Sayılar bilerek az tutuldu; ülke geneli oranlar paneldeki çubuklarda yazar.

build_modern.py her kaydı yazarken DESCRIPTIONS'tan açıklamayı ekler. Yayındaki veriyi kaynakları
indirmeden güncellemek için:  python3 scripts/descriptions.py
"""
import glob, json, os

DESCRIPTIONS = {
    # ------------------------------------------------------------------ milletvekili genel seçimleri
    '1950': "16 Şubat 1950'de kabul edilen, gizli oy, açık tasnif ve yargı denetimi getiren seçim kanunuyla yapılan ilk seçim. "
            "İl bazında liste usulü çoğunluk sisteminde Demokrat Parti meclisin büyük çoğunluğunu kazandı ve CHP'nin 1923'ten beri "
            "süren iktidarı sona erdi. Celâl Bayar cumhurbaşkanı, Adnan Menderes başbakan oldu.",
    '1954': "Liste usulü çoğunluk sistemiyle yapıldı; Demokrat Parti oyunu ve sandalye sayısını artırdı. Osman Bölükbaşı'nın "
            "Cumhuriyetçi Millet Partisi yalnız Kırşehir'de kazandı. Kırşehir seçimden sonra ilçe yapılıp yeni kurulan Nevşehir'e "
            "bağlandı ve 1957'de yeniden il oldu (haritada 1955 yerel seçiminde Kırşehir yoktur).",
    '1957': "Öne alınan seçim. DP iktidarı seçimden önce seçim kanununu değiştirerek muhalefet partilerinin ittifak kurmasını engelledi. "
            "Liste usulü çoğunluk sisteminde DP, oyu yarının altına düşmesine karşın meclis çoğunluğunu korudu; "
            "Hürriyet Partisi yalnız Burdur'da kazandı.",
    '1961': "27 Mayıs 1960 askerî darbesinden sonra, 1961 Anayasası'na göre yapılan ilk seçim; Millet Meclisi ile Cumhuriyet Senatosu "
            "aynı gün seçildi ve nispi temsil sistemi (d'Hondt) ilk kez uygulandı. Hiçbir parti çoğunluğu alamadı; İsmet İnönü "
            "başkanlığında CHP–AP koalisyonu kuruldu.",
    '1965': "Millî bakiye sistemiyle yapıldı. Süleyman Demirel'in Adalet Partisi tek başına çoğunluk kazandı. "
            "Türkiye İşçi Partisi 15 milletvekiliyle meclise girdi.",
    '1969': "Millî bakiye kaldırılıp d'Hondt sistemine dönüldü. Adalet Partisi oyu düşmesine karşın sandalye sayısını artırarak "
            "yeniden tek başına iktidar oldu.",
    '1973': "12 Mart 1971 muhtırasından sonraki ilk genel seçim. Bülent Ecevit önderliğindeki CHP birinci oldu ama çoğunluğu alamadı; "
            "Ocak 1974'te CHP–MSP koalisyonu kuruldu.",
    '1977': "CHP oyların %41'iyle birinci oldu ama çoğunluğu alamadı. Ecevit'in kurduğu azınlık hükûmeti güvenoyu alamadı; "
            "AP, MSP ve MHP'nin ortaklığıyla II. Milliyetçi Cephe hükûmeti kuruldu.",
    '1983': "12 Eylül 1980 darbesinden sonraki ilk genel seçim. Millî Güvenlik Konseyi yalnız üç partinin (ANAP, Halkçı Parti, MDP) "
            "seçime girmesine izin verdi ve %10 ülke barajı ilk kez uygulandı. Turgut Özal'ın ANAP'ı tek başına çoğunluk kazandı.",
    '1987': "Siyasi yasakları kaldıran 1987 halkoylamasından sonra öne alınan seçim. %10 ülke barajı ve seçim çevresi barajlarıyla "
            "ANAP oyların %36'sıyla sandalyelerin yaklaşık üçte ikisini kazandı; barajı aşamayan DSP ve RP meclis dışında kaldı.",
    '1991': "Öne alınan seçimde DYP birinci oldu ve Süleyman Demirel başkanlığında DYP–SHP koalisyonu kuruldu. Refah Partisi, MÇP ve "
            "IDP ile kurduğu ittifakla (adaylar RP listelerinden) %16,9 oy ve 62 milletvekili kazandı; ittifak seçimden kısa süre sonra dağıldı.",
    '1995': "Öne alınan seçimde Refah Partisi birinci oldu. Önce ANAP–DYP (Mart 1996), ardından RP–DYP (Haziran 1996) koalisyonu kuruldu. "
            "MHP %8,2 ile %10 barajının altında kaldı.",
    '1999': "Yerel seçimlerle aynı gün yapıldı. DSP birinci, MHP ikinci parti oldu; Bülent Ecevit başkanlığında DSP–MHP–ANAP "
            "koalisyonu kuruldu. CHP %10 barajını aşamadı ve meclis dışında kaldı.",
    '2002': "Öne alınan seçim. 2001'de kurulan AK Parti oyların %34'üyle sandalyelerin yaklaşık üçte ikisini kazandı. %10 barajını "
            "yalnız AK Parti ve CHP aştı; önceki hükûmetin ortakları DSP, MHP ve ANAP meclis dışında kaldı.",
    '2007': "Nisan–Mayıs 2007'deki cumhurbaşkanlığı seçimi krizinin ardından öne alınan seçim. AK Parti oyunu artırarak yeniden tek başına "
            "iktidar oldu, MHP yeniden meclise girdi. DTP adaylarını barajı aşmak için bağımsız gösterdi.",
    '2011': "AK Parti üst üste üçüncü kez tek başına iktidar oldu. BDP adaylarını barajı aşmak için bağımsız gösterdi "
            "(Emek, Demokrasi ve Özgürlük Bloku).",
    '2015Haziran': "AK Parti 2002'den beri ilk kez tek başına çoğunluğu kaybetti. HDP parti olarak girdiği seçimde %13 oyla %10 barajını aştı. "
                   "Hükûmet kurulamadı ve seçim 1 Kasım 2015'te yenilendi.",
    '2015Kasim': "7 Haziran seçiminden sonra hükûmet kurulamadığı için yenilenen seçim. AK Parti yeniden tek başına çoğunluk kazandı.",
    '2018': "Cumhurbaşkanlığı hükûmet sistemine geçişten sonraki ilk genel seçim; cumhurbaşkanlığı seçimiyle aynı gün yapıldı. "
            "Milletvekili sayısı 600'e çıktı ve partilerin seçim ittifakı kurmasına ilk kez izin verildi (Cumhur İttifakı ve Millet İttifakı).",
    '2023': "6 Şubat 2023 depremlerinden üç ay sonra, cumhurbaşkanlığı seçimiyle aynı gün yapıldı; seçim barajı %7'ye indirilmişti. "
            "HDP, hakkındaki kapatma davası nedeniyle adaylarını Yeşil Sol Parti listelerinden gösterdi; DEVA, Gelecek, Saadet ve "
            "Demokrat Parti'nin adayları CHP listelerinden seçime girdi.",
    # ------------------------------------------------------------------ halkoylamaları
    '1961referandum': "27 Mayıs 1960 askerî darbesinden sonra Kurucu Meclis'in hazırladığı 1961 Anayasası halkoylamasıyla kabul edildi. "
                      "Türkiye'de yapılan ilk halkoylamasıdır.",
    '1982referandum': "12 Eylül 1980 darbesinden sonra Danışma Meclisi'nin hazırladığı 1982 Anayasası halkoylamasıyla kabul edildi; oy "
                      "kullanmak zorunluydu. Anayasanın geçici 1. maddesi uyarınca Millî Güvenlik Konseyi Başkanı Kenan Evren yedi yıllığına "
                      "cumhurbaşkanı oldu.",
    '1987referandum': "1982 Anayasası'nın geçici 4. maddesiyle 1980 öncesi siyasi parti yöneticilerine getirilen siyasi yasakların kaldırılması "
                      "çok küçük bir farkla kabul edildi. Böylece Süleyman Demirel, Bülent Ecevit, Necmettin Erbakan ve Alparslan Türkeş "
                      "gibi eski liderler yeniden siyasete dönebildi.",
    '1988referandum': "Yerel seçimlerin bir yıl öne alınmasını öngören anayasa değişikliği reddedildi; yerel seçimler 26 Mart 1989'da yapıldı.",
    '2007referandum': "Cumhurbaşkanının halk tarafından beş yıllığına (en çok iki dönem) seçilmesini, genel seçimlerin dört yılda bir "
                      "yapılmasını ve TBMM'nin toplantı yeter sayısının 184 olmasını içeren anayasa değişikliği kabul edildi. "
                      "Cumhurbaşkanı ilk kez 2014'te halk tarafından seçildi.",
    '2010referandum': "Anayasa Mahkemesi ile Hâkimler ve Savcılar Yüksek Kurulu'nun yapısını değiştiren, Anayasa Mahkemesi'ne bireysel başvuru "
                      "hakkı getiren ve 12 Eylül darbesini yapanların yargılanmasını engelleyen geçici 15. maddeyi kaldıran anayasa değişikliği "
                      "paketi kabul edildi. Halkoylaması darbenin 30. yıl dönümünde yapıldı.",
    '2017referandum': "Cumhurbaşkanlığı hükûmet sistemine geçişi öngören anayasa değişikliği kabul edildi: başbakanlık kaldırıldı, yürütme "
                      "yetkisi cumhurbaşkanına verildi, milletvekili sayısı 550'den 600'e çıkarıldı. Yeni sistem 2018 seçimlerinden sonra "
                      "yürürlüğe girdi. Sayım sırasında YSK'nın mühürsüz oy pusulası ve zarfları geçerli sayma kararı itirazlara konu oldu.",
    # ------------------------------------------------------------------ cumhurbaşkanlığı seçimleri
    '2014cb': "2007 halkoylamasıyla getirilen usulle cumhurbaşkanının halk tarafından seçildiği ilk seçim. "
              "Recep Tayyip Erdoğan ilk turda salt çoğunluğu aşarak seçildi.",
    '2018cb': "Cumhurbaşkanlığı hükûmet sistemindeki ilk cumhurbaşkanlığı seçimi; milletvekili genel seçimiyle aynı gün yapıldı. "
              "Recep Tayyip Erdoğan ilk turda seçildi.",
    '2023cb1tur': "Hiçbir aday geçerli oyların yarısından fazlasını alamadığı için seçim ikinci tura kaldı; cumhurbaşkanlığı seçiminin "
                  "ikinci tura kaldığı ilk seçimdir. Milletvekili genel seçimiyle aynı gün yapıldı.",
    '2023cb2tur': "İlk turda en çok oy alan iki aday arasında yapılan ikinci turu Recep Tayyip Erdoğan kazandı.",
    # ------------------------------------------------------------------ yerel seçimler
    '1963yerel': "27 Mayıs 1960 darbesinden sonraki ilk yerel seçim. Belediye başkanları bu seçimden itibaren doğrudan halk tarafından "
                 "seçildi; daha önce belediye meclisleri seçiyordu.",
    '1973yerel': "Genel seçimden iki ay sonra yapıldı. CHP İstanbul, Ankara, İzmir ve Adana dahil büyük kentlerin çoğunda kazandı.",
    '1984yerel': "12 Eylül 1980 darbesinden sonraki ilk yerel seçim. 1983 genel seçimine katılamayan SODEP, DYP ve Refah Partisi de "
                 "seçime girdi; ANAP birinci oldu.",
    '1989yerel': "SHP birinci oldu; iktidardaki ANAP'ın oyu 1987 genel seçimine göre belirgin biçimde düştü.",
    '1994yerel': "Refah Partisi İstanbul'da Recep Tayyip Erdoğan, Ankara'da Melih Gökçek ile büyükşehir belediye başkanlıklarını kazandı.",
    '1999yerel': "Milletvekili genel seçimiyle aynı gün yapıldı.",
    '2014yerel': "6360 sayılı kanunla büyükşehir belediyesi sayısı 30'a çıktı; bu illerde büyükşehir sınırları il sınırına genişletildi "
                 "ve il genel meclisleri kaldırıldı.",
    '2019yerel': "CHP, Millet İttifakı'nın adaylarıyla İstanbul ve Ankara'yı kazandı. YSK İstanbul Büyükşehir Belediye Başkanlığı seçimini "
                 "iptal etti; 23 Haziran 2019'da yenilenen seçimi de Ekrem İmamoğlu kazandı. Haritada 31 Mart sonuçları gösterilir.",
    '2024yerel': "CHP, 1977'den bu yana ilk kez bir seçimde ülke genelinde birinci parti oldu; Yeniden Refah Partisi üçüncü sıraya yükseldi.",
    # ------------------------------------------------------------------ il genel meclisi (belediye kaydıyla aynı seçim)
    '1963yerel-igm': "27 Mayıs 1960 darbesinden sonraki ilk yerel seçim; belediye başkanlığı seçimleriyle aynı gün yapıldı.",
    '1984yerel-igm': "12 Eylül 1980 darbesinden sonraki ilk yerel seçim; belediye başkanlığı seçimleriyle aynı gün yapıldı.",
    '1999yerel-igm': "Milletvekili genel seçimi ve belediye başkanlığı seçimleriyle aynı gün yapıldı.",
    # ------------------------------------------------------------------ Cumhuriyet Senatosu
    '1979senato': "Senato kısmi yenileme seçimi, milletvekili ara seçimleriyle aynı gün yapıldı. AP'nin belirgin üstünlüğünün ardından "
                  "Başbakan Ecevit istifa etti ve Kasım 1979'da Süleyman Demirel'in AP azınlık hükûmeti kuruldu.",
}


def apply(rec):
    """Kayda açıklama ekler (varsa üzerine yazar); 1950 öncesi kayıtların kendi açıklamalarına dokunmaz."""
    t = DESCRIPTIONS.get(rec.get('id'))
    if t: rec['description'] = t
    return rec


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'elections')
    n = 0
    for key, text in DESCRIPTIONS.items():
        p = os.path.join(root, key + '.json')
        d = json.load(open(p))
        if d.get('description') != text:
            d['description'] = text
            json.dump(d, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
            n += 1
    print('%d kayda açıklama yazıldı (%d tanımlı)' % (n, len(DESCRIPTIONS)))
