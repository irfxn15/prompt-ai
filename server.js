require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.set('trust proxy', 1);
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.MODEL || 'claude-sonnet-5-5', GKEY = process.env.GEMINI_API_KEY;
const SBU = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SBA = process.env.SUPABASE_ANON_KEY || '', SBS = process.env.SUPABASE_SERVICE_KEY || '';
app.get('/api/config', (q, r) => r.json({ url: SBU, anon: SBA }));

async function ask(system, user, max) {
  for (let i = 0; ; i++) {
    try { return await ask1(system, user, max); }
    catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
}
async function ask1(system, user, max) {
  let t;
  if (GKEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GKEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: Math.max(max * 4, 4096), responseMimeType: 'application/json', ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) }
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Gemini API error');
    t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!t) throw new Error('Empty reply from Gemini (' + (j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || 'unknown') + ')');
  } else {
    if (!KEY) throw new Error('No key found: set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in .env');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: 'user', content: user }] })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Anthropic API error');
    t = j.content.map(c => c.text || '').join('');
  }
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
const ctx = (idea, answers) => `Idea: ${idea}\nAnswers so far:\n` + (answers.map((a, i) => `${i + 1}. ${a.q} -> ${a.a}`).join('\n') || '(none)');
const MAXQ = 10;

// ---- login check (Supabase) + usage log ----
const seen = new Map();
async function auth(req, res, next) {
  if (!SBU) return next(); // login not configured: open mode (local dev)
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: 'Please sign up or log in to continue.' });
  let u = seen.get(t);
  if (!u || Date.now() - u.at > 60000) {
    try {
      const r = await fetch(SBU + '/auth/v1/user', { headers: { apikey: SBA, Authorization: 'Bearer ' + t } });
      if (!r.ok) return res.status(401).json({ error: 'Your session expired. Please log in again.' });
      const j = await r.json();
      u = { id: j.id, email: j.email, at: Date.now() }; seen.set(t, u);
    } catch { return res.status(503).json({ error: 'Login service unavailable. Try again.' }); }
  }
  req.user = u; next();
}
function log(u, action, idea) {
  if (!SBU || !SBS || !u) return;
  fetch(SBU + '/rest/v1/usage', { method: 'POST', headers: { apikey: SBS, Authorization: 'Bearer ' + SBS, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: u.id, email: u.email, action, idea: String(idea || '').slice(0, 300) }) }).catch(() => {});
}

// ---- protection ----
const hits = new Map();
const limit = (name, max, ms) => (req, res, next) => {
  const k = name + (req.user?.id || req.ip), now = Date.now();
  const a = (hits.get(k) || []).filter(t => now - t < ms);
  if (a.length >= max) return res.status(429).json({ error: 'Too many requests. Please try again in a while.' });
  a.push(now); hits.set(k, a); next();
};
let dayCount = 0, dayStart = Date.now();
app.use('/api', (req, res, next) => {
  if (Date.now() - dayStart > 864e5) { dayCount = 0; dayStart = Date.now(); }
  if (++dayCount > (+process.env.DAILY_CAP || 600)) return res.status(429).json({ error: 'Daily demo limit reached. Please come back tomorrow.' });
  next();
});
app.use('/api/next', auth, limit('n', 60, 36e5));
app.use('/api/plan', auth, limit('p', 5, 36e5));

app.post('/api/next', async (req, res) => {
  try {
    const { idea, answers = [] } = req.body;
    if (answers.length >= MAXQ) return res.json({ done: true });
    const sys = `You are a senior product architect interviewing someone who wants to build software or an AI system. Ask ONE next question, the most valuable unanswered one, chosen from: target users, platform (web/mobile), UI style, core features, AI/model or API approach (pretrained vs paid API vs custom), data and database, auth, budget, deployment and launch, timeline, builder's experience level. Adapt to the idea and earlier answers; never repeat. Questions must be answerable by clicking. Give 4-6 short options. Use type "multi" when several can apply, else "single". Return {"done":true} once you have asked at least 7 questions and know enough. Reply with JSON only: {"done":false,"question":{"text":"","why":"one line on why this matters","type":"single|multi","options":[]}}`;
    const out = await ask(sys, ctx(idea, answers), 900);
    if (!answers.length) log(req.user, 'start', idea);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/plan', async (req, res) => {
  try {
    const { idea, answers = [] } = req.body;
    const sys = `You are a principal engineer and product strategist. From the idea and answers, produce a complete plan. Choose the tech stack yourself, matching the stated needs (UI ambition, scale, budget, experience). Be honest about feasibility: say what is realistic, what is research-grade, and the practical version. Give real, current-style cost estimates and mark them as estimates. Include 5-8 roadmap phases from setup through deployment and launch (extend to launch/market only if the user wants it). Every phase needs a fallback (what to do if blocked and what changes). Write one self-contained, copy-paste prompt per phase for an AI coding assistant, including the folder structure, the exact deliverable, the chosen stack, and a clause for what to do if a step fails (alternative approach and expected outcome). Reply with JSON only in this shape:
{"title":"","summary":"","feasibility":{"verdict":"Realistic|Stretch|Research-grade","notes":""},"strengths":[],"risks":[],"costs":{"build":"","monthly":"","notes":""},"stack":[{"layer":"","choice":"","why":"","cost":"","alternative":""}],"roadmap":[{"title":"","duration":"","tasks":[],"outcome":"","fallback":{"if":"","then":"","changes":""}}],"prompts":[{"phase":"","prompt":""}]}`;
    const out = await ask(sys, ctx(idea, answers), 12000);
    log(req.user, 'plan', idea);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 3000, () => console.log('PROMPT_AI running at http://localhost:' + (process.env.PORT || 3000)));
