// providertest.js — request shapes, reply reading, errors, and the vault, for every provider.
const P = require('../src/providers.js'); let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const a = P.build('claude', { key: 'sk-ant-x', model: 'claude-sonnet-5-5' }, 'sys', 'q');
  ok(a.url === 'https://api.anthropic.com/v1/messages' && a.headers['x-api-key'] === 'sk-ant-x' && a.headers['anthropic-dangerous-direct-browser-access'] === 'true' && a.body.system === 'sys' && a.body.messages[0].content === 'q', 'Claude request: native messages API, key in x-api-key, browser header');
  for (const [id, host] of [['chatgpt', 'api.openai.com/v1/chat/completions'], ['deepseek', 'api.deepseek.com/chat/completions'], ['grok', 'api.x.ai/v1/chat/completions']]) {
    const r = P.build(id, { key: 'k', model: 'm' }, 's', 'u'); ok(r.url === 'https://' + host && r.headers.authorization === 'Bearer k' && r.body.messages.length === 2 && r.body.model === 'm', id + ' request: OpenAI-compatible at ' + host);
  }
  const l = P.build('llama', { model: 'llama3.2' }, 's', 'u'); ok(l.url === 'http://localhost:11434/v1/chat/completions' && !l.headers.authorization, 'Llama request: local endpoint, no key sent');
  const l2 = P.build('llama', { base: 'http://192.168.1.5:8080/v1/', model: 'x' }, 's', 'u'); ok(l2.url === 'http://192.168.1.5:8080/v1/chat/completions', 'Llama endpoint is the one you set, trailing slash tolerated');
  const ra = P.read('claude', { model: 'm', content: [{ type: 'text', text: ' hi ' }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 } }); ok(ra.text === 'hi' && ra.usage.in === 10 && ra.usage.cr === 100 && ra.usage.out === 5, 'Claude reply read with cache tokens');
  const ro = P.read('deepseek', { choices: [{ message: { content: 'yo' } }], usage: { prompt_tokens: 50, completion_tokens: 7, prompt_cache_hit_tokens: 30 } }); ok(ro.text === 'yo' && ro.usage.in === 20 && ro.usage.cr === 30 && ro.usage.out === 7, 'DeepSeek reply read, cache hits split out');
  const ro2 = P.read('chatgpt', { choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 40, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 8 } } }); ok(ro2.usage.in === 32 && ro2.usage.cr === 8, 'ChatGPT cached tokens split out');
  ok(/did not accept the key/.test(P.describeError('grok', 401, '{"error":{"message":"bad"}}')) && /does not know that model/.test(P.describeError('chatgpt', 404, '')) && /limit/.test(P.describeError('claude', 429, '')), 'errors are said plainly');
  ok(P.modelNames({ data: [{ id: 'a' }, { id: 'b' }] }).length === 2, 'model list read');
  // vault
  const salt = new Uint8Array(16).fill(7), k = await P.derive('correct horse', salt), c = await P.enc(k, 'sk-secret'), k2 = await P.derive('correct horse', salt), k3 = await P.derive('wrong horse', salt);
  ok(!JSON.stringify(c).includes('secret') && (await P.dec(k2, c)) === 'sk-secret', 'vault: ciphertext holds no plaintext; the right passphrase opens it');
  let bad = false; try { await P.dec(k3, c); } catch (e) { bad = true; } ok(bad, 'vault: the wrong passphrase does not');
  const c2 = await P.enc(k, 'sk-secret'); ok(c.iv !== c2.iv && c.ct !== c2.ct, 'vault: a fresh nonce each time');
  process.exit(fail ? 1 : 0);
})();
