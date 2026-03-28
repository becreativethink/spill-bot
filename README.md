# Spill - Telegram AI Agent 🚀

Spill is an autonomous AI agent bot that executes tasks via Telegram. It connects to external services like Gmail, Google Drive, and GitHub using a plug-and-play connector system.

## Features
- **Telegram Interface**: Clean, button-driven UX.
- **Autonomous Agent**: Understands tasks and decides which connector to use.
- **Dynamic AI Provider**: Uses Hugging Face (Qwen 2.5 7B) by default, or user-provided OpenAI, Gemini, Claude, or OpenRouter keys.
- **Secure Storage**: Encrypted API keys stored in Firebase Realtime Database.
- **Limit System**: 4 free messages before requiring a custom API key.

## Tech Stack
- **Backend**: Node.js (Telegraf)
- **AI**: Hugging Face Inference API
- **Database**: Firebase Realtime Database
- **Security**: CryptoJS for API key encryption

## Setup & Deployment

### 1. Prerequisites
- Node.js (v18+)
- Firebase Project with Realtime Database enabled
- Telegram Bot Token (from @BotFather)
- Hugging Face API Key

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
HF_API_KEY=your_huggingface_api_key
FIREBASE_DATABASE_URL=your_firebase_database_url
ENCRYPTION_KEY=your_secret_encryption_key
DEFAULT_MODEL=Qwen/Qwen2.5-7B-Instruct
FREE_LIMIT=4
```

### 3. Installation
```bash
pnpm install
```

### 4. Running the Bot
```bash
node index.js
```

### 5. Deployment
You can deploy this bot to any Node.js hosting provider (Heroku, Render, DigitalOcean, or a VPS).
Make sure to set the environment variables in your hosting provider's dashboard.

## Security
All external API keys (Gmail, GitHub, etc.) are encrypted using AES before being stored in Firebase. They are decrypted only during task execution.

## License
MIT
