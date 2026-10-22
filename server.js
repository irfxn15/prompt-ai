require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.MODEL || 'claude-sonnet-5-5';

const GKEY = process.env.GEMINI_API_KEY;
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

app.post('/api/next', async (req, res) => {
  try {
    const { idea, answers = [] } = req.body;
    if (answers.length >= MAXQ) return res.json({ done: true });
    const sys = `You are a senior product architect interviewing someone who wants to build software or an AI system. Ask ONE next question, the most valuable unanswered one, chosen from: target users, platform (web/mobile), UI style, core features, AI/model or API approach (pretrained vs paid API vs custom), data and database, auth, budget, deployment and launch, timeline, builder's experience level. Adapt to the idea and earlier answers; never repeat. Questions must be answerable by clicking. Give 4-6 short options. Use type "multi" when several can apply, else "single". Return {"done":true} once you have asked at least 7 questions and know enough. Reply with JSON only: {"done":false,"question":{"text":"","why":"one line on why this matters","type":"single|multi","options":[]}}`;
    res.json(await ask(sys, ctx(idea, answers), 900));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/plan', async (req, res) => {
  try {
    const { idea, answers = [] } = req.body;
    const sys = `You are a principal engineer and product strategist. From the idea and answers, produce a complete plan. Choose the tech stack yourself, matching the stated needs (UI ambition, scale, budget, experience). Be honest about feasibility: say what is realistic, what is research-grade, and the practical version. Give real, current-style cost estimates and mark them as estimates. Include 5-8 roadmap phases from setup through deployment and launch (extend to launch/market only if the user wants it). Every phase needs a fallback (what to do if blocked and what changes). Write one self-contained, copy-paste prompt per phase for an AI coding assistant, including the folder structure, the exact deliverable, the chosen stack, and a clause for what to do if a step fails (alternative approach and expected outcome). Reply with JSON only in this shape:
{"title":"","summary":"","feasibility":{"verdict":"Realistic|Stretch|Research-grade","notes":""},"strengths":[],"risks":[],"costs":{"build":"","monthly":"","notes":""},"stack":[{"layer":"","choice":"","why":"","cost":"","alternative":""}],"roadmap":[{"title":"","duration":"","tasks":[],"outcome":"","fallback":{"if":"","then":"","changes":""}}],"prompts":[{"phase":"","prompt":""}]}`;
    res.json(await ask(sys, ctx(idea, answers), 12000));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 3000, () => console.log('Blueprint running at http://localhost:' + (process.env.PORT || 3000)));
