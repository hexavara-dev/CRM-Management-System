// Cek cepat batas jumlah kolom unit. Jalankan: npx tsx app/projects/create/add-unit-count.check.ts
import assert from "node:assert/strict";
import { clampAddCount } from "./add-unit-count";

assert.equal(clampAddCount(3, 10), 3);
assert.equal(clampAddCount(99, 10), 10, "tidak boleh melebihi sisa slot");
assert.equal(clampAddCount(10, 10), 10, "tepat sebesar sisa slot boleh");
assert.equal(clampAddCount(0, 10), 1, "minimal 1");
assert.equal(clampAddCount(-4, 10), 1);
assert.equal(clampAddCount(2.9, 10), 2, "pecahan dibulatkan ke bawah");
assert.equal(clampAddCount(Number.NaN, 10), 1, "input kosong/NaN jatuh ke 1");
assert.equal(clampAddCount(5, 0), 0, "tanpa sisa slot tidak ada yang bisa ditambah");
assert.equal(clampAddCount(5, -2), 0);
assert.equal(clampAddCount(1, 1), 1);
