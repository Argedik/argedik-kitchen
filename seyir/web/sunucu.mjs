// Seyir tarif defteri — bağımlılıksız sunucu.
// belgeler/tarifler/*.md her istekte yeniden okunur: belge değişince sayfayı yenilemek yeter.
// 0.0.0.0'a bağlanır: localhost'tan da, aynı Wi-Fi'daki telefondan da LAN IP ile açılır.
import { createServer } from "node:http";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";

const WEB = import.meta.dirname;
const KOK = path.resolve(WEB, ".."); // <proje>/seyir
const usul = JSON.parse(await readFile(path.join(KOK, ".usul"), "utf8"));
const PORT = Number(process.env.PORT) || usul.port || 5280;

const tirnaksiz = (v) => v.replace(/^["'](.*)["']$/, "$1");
const deger = (v) => (/^\d+$/.test(v) ? Number(v) : tirnaksiz(v));

// "20–25 dk" → 1500 sn: sayaç üst sınırdan kurulur, erken kontrol metinde yazılıdır. "30 sn" → 30.
const saniye = (s) => Math.max(...(s.match(/\d+/g) ?? ["0"]).map(Number)) * (/sn/.test(s) ? 1 : 60);

function ayristir(metin, slug) {
  const [, on = "", govde = metin] = metin.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
  const meta = Object.fromEntries(
    on.split("\n").filter((s) => s.includes(":")).map((s) => {
      const i = s.indexOf(":");
      return [s.slice(0, i).trim(), deger(s.slice(i + 1).trim())];
    }),
  );
  const bolumler = [];
  let bolum = null;
  let grup = null;
  for (const satir of govde.split("\n")) {
    let m;
    if ((m = satir.match(/^## (.+)/))) {
      bolum = { baslik: m[1].trim(), notlar: [], gruplar: [] };
      bolumler.push(bolum);
      grup = null;
    } else if (!bolum) {
      continue;
    } else if ((m = satir.match(/^> ?(.*)/))) {
      bolum.notlar.push(m[1]);
    } else if ((m = satir.match(/^### (.+)/))) {
      grup = { baslik: m[1].trim(), tur: "liste", ogeler: [] };
      bolum.gruplar.push(grup);
    } else if (grup && (m = satir.match(/^\d+\.\s+(.+?)(?:\s*\(([^)]*(?:dk|sn))\))?(?:\s*[—-]\s*(.+))?$/))) {
      // Adım: "1. Başlık" + isteğe bağlı "(N dk)" ve "— ipucu". Süre verilmezse eylemlerin toplamıdır.
      grup.tur = "adim";
      // "[x] " ile başlayan adım yapılmıştır: sitede en alttaki "Yapılanlar" başlığına iner.
      const yapildi = /^\[x\]\s*/i.test(m[1]);
      grup.ogeler.push({
        no: Number(satir.match(/^\d+/)[0]),
        baslik: m[1].replace(/^\[x\]\s*/i, ""),
        yapildi,
        saniye: m[2] ? saniye(m[2]) : 0,
        metin: m[3] ?? "",
        malzemeler: [],
        eylemler: [],
      });
    } else if (grup?.tur === "adim" && (m = satir.match(/^\s+\+\s+(.+?)\s*\|\s*(.+)/))) {
      grup.ogeler.at(-1).malzemeler.push({ miktar: m[1], ad: m[2] });
    } else if (grup?.tur === "adim" && (m = satir.match(/^\s+\*\s+(.+?)\s*\|\s*(.+)/))) {
      const adim = grup.ogeler.at(-1);
      adim.eylemler.push({ sureMetin: m[1], saniye: saniye(m[1]), metin: m[2] });
      adim.saniye = adim.eylemler.reduce((t, e) => t + e.saniye, 0);
    } else if (grup && (m = satir.match(/^- (.+?)\s*\|\s*(.+)/))) {
      grup.ogeler.push({ miktar: m[1], ad: m[2] });
    }
  }
  return { slug, ...meta, bolumler };
}

async function tarifler() {
  const klasor = path.join(KOK, "belgeler", "tarifler");
  const dosyalar = (await readdir(klasor)).filter((d) => d.endsWith(".md")).sort();
  return Promise.all(
    dosyalar.map(async (d) => ayristir(await readFile(path.join(klasor, d), "utf8"), path.basename(d, ".md"))),
  );
}

// Seyir Merkezi her projenin durum.json'unu tarar. Tarif defterinde görev yok, yüzde ölçülmez.
const liste = await tarifler();
await writeFile(
  path.join(KOK, "durum.json"),
  JSON.stringify(
    {
      proje: usul.proje,
      onek: usul.onek,
      surum: usul.usul,
      pct: null,
      tamam: 0,
      toplam: 0,
      tarif: liste.length,
      port: PORT,
      guncelleme: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + "\n",
);

createServer(async (istek, yanit) => {
  try {
    if (istek.url === "/veri.json") {
      yanit.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      return yanit.end(JSON.stringify({ proje: usul.proje, tarifler: await tarifler() }));
    }
    yanit.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    yanit.end(await readFile(path.join(WEB, "index.html")));
  } catch (hata) {
    yanit.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    yanit.end(String(hata));
  }
}).listen(PORT, "0.0.0.0", () => {
  const ipler = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a.family === "IPv4" && !a.internal)
    .map((a) => `  http://${a.address}:${PORT}`);
  console.log(`Seyir · ${usul.proje} · ${liste.length} tarif\n  http://localhost:${PORT}\n${ipler.join("\n")}`);
});
