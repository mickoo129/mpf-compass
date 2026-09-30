import assert from "node:assert/strict";
import { test } from "node:test";
import { indexFund, normalize, scoreQuery } from "./search.ts";
import type { Fund } from "./types.ts";

const fund = (over: Partial<Fund>): Fund =>
  ({
    nameZh: "",
    nameEn: "",
    schemeZh: "",
    schemeEn: "",
    providerZh: "",
    providerEn: "",
    trusteeZh: "",
    trusteeEn: "",
    typeZh: "",
    typeEn: "",
    ...over,
  }) as Fund;

const manulifeNA = indexFund(
  fund({ nameZh: "宏利MPF北美股票基金", nameEn: "Manulife MPF North American Equity Fund", providerZh: "宏利", providerEn: "Manulife" }),
);
const hsbcNA = indexFund(fund({ nameZh: "北美股票基金", nameEn: "North American Equity Fund", providerZh: "滙豐", providerEn: "HSBC" }));
const fidelityCaf = indexFund(
  fund({ nameZh: "核心累積基金", nameEn: "Core Accumulation Fund", providerZh: "富達", providerEn: "Fidelity", trusteeZh: "滙豐", trusteeEn: "HSBC" }),
);
const hsbcCaf = indexFund(fund({ nameZh: "核心累積基金", nameEn: "Core Accumulation Fund", providerZh: "滙豐", providerEn: "HSBC" }));

test("normalize folds simplified characters, 匯/滙 and spacing", () => {
  assert.equal(normalize("汇丰 北美"), normalize("滙豐北美"));
  assert.equal(normalize("匯豐"), "滙豐");
  assert.equal(normalize("ＭＰＦ"), "mpf");
});

test("Chinese typed without the MPF infix still finds the fund", () => {
  assert.ok(scoreQuery("宏利北美", manulifeNA) > 0);
  assert.equal(scoreQuery("宏利北美", hsbcNA), 0);
});

test("company and fund typed as one word match provider + name", () => {
  assert.ok(scoreQuery("汇丰北美", hsbcNA) > 0);
  assert.equal(scoreQuery("汇丰北美", manulifeNA), 0);
});

test("the member's provider outranks a fund merely held by that trustee", () => {
  assert.ok(scoreQuery("hsbc core", hsbcCaf) > scoreQuery("hsbc core", fidelityCaf));
});

test("unknown words match nothing", () => {
  assert.equal(scoreQuery("xyz", manulifeNA), 0);
});
