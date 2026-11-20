"""Parti kısaltması -> tam ad. Aynı kısaltma farklı yıllarda farklı partiyi gösterebilir.

Kaynak: ilgili seçimlerin Türkçe Vikipedi maddeleri (scripts/verify_wiki.py ile denetlenir).
Değer ya bir ad ya da [(başlangıç_yılı, bitiş_yılı, ad), ...] listesidir.
"""

NAMES = {
    'TKöyP': 'Türkiye Köylü Partisi',
    'AK Parti': 'Adalet ve Kalkınma Partisi',
    'ANAP': 'Anavatan Partisi',
    'AP': 'Adalet Partisi',
    'BBP': 'Büyük Birlik Partisi',
    'BDP': 'Barış ve Demokrasi Partisi',
    'BP69': 'Birlik Partisi (Türkiye Birlik Partisi)',
    'TBP73': 'Türkiye Birlik Partisi',
    'Bağımsız': 'Bağımsız adaylar',
    'BĞMSZ': 'Bağımsız adaylar',
    'CGP': 'Cumhuriyetçi Güven Partisi',
    'CKMP': 'Cumhuriyetçi Köylü Millet Partisi',
    'CMP': 'Cumhuriyetçi Millet Partisi',
    'CHP': 'Cumhuriyet Halk Partisi',
    'DEHAP': 'Demokratik Halk Partisi',
    'DEM Parti': 'Halkların Eşitlik ve Demokrasi Partisi',
    'DEMP73': 'Demokratik Parti',
    'DP': [(1946, 1960, 'Demokrat Parti'), (1970, 1980, 'Demokratik Parti'), (2007, 2100, 'Demokrat Parti (2007)')],
    'DSP': 'Demokratik Sol Parti',
    'DTP': 'Demokratik Toplum Partisi',
    'DYP': 'Doğru Yol Partisi',
    'FP': 'Fazilet Partisi',
    'GP': [(1967, 1972, 'Güven Partisi'), (2002, 2009, 'Genç Parti')],
    'HADEP': 'Halkın Demokrasi Partisi',
    'HDP': 'Halkların Demokratik Partisi',
    'HP': 'Halkçı Parti',
    'HP57': 'Hürriyet Partisi',
    'HÜDAPAR': 'Hür Dava Partisi',
    'IDP': 'Islahatçı Demokrasi Partisi',
    'MDP': 'Milliyetçi Demokrasi Partisi',
    'MEMLEKET': 'Memleket Partisi',
    'MHP': 'Milliyetçi Hareket Partisi',
    'MP62': 'Millet Partisi (1962)',
    'MSP': 'Millî Selâmet Partisi',
    'MÇP': 'Milliyetçi Çalışma Partisi',
    'RP': 'Refah Partisi',
    'SHP': [(1985, 1995, 'Sosyaldemokrat Halkçı Parti'), (2002, 2010, 'Sosyaldemokrat Halk Partisi')],
    'SODEP': 'Sosyal Demokrasi Partisi',
    'SP': 'Saadet Partisi',
    'TKP': 'Türkiye Komünist Partisi',
    'TSİP': 'Türkiye Sosyalist İşçi Partisi',
    'TİP': 'Türkiye İşçi Partisi',
    'YENİDEN REFAH': 'Yeniden Refah Partisi',
    'YEŞİL SOL': 'Yeşil Sol Parti',
    'YTP61': 'Yeni Türkiye Partisi',
    'ZP': 'Zafer Partisi',
    'İYİ Parti': 'İYİ Parti',
}

# Vikipedi maddelerinde geçen eşdeğer yazımlar (denetim için)
ALIASES = {
    'Millî Selâmet Partisi': ['Millî Selamet Partisi', 'Milli Selamet Partisi', 'Millî Selâmet Partisi'],
    'Birlik Partisi (Türkiye Birlik Partisi)': ['Birlik Partisi', 'Türkiye Birlik Partisi'],
    'Millet Partisi (1962)': ['Millet Partisi'],
    'Demokrat Parti (2007)': ['Demokrat Parti'],
    'Sosyaldemokrat Halkçı Parti': ['Sosyaldemokrat Halkçı Parti', 'Sosyal Demokrat Halkçı Parti'],
    'Sosyaldemokrat Halk Partisi': ['Sosyaldemokrat Halk Partisi'],
    'Bağımsız adaylar': ['Bağımsız'],
    'Halkların Eşitlik ve Demokrasi Partisi': ['Halkların Eşitlik ve Demokrasi Partisi', 'DEM Parti'],
    'Yeşil Sol Parti': ['Yeşil Sol Parti', 'Yeşiller ve Sol Gelecek Partisi'],
    'İYİ Parti': ['İYİ Parti', 'İyi Parti'],
}


def full_name(key, year):
    v = NAMES.get(key)
    if v is None:
        return None
    if isinstance(v, str):
        return v
    for a, b, n in v:
        if a <= year <= b:
            return n
    return None


# Kaynak veri setindeki dönemine uymayan parti anahtarlarının düzeltmesi.
# (anahtar, ilk_yıl, son_yıl, yeni_anahtar, il_plakası ya da None, gerekçe)
KEY_FIXES = [
    ('CGP', 1967, 1972, 'GP', None, 'Parti bu dönemde Güven Partisi (sonra Millî Güven Partisi) adını taşıyordu; Cumhuriyetçi Güven Partisi Mart 1973\'te Millî Güven Partisi ile Cumhuriyetçi Parti\'nin birleşmesiyle kuruldu (Vikipedi: Cumhuriyetçi Güven Partisi).'),
    ('DP', 1970, 1980, 'DEMP73', None, 'Bu dönemde "DP" kısaltması Demokratik Parti\'yi (1970–1980) gösterir; 1946–1960 Demokrat Parti\'si değildir.'),
    ('MHP', 1986, 1992, 'MÇP', None, 'Parti 30 Kasım 1985 – 24 Ocak 1993 arasında Milliyetçi Çalışma Partisi (MÇP) adını taşıyordu (Vikipedi: Milliyetçi Çalışma Partisi).'),
]
