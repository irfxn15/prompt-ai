# PROMPT_AI

**Turn "I have an idea" into "here's exactly what to build, with what, and in what order."**

PROMPT_AI is a planning assistant for anyone who wants to build an app or AI project but doesn't know where to start. You type your idea in one line. The app asks smart follow-up questions (you just click answers), then generates a complete build plan with ready-to-paste prompts.

**Live demo:** _add your Render link here after deploying_

---

## What you get

- **Feasibility check:** an honest verdict (Realistic, Stretch, or Research-grade) with strengths, risks and cost estimates
- **Tech stack:** chosen for your needs, with reasons, cost, and an alternative for each layer
- **Roadmap:** step-by-step phases from setup to launch, with a "Stuck here? See alternatives" option on every phase and a "Mark done" tracker
- **Prompts:** one copy-paste prompt per phase for an AI coding assistant (Claude, ChatGPT, etc.), including folder structure and fallback steps
- **Export:** download the full plan as Markdown or save it as PDF
- **History:** every plan is saved automatically in your browser so you can reopen it later

## How it works

1. You enter an idea.
2. The server asks an AI model for the single most useful next question, based on your idea and earlier answers (about 7 to 10 questions in total).
3. When enough is known, the model produces the full plan as structured JSON.
4. The web page renders it as tabs: Analysis, Tech stack, Roadmap, Prompts, Export.

## Tech stack

- **Frontend:** a single HTML file (vanilla JavaScript and CSS, no build step)
- **Backend:** Node.js with Express
- **AI:** Google Gemini API (free tier) by default, with Anthropic Claude as an optional alternative
- **Storage:** browser `localStorage` (no database needed)

---

## Before you start: requirements

| You need | Why | How to get it |
|---|---|---|
| **Node.js 18 or newer** (includes npm) | Runs the server | Windows: `winget install OpenJS.NodeJS.LTS`, or download from nodejs.org |
| **A free Gemini API key** | Powers the AI questions and plans | Sign in at https://aistudio.google.com/apikey and click **Create API key** (no card needed) |
| **Git** (only if you want to deploy) | Uploads the code to GitHub | Windows: `winget install Git.Git` |
| **A GitHub account** (only to deploy) | Render deploys from GitHub | https://github.com |

After installing Node.js or Git, **close and reopen your terminal** so the new commands are found.

Check your setup:

```
node -v
npm -v
```

Both should print version numbers (Node 18 or higher).

---

## Run it on your computer

1. **Download the project.** Clone it, or unzip the download:
   ```
   git clone https://github.com/irfxn15/prompt-ai.git
   cd prompt-ai
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Create your settings file.** Copy the example:
   ```
   copy .env.example .env
   ```
   (macOS/Linux: `cp .env.example .env`)

4. **Add your API key.** Open the file:
   ```
   notepad .env
   ```
   Make it look like this, with your real key and no quotes or spaces:
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3000
   ```
   Save the file.

5. **Start the app:**
   ```
   npm start
   ```

6. **Open** http://localhost:3000 in your browser.

After editing `.env`, always stop the server (**Ctrl+C**) and start it again, because settings are read only at startup.

---

## Settings (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (or Anthropic key) | none | Your free key from Google AI Studio |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name. If you get "model not found," pick a Flash model available in AI Studio |
| `ANTHROPIC_API_KEY` | No | none | Used only if `GEMINI_API_KEY` is empty (paid) |
| `MODEL` | No | `claude-sonnet-5-5` | Anthropic model name when using the Anthropic key |
| `PORT` | No | `3000` | Port the server listens on |
| `DAILY_CAP` | No | `600` | Total API requests allowed per day across all visitors |

**Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## Project structure

```
PROMPT_AI/
├── server.js          Express server, AI calls, rate limits
├── public/
│   └── index.html     The entire frontend
├── package.json       Dependencies and start script
├── .env.example       Template for your settings
├── .gitignore         Keeps .env and node_modules out of Git
└── README.md
```

---

## Deploy for free on Render

1. **Push the project to GitHub.** Make sure `.env` is **not** in the repository (check with `git ls-files`).
2. Create a free account at https://render.com and sign in with GitHub.
3. Click **New**, then **Web Service**, and select your repository.
4. Use these settings:
   - Language: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` = your key (use a fresh key just for the live app)
   - `GEMINI_MODEL` = `gemini-2.5-flash`
6. Click **Create Web Service**. After a few minutes you get a public `onrender.com` link.

**Good to know about the free tier:**
- The service goes to sleep after 15 minutes without visitors, and the next visit takes about a minute to wake it. Open the link yourself before sharing it.
- Free instance hours are limited per month.
- The Gemini free tier has its own request limits and may use inputs to improve Google products, so tell users not to enter private information.

---

## Built-in protection

To protect your free quota when the link is public:

- Each visitor (by network address) is limited to **5 full plans per hour** and **60 questions per hour**.
- The whole app has a **daily cap** (`DAILY_CAP`, default 600 requests).
- API keys stay on the server and are never sent to the browser.

You can change these numbers in `server.js`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `'npm' is not recognized` | Install Node.js, then close and reopen the terminal |
| "No key found" | `.env` is missing or the key is in the wrong file. Make sure the file is named exactly `.env` (not `.env.txt` or `.env.example`) and restart the server |
| "API key not valid" or "invalid x-api-key" | The key is wrong, incomplete, or has quotes or spaces. Create a new one and paste it again |
| "Model not found" | Change `GEMINI_MODEL` to a Flash model listed in AI Studio |
| Quota or 429 errors | Wait a minute and click **Try again**. The free tier is rate-limited |
| "Empty reply" or JSON errors | Click **Try again**. The server retries automatically, but the model can occasionally return a bad reply |
| `.env` blocked when pushing to GitHub | GitHub caught your key. Do not allow it. Remove `.env` from Git, confirm `.gitignore` lists it, create a new key, and push again |
| History disappeared | History lives in your browser. Clearing browser data or switching browsers or computers removes it |

---

## Security notes

- Keep your API key private. Never paste it in chats, screenshots, or code.
- If a key is ever exposed, delete it at https://aistudio.google.com/apikey and create a new one.
- Use a separate key for the deployed app and for local testing.

---

## Ideas for the future

- PowerPoint export
- Accounts and cloud-saved history
- Live pricing lookups for tools and APIs
- Choice of AI providers in the interface
- Light theme

---

## License

MIT. Use it, change it, and learn from it.
