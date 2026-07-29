import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldUmlauts, normalizeSearchText, queryVariants } from "../src/lib/search/normalize";
import { levenshtein, scoreMatch } from "../src/lib/search/fuzzy";

describe("search normalize", () => {
  it("faltet Umlaute", () => {
    assert.equal(foldUmlauts("Müller"), "mueller");
    assert.equal(normalizeSearchText("  Max  Mustermann "), "max mustermann");
  });

  it("erzeugt Varianten inkl. Umlaut", () => {
    const v = queryVariants("Mueller");
    assert.ok(v.some((x) => x.toLowerCase().includes("mueller") || x.includes("müller")));
  });
});

describe("search fuzzy", () => {
  it("bewertet exakte und Prefix-Treffer hoch", () => {
    assert.equal(scoreMatch("Max", "Max Mustermann"), 92);
    assert.ok(scoreMatch("max", "MAX") >= 90);
  });

  it("toleriert Tippfehler", () => {
    assert.equal(levenshtein("mueller", "muller"), 1);
    assert.ok(scoreMatch("Muller", "Müller") >= 45);
    assert.ok(scoreMatch("Mustremann", "Mustermann") >= 45);
  });

  it("findet Teilnamen", () => {
    assert.ok(scoreMatch("Max", "Hans Max Weber") >= 70);
  });
});
