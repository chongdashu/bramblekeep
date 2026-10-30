// The CDP driver's event listeners (tests/lib/cdp.mjs), which every browser check relies on to hear page
// errors. A game's tests once passed an event name to on(fn); the listener never fired and their error checks
// passed without checking. tests/smoke.mjs also proves it live: each session throws on purpose and expects to hear it.
//   node --test tests/release/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventListeners } from "../lib/cdp.mjs";

const exception = { method: "Runtime.exceptionThrown", params: { exceptionDetails: { text: "Uncaught Error: boom" } }, sessionId: "s1" };
const consoleError = { method: "Runtime.consoleAPICalled", params: { type: "error", args: [{ value: "bad" }] }, sessionId: "s1" };

describe("cdp eventListeners", () => {
  it("on(fn) hears every event as the raw message", () => {
    const { on, emit } = eventListeners();
    const heard = [];
    on((m) => heard.push(m.method));
    emit(exception);
    emit(consoleError);
    assert.deepEqual(heard, ["Runtime.exceptionThrown", "Runtime.consoleAPICalled"]);
  });

  it("on(method, fn) hears that method only, as its params and the message", () => {
    const { on, emit } = eventListeners();
    const heard = [];
    on("Runtime.exceptionThrown", (params, m) => heard.push([params.exceptionDetails.text, m.sessionId]));
    emit(consoleError);
    emit(exception);
    assert.deepEqual(heard, [["Uncaught Error: boom", "s1"]]);
  });

  it("throws a TypeError for anything that would never be called", () => {
    const { on } = eventListeners();
    for (const args of [["Runtime.exceptionThrown"], [], [null], ["", () => {}], [42, () => {}], [() => {}, () => {}], ["Log.entryAdded", "not a function"]]) {
      assert.throws(() => on(...args), TypeError, JSON.stringify(args.map((a) => typeof a)));
    }
  });

  it("returns an unsubscribe function, and a listener may unsubscribe while being called", () => {
    const { on, emit } = eventListeners();
    const heard = [];
    const off = on(() => {
      heard.push("once");
      off();
    });
    on("Runtime.exceptionThrown", () => heard.push("method"));
    emit(exception);
    emit(exception);
    assert.deepEqual(heard, ["once", "method", "method"]);
  });

  it("a session's registry hears only its own session", () => {
    const { on, emit } = eventListeners((m) => m.sessionId === "s2");
    const heard = [];
    on((m) => heard.push(m.sessionId));
    emit(exception);
    emit({ ...exception, sessionId: "s2" });
    assert.deepEqual(heard, ["s2"]);
  });
});
