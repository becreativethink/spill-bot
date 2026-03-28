const { Telegraf, Markup } = require('telegraf');
const { getUser, saveUser, saveConnector, getConnector, encrypt, decrypt } = require('./firebase');
const { generateResponse } = require('./ai_engine');
const { executeTask, getConnectorFields } = require('./connectors');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const FREE_LIMIT = parseInt(process.env.FREE_LIMIT || 4);

// Start Command
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    
    await ctx.reply(
        `Welcome to Spill, ${ctx.from.first_name}! 🚀\n\nI am your autonomous AI agent. I can connect to your services like Gmail, Google Drive, and GitHub to execute tasks on your behalf.\n\nLet's get started!`,
        Markup.inlineKeyboard([
            Markup.button.callback('Start Setup 🛠️', 'start_setup')
        ])
    );
});

// Setup Flow - Start Setup
bot.action('start_setup', async (ctx) => {
    await ctx.reply(
        'Step 1: Choose Connectors\nSelect one or more services you want to connect:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Gmail 📧', 'setup_connector_gmail')],
            [Markup.button.callback('Google Drive 📂', 'setup_connector_googledrive')],
            [Markup.button.callback('GitHub 🐙', 'setup_connector_github')],
            [Markup.button.callback('Done Choosing ✅', 'setup_ai_config')]
        ])
    );
});

// Setup Flow - Connector Selection
const connectors = ['gmail', 'googledrive', 'github'];
connectors.forEach(conn => {
    bot.action(`setup_connector_${conn}`, async (ctx) => {
        const userId = ctx.from.id;
        const fields = getConnectorFields(conn);
        
        await saveUser(userId, { setupStep: `waiting_api_${conn}` });
        await ctx.reply(`Please paste your ${fields.label} to connect ${conn.charAt(0).toUpperCase() + conn.slice(1)}:`);
    });
});

// Setup Flow - AI Config Choice
bot.action('setup_ai_config', async (ctx) => {
    await ctx.reply(
        'Step 3: AI Configuration\nDo you want to use your own AI API or continue with free default?',
        Markup.inlineKeyboard([
            [Markup.button.callback('Use Default (Free - 4 limit)', 'ai_config_default')],
            [Markup.button.callback('Use Custom API ⚙️', 'ai_config_custom')]
        ])
    );
});

bot.action('ai_config_default', async (ctx) => {
    const userId = ctx.from.id;
    await saveUser(userId, { 
        aiConfig: { type: 'default' },
        setupStep: 'ready'
    });
    await ctx.reply('Setup Complete! ✅\nYou are now using the default Hugging Face AI (Qwen 2.5 7B).', 
        Markup.inlineKeyboard([Markup.button.callback('Run Task 🚀', 'run_task')])
    );
});

bot.action('ai_config_custom', async (ctx) => {
    await ctx.reply(
        'Which provider do you prefer?',
        Markup.inlineKeyboard([
            [Markup.button.callback('OpenAI', 'custom_ai_provider_openai')],
            [Markup.button.callback('Gemini', 'custom_ai_provider_gemini')],
            [Markup.button.callback('Claude', 'custom_ai_provider_claude')],
            [Markup.button.callback('OpenRouter', 'custom_ai_provider_openrouter')]
        ])
    );
});

const providers = ['openai', 'gemini', 'claude', 'openrouter'];
providers.forEach(provider => {
    bot.action(`custom_ai_provider_${provider}`, async (ctx) => {
        const userId = ctx.from.id;
        await saveUser(userId, { 
            tempAiProvider: provider,
            setupStep: 'waiting_custom_model' 
        });
        await ctx.reply(`Enter model name for ${provider} (e.g., gpt-4o, gemini-1.5-pro):`);
    });
});

// Run Task Flow
bot.action('run_task', async (ctx) => {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    
    if (user.aiConfig.type === 'default' && user.messageCount >= FREE_LIMIT) {
        return ctx.reply('Free limit reached! 🛑\nPlease switch to a custom API to continue using Spill.', 
            Markup.inlineKeyboard([Markup.button.callback('Setup Custom API', 'ai_config_custom')])
        );
    }
    
    await saveUser(userId, { setupStep: 'waiting_task_prompt' });
    await ctx.reply('Enter your task prompt (e.g., "Summarize my latest Gmail emails"):');
});

// Message Handler for Setup and Task Prompts
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const user = await getUser(userId);
    
    // Check setup steps
    if (user.setupStep && user.setupStep.startsWith('waiting_api_')) {
        const conn = user.setupStep.replace('waiting_api_', '');
        await saveConnector(userId, conn, text);
        await saveUser(userId, { setupStep: null });
        await ctx.reply(`${conn.charAt(0).toUpperCase() + conn.slice(1)} connected successfully! ✅`, 
            Markup.inlineKeyboard([Markup.button.callback('Add more / Continue', 'start_setup')])
        );
    } 
    else if (user.setupStep === 'waiting_custom_model') {
        await saveUser(userId, { 
            tempAiModel: text,
            setupStep: 'waiting_custom_key' 
        });
        await ctx.reply('Enter your API key:');
    }
    else if (user.setupStep === 'waiting_custom_key') {
        const aiConfig = {
            type: 'custom',
            provider: user.tempAiProvider,
            model: user.tempAiModel,
            apiKey: text
        };
        await saveUser(userId, { 
            aiConfig,
            setupStep: 'ready',
            tempAiProvider: null,
            tempAiModel: null
        });
        await ctx.reply('Custom AI configured successfully! ✅', 
            Markup.inlineKeyboard([Markup.button.callback('Run Task 🚀', 'run_task')])
        );
    }
    else if (user.setupStep === 'waiting_task_prompt') {
        // Increment message count for free users
        if (user.aiConfig.type === 'default') {
            const newCount = (user.messageCount || 0) + 1;
            await saveUser(userId, { messageCount: newCount });
        }
        
        await ctx.reply('Thinking... 🧠');
        
        try {
            // 1. Let AI decide which connector to use
            const systemPrompt = `You are Spill, an autonomous AI agent.
            Available connectors: Gmail, GoogleDrive, GitHub.
            The user wants to: "${text}".
            Decide which connector is needed. Respond with ONLY the connector name (lowercase) or 'none' if no connector is needed.`;
            
            const decision = await generateResponse(user, text, systemPrompt);
            const connectorName = decision.toLowerCase().trim();
            
            let result;
            if (connectors.includes(connectorName)) {
                const apiKey = await getConnector(userId, connectorName);
                if (!apiKey) {
                    result = `I need to use ${connectorName}, but it's not connected. Please set it up first.`;
                } else {
                    result = await executeTask(user, text, connectorName, apiKey);
                }
            } else {
                // Regular AI response
                result = await generateResponse(user, text);
            }
            
            await ctx.reply(result, Markup.inlineKeyboard([
                [Markup.button.callback('Retry 🔄', 'run_task')],
                [Markup.button.callback('New Task 🚀', 'run_task')]
            ]));
            
            await saveUser(userId, { setupStep: 'ready' });
        } catch (error) {
            console.error("Task Error:", error);
            await ctx.reply('Something went wrong. Try again or contact support.', 
                Markup.inlineKeyboard([Markup.button.callback('Retry 🔄', 'run_task')])
            );
        }
    }
});

bot.launch().then(() => {
    console.log('Spill Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
