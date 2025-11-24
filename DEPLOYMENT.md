# Deployment Guide for ElysAI

ElysAI consists of two parts that need to be deployed separately:
1.  **The Web App (Next.js)**: Deploys to **Vercel**.
2.  **The AI Bridge (WebSocket Server)**: Deploys to **Render** (or Railway/Fly.io).

---

## Part 1: Deploy the Bridge (Backend)

The Bridge handles the real-time voice connection between Retell AI and Groq. It must run on a server that supports WebSockets.

### Option A: Deploy to Render (Recommended for Free Tier)
1.  Push your code to GitHub.
2.  Sign up at [render.com](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings**:
    *   **Name**: `elysai-bridge`
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm run start:bridge`
6.  **Environment Variables**:
    *   Add `GROQ_API_KEY`: (Paste your Groq API Key)
7.  Click **Deploy**.
8.  **Copy the URL**: Once deployed, copy the service URL (e.g., `https://elysai-bridge.onrender.com`).

---

## Part 2: Configure Retell AI

You need to tell Retell where your new Bridge is located.

1.  Log in to your [Retell AI Dashboard](https://console.retellai.com/).
2.  Go to **Agents** and select your agent.
3.  Find the **LLM / WebSocket URL** setting.
4.  Update it to your **Bridge URL** from Part 1.
    *   Format: `wss://<your-bridge-url>/` (Replace `https://` with `wss://`)
    *   Example: `wss://elysai-bridge.onrender.com`

---

## Part 3: Deploy the Web App (Frontend)

Now deploy the main application to Vercel.

1.  Go to [vercel.com](https://vercel.com) and sign up/login.
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Environment Variables**:
    You must add the following variables in the Vercel dashboard:
    *   `DATABASE_URL`: Your PostgreSQL connection string (e.g., from Supabase, Neon, or Railway).
    *   `NEXTAUTH_SECRET`: A random string (generate one with `openssl rand -base64 32`).
    *   `NEXTAUTH_URL`: Your Vercel domain (e.g., `https://elysai.vercel.app`).
    *   `RETELL_API_KEY`: Your Retell API Key.
    *   `RETELL_AGENT_ID`: Your Retell Agent ID.
    *   `GROQ_API_KEY`: Your Groq API Key.
    *   `GOOGLE_CLIENT_ID`: (If using Google Auth)
    *   `GOOGLE_CLIENT_SECRET`: (If using Google Auth)
5.  Click **Deploy**.

---

## Troubleshooting

*   **Database**: Ensure your database is accessible from the internet (not just localhost). If you are using a local Postgres, you must migrate to a cloud provider like **Supabase** or **Neon**.
*   **Bridge Connection**: If the AI doesn't respond, check the Retell Dashboard logs to see if it's failing to connect to your Bridge URL.
