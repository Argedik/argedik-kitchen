# Seyir — Argedik Mutfak tarif defteri

Tarifler `belgeler/tarifler/NNN-<slug>.md` olarak durur; site onları her açılışta yeniden okur.

```
node seyir/web/sunucu.mjs
```

Açılış: `http://localhost:5280` — telefondan aynı Wi-Fi'da `http://<bilgisayarın-LAN-IP>:5280`
(sunucu açılınca adresleri yazar). Bağımlılık yok, `npm install` gerekmez.

## Tarif belgesi biçimi

- Frontmatter: `tur: tarifler`, `kod: TRF-NNN`, `baslik`, `durum`, `tarih`, `emoji`, `kisi`, `sure`, `ozet`.
- `## Bölüm` → sitede bir sekme (ör. yemek, pilav, zaman çizelgesi).
- `> not` → bölümün üstündeki uyarı kutusu.
- `### Grup` + `- miktar | malzeme` → işaretlenebilir malzeme listesi.
- `### Adımlar` + `1. Başlık (N dk) — açıklama` → sayaçlı adım kartı.
- Miktarı `… dk` ile biten liste (`- 20. dk | …`) zaman çizelgesi olarak çizilir.
