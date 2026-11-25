// Cek cepat parser link Google Maps. Jalankan: npx tsx app/projects/create/parse-maps-link.check.ts
import assert from "node:assert/strict";
import { mapsLink, parseMapsInput } from "./parse-maps-link";

const coords = (s: string) => {
  const r = parseMapsInput(s);
  assert.ok(r.ok, `harus valid: ${s}`);
  return [r.preview.lat, r.preview.lng];
};

// URL tempat (!3d..!4d.. lebih akurat daripada @ pusat tampilan)
assert.deepEqual(
  coords("https://www.google.com/maps/place/Malang/@-7.98,112.63,15z/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d-7.9666!4d112.6326"),
  [-7.9666, 112.6326],
);
assert.deepEqual(coords("https://www.google.com/maps/@-7.98,112.63,17z"), [-7.98, 112.63]);
assert.deepEqual(coords("https://www.google.com/maps?q=-7.98,112.63"), [-7.98, 112.63]);
assert.deepEqual(coords("-7.98, 112.63"), [-7.98, 112.63]);

// Kode embed
const embed = parseMapsInput('<iframe src="https://www.google.com/maps/embed?pb=!1m18!2d112.63!3d-7.98" width="600"></iframe>');
assert.ok(embed.ok && embed.preview.lat === -7.98 && embed.preview.lng === 112.63);

// Link tab baru tidak boleh memakai URL embed
assert.equal(mapsLink(embed.preview), "https://www.google.com/maps?q=-7.98%2C112.63");
const embedNoCoords = parseMapsInput("https://www.google.com/maps/embed?pb=!1m2!1s0x0:0x1!2sAlun%20Alun!3m2!1sid!2sid");
assert.ok(embedNoCoords.ok);
assert.equal(mapsLink(embedNoCoords.preview), "https://www.google.com/maps?q=Alun%20Alun");

// Nama tempat tanpa koordinat tetap bisa dipreview
const named = parseMapsInput("https://www.google.com/maps/place/Alun+Alun+Malang");
assert.ok(named.ok && named.preview.embedUrl.includes("Alun%20Alun%20Malang"));

// Penolakan
for (const bad of ["https://maps.app.goo.gl/abc", "https://evil.example.com/maps/@-7.9,112.6,15z", "https://google.evil.com/maps/embed?pb=x", "http://www.google.com/maps/embed?pb=x", "https://www.google.com.evil.io/maps?q=a", "<iframe src=\"https://google.attacker.net/maps/embed\"></iframe>", "halo", "99999, 1.5"]) {
  assert.equal(parseMapsInput(bad).ok, false, `harus ditolak: ${bad}`);
}
assert.equal(parseMapsInput("").ok, false);

console.info("parse-maps-link: semua cek lolos");
