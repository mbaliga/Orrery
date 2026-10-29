/* providers: bring your own key.
   Orrery has no model of its own and holds nobody's key. A model is a thing you attach: Claude, ChatGPT, DeepSeek or
   Grok through the key you own, or Llama through an endpoint you run (Ollama, llama.cpp, Fonebrew's local server — on
   this device or this network). Four rules, the same as Aarso's:
     1. Local is the default. A hosted model is opt-in per use, and every hosted provider is a *watched object*: the
        page says so wherever it is named, and shows exactly what will be sent before it is.
     2. A key is encrypted at rest (AES-GCM, a key derived from a passphrase that is kept in memory only) and is sent
        nowhere but to the provider it belongs to. It is never logged, exported or written into a note.
     3. The model answers from facts the page retrieved from your own graph and says which; it is not asked to know you.
     4. Every call is counted in the usage ledger.
   The pure core (request builders, reply readers, the vault) runs in node too (scan/providertest.js). */
(function (root) {
  'use strict';
  var P = {
    claude:   { name: 'Claude',  kind: 'anthropic', base: 'https://api.anthropic.com/v1',  model: 'claude-sonnet-5-5', host: 'api.anthropic.com', watched: true,  needsKey: true },
    chatgpt:  { name: 'ChatGPT', kind: 'openai',    base: 'https://api.openai.com/v1',     model: '',                  host: 'api.openai.com',    watched: true,  needsKey: true,  hint: 'a model name from your OpenAI account' },
    deepseek: { name: 'DeepSeek', kind: 'openai',   base: 'https://api.deepseek.com',      model: 'deepseek-chat',     host: 'api.deepseek.com',  watched: true,  needsKey: true },
    grok:     { name: 'Grok',    kind: 'openai',    base: 'https://api.x.ai/v1',           model: '',                  host: 'api.x.ai',          watched: true,  needsKey: true,  hint: 'a model name from your xAI account' },
    llama:    { name: 'Llama',   kind: 'openai',    base: 'http://localhost:11434/v1',     model: 'llama3.2',          host: 'your endpoint',     watched: false, needsKey: false, endpoint: true }
  };
  var ORDER = ['llama', 'claude', 'chatgpt', 'deepseek', 'grok'];   // local first

  // ---------------------------------------------------------------- the request and the reply
  function build(id, cfg, system, user) {
    var p = P[id], base = String(cfg.base || p.base).replace(/\/+$/, ''), model = cfg.model || p.model;
    if (p.kind === 'anthropic') return { url: base + '/messages', headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: { model: model, max_tokens: 700, system: system, messages: [{ role: 'user', content: user }] } };
    var h = { 'content-type': 'application/json' }; if (cfg.key) h.authorization = 'Bearer ' + cfg.key;
    return { url: base + '/chat/completions', headers: h, body: { model: model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] } };
  }
  function read(id, j) {
    var p = P[id], u = j && j.usage || {}, text = '';
    if (p.kind === 'anthropic') { text = (j.content || []).map(function (c) { return c.text || ''; }).join(''); return { text: text.trim(), model: j.model, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 } }; }
    var ch = j.choices && j.choices[0]; text = ch && ch.message && ch.message.content || '';
    var cr = u.prompt_cache_hit_tokens || (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0;
    return { text: String(text).trim(), model: j.model, usage: { in: Math.max(0, (u.prompt_tokens || 0) - cr), out: u.completion_tokens || 0, cr: cr, cw: 0 } };
  }
  function modelsReq(id, cfg) {
    var p = P[id], base = String(cfg.base || p.base).replace(/\/+$/, '');
    return { url: base + '/models', headers: p.kind === 'anthropic' ? { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : (cfg.key ? { authorization: 'Bearer ' + cfg.key } : {}) };
  }
  function modelNames(j) { var a = (j && (j.data || j.models)) || []; return a.map(function (m) { return m.id || m.name; }).filter(Boolean); }
  function describeError(id, status, text) {
    var p = P[id], msg = ''; try { var j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || j.message || ''; } catch (e) {}
    if (status === 401 || status === 403) return p.name + ' did not accept the key' + (msg ? ' (' + String(msg).slice(0, 120) + ')' : '') + '.';
    if (status === 404) return p.name + ' does not know that model name. Test the key to list the names it has.';
    if (status === 429) return p.name + ' says you are over its rate or spend limit just now.';
    return p.name + ' answered ' + status + (msg ? ': ' + String(msg).slice(0, 140) : '') + '.';
  }

  // ---------------------------------------------------------------- the vault: AES-GCM under a passphrase kept in memory
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  var subtle = function () { return (root.crypto || require('crypto').webcrypto).subtle; };
  var rnd = function (n) { var a = new Uint8Array(n); (root.crypto || require('crypto').webcrypto).getRandomValues(a); return a; };
  function derive(pass, salt) {
    var te = new TextEncoder();
    return subtle().importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return subtle().deriveKey({ name: 'PBKDF2', salt: salt, iterations: 250000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function enc(key, text) { var iv = rnd(12); return subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text)).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; }); }
  function dec(key, o) { return subtle().decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct)).then(function (pt) { return new TextDecoder().decode(pt); }); }

  var API = { PROVIDERS: P, ORDER: ORDER, build: build, read: read, modelsReq: modelsReq, modelNames: modelNames, describeError: describeError, derive: derive, enc: enc, dec: dec, b64: b64, unb64: unb64 };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // ---------------------------------------------------------------- the page
  var T = root.T;
  var V = T.store.get('keyvault', { salt: null, check: null, keys: {} });      // ciphertext only
  var CFG = T.store.get('llm', { models: {}, bases: {}, def: '', confirm: true });
  var MEM = { pass: null, aes: null, keys: {} };                                // in memory only; gone on reload
  function saveV() { T.store.set('keyvault', V); }
  function saveC() { T.store.set('llm', CFG); T.emit('llm'); }

  T.llm = {
    list: function () { return ORDER.map(function (id) { return Object.assign({ id: id }, P[id]); }); },
    cfg: function (id) { return { model: CFG.models[id] || P[id].model, base: CFG.bases[id] || P[id].base }; },
    hasKey: function (id) { return !!(MEM.keys[id] || V.keys[id]); },
    locked: function () { return !!(V.check && !MEM.aes); },
    sessionOnly: function (id) { return !!MEM.keys[id] && !V.keys[id]; },
    ready: function (id) { var p = P[id]; if (p.needsKey) return T.llm.hasKey(id) && !(V.keys[id] && !MEM.keys[id] && T.llm.locked()); return !!(CFG.bases[id] || CFG.models[id]); },
    configured: function () { return ORDER.filter(T.llm.ready); },
    def: function () { var c = T.llm.configured(); return c.indexOf(CFG.def) >= 0 ? CFG.def : c[0] || ''; },
    setDefault: function (id) { CFG.def = id; saveC(); },
    confirm: function () { return CFG.confirm !== false; },
    setConfirm: function (v) { CFG.confirm = !!v; saveC(); },
    setModel: function (id, v) { CFG.models[id] = String(v || '').trim(); saveC(); },
    setBase: function (id, v) { v = String(v || '').trim(); if (v && !/^https?:\/\//.test(v)) { T.toast('An endpoint starts with http:// or https://'); return; } CFG.bases[id] = v; saveC(); },
    // the passphrase: derives the key; nothing of it is kept but the key, in memory
    unlock: function (pass) {
      pass = String(pass || ''); if (pass.length < 6) { T.toast('A passphrase of at least six characters.'); return Promise.resolve(false); }
      var salt = V.salt ? unb64(V.salt) : rnd(16);
      return derive(pass, salt).then(function (k) {
        if (V.check) return dec(k, V.check).then(function (t) { if (t !== 'orrery') throw 0; return k; });
        return enc(k, 'orrery').then(function (c) { V.salt = b64(salt); V.check = c; return k; });
      }).then(function (k) {
        MEM.aes = k; MEM.pass = true; saveV();
        var ids = Object.keys(V.keys);
        return Promise.all(ids.map(function (id) { return dec(k, V.keys[id]).then(function (t) { MEM.keys[id] = t; }, function () {}); }));
      }).then(function () { T.toast('Unlocked for this session.'); T.emit('llm'); return true; }, function () { T.toast('That passphrase does not open the keys.'); return false; });
    },
    lock: function () { MEM = { pass: null, aes: null, keys: {} }; T.emit('llm'); },
    setKey: function (id, key) {
      key = String(key || '').trim(); if (!key) return Promise.resolve();
      MEM.keys[id] = key;
      if (!MEM.aes) { T.toast(P[id].name + ' key held for this session only. Set a passphrase to keep it, encrypted, on this device.'); T.emit('llm'); return Promise.resolve(); }
      return enc(MEM.aes, key).then(function (c) { V.keys[id] = c; saveV(); T.toast(P[id].name + ' key kept, encrypted.'); T.emit('llm'); });
    },
    forget: function (id) { delete MEM.keys[id]; delete V.keys[id]; saveV(); T.emit('llm'); },
    forgetAll: function () { MEM = { pass: null, aes: null, keys: {} }; V = { salt: null, check: null, keys: {} }; saveV(); T.emit('llm'); },
    // a test: list the models the key can see
    test: function (id) {
      var c = T.llm.cfg(id), r = modelsReq(id, { base: c.base, key: MEM.keys[id] });
      return fetch(r.url, { headers: r.headers }).then(function (res) { return res.text().then(function (t) {
        if (!res.ok) throw new Error(describeError(id, res.status, t));
        var names = modelNames(JSON.parse(t)); return { names: names, has: !c.model || names.indexOf(c.model) >= 0 };
      }); });
    },
    // the exact request, as text, for the sheet — the key is never in it
    preview: function (id, system, user) {
      var c = T.llm.cfg(id), r = build(id, { base: c.base, model: c.model, key: '•••' }, system, user);
      return { to: r.url, model: r.body.model, text: 'To ' + r.url + '\nModel ' + r.body.model + '\n\n[system]\n' + system + '\n\n[question and facts]\n' + user, chars: system.length + user.length };
    },
    chat: function (id, system, user) {
      var c = T.llm.cfg(id), r = build(id, { base: c.base, model: c.model, key: MEM.keys[id] }, system, user), ac = typeof AbortController !== 'undefined' ? new AbortController() : null, to = setTimeout(function () { ac && ac.abort(); }, 90000);
      return fetch(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body), signal: ac && ac.signal }).then(function (res) { return res.text().then(function (t) {
        clearTimeout(to);
        if (!res.ok) throw new Error(describeError(id, res.status, t));
        var out = read(id, JSON.parse(t)); if (T.usageNote) T.usageNote({ provider: id, model: out.model || c.model, usage: out.usage });
        return out;
      }); }, function (e) { clearTimeout(to); throw new Error(P[id].name + ' could not be reached' + (id === 'llama' ? ' at ' + c.base + '. Is it running, and does it allow this page’s origin (Ollama: OLLAMA_ORIGINS)?' : ' (' + (e && e.name === 'AbortError' ? 'it took too long' : 'blocked or offline') + ').')); });
    }
  };
})(typeof window !== 'undefined' ? window : this);
