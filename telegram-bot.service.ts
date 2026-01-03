/**
 * Telegram Bot Service
 * Complete Telegram bot implementation for Audityzer
 * Handles commands, callbacks, and message processing
 */

import axios from 'axios';
import { EventEmitter } from 'events';

export interface TelegramConfig {
  botToken: string;
  webhookUrl: string;
  apiBaseUrl?: string;
}

export interface TelegramMessage {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: any;
}

export interface TelegramUpdate {
  update_id: number;
  message?: any;
  callback_query?: any;
}

export class TelegramBotService extends EventEmitter {
  private botToken: string;
  private webhookUrl: string;
  private apiBaseUrl: string;
  private botUsername: string = '';

  constructor(config: TelegramConfig) {
    super();
    this.botToken = config.botToken;
    this.webhookUrl = config.webhookUrl;
    this.apiBaseUrl = config.apiBaseUrl || 'https://api.telegram.org';
  }

  /**
   * Initialize bot by setting webhook and getting bot info
   */
  async initialize(): Promise<void> {
    try {
      // Get bot info
      const botInfo = await this.getMe();
      this.botUsername = botInfo.username;
      console.log(`Bot initialized: @${this.botUsername}`);

      // Set webhook
      await this.setWebhook(this.webhookUrl);
      console.log(`Webhook set to: ${this.webhookUrl}`);
    } catch (error) {
      console.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/bot${this.botToken}/getMe`
      );
      return response.data.result;
    } catch (error) {
      console.error('Error getting bot info:', error);
      throw error;
    }
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(url: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiBaseUrl}/bot${this.botToken}/setWebhook`,
        { url }
      );
    } catch (error) {
      console.error('Error setting webhook:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook update
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallback(update.callback_query);
      }
    } catch (error) {
      console.error('Error handling update:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle text messages
   */
  private async handleMessage(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text;
    const userId = message.from.id;
    const username = message.from.username;

    console.log(`Message from @${username}: ${text}`);

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, userId, username);
    } else {
      this.emit('message', { chatId, text, userId, username });
    }
  }

  /**
   * Handle bot commands
   */
  private async handleCommand(
    chatId: number | string,
    command: string,
    userId: number,
    username: string
  ): Promise<void> {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        await this.sendMessage(chatId, this.getWelcomeMessage());
        break;

      case '/help':
        await this.sendMessage(chatId, this.getHelpMessage());
        break;

      case '/audit':
        await this.handleAuditCommand(chatId, command);
        break;

      case '/stats':
        await this.handleStatsCommand(chatId, userId);
        break;

      case '/settings':
        await this.sendSettingsKeyboard(chatId);
        break;

      case '/cancel':
        await this.sendMessage(chatId, 'Operation cancelled.');
        break;

      default:
        await this.sendMessage(
          chatId,
          `Unknown command: ${cmd}\nType /help for available commands.`
        );
    }
  }

  /**
   * Handle callback queries from inline buttons
   */
  private async handleCallback(callbackQuery: any): Promise<void> {
    const { id, from, data, message } = callbackQuery;
    const chatId = message.chat.id;

    try {
      await this.answerCallbackQuery(id);
      this.emit('callback', { chatId, data, userId: from.id });
    } catch (error) {
      console.error('Error handling callback:', error);
    }
  }

  /**
   * Handle /audit command
   */
  private async handleAuditCommand(
    chatId: number | string,
    command: string
  ): Promise<void> {
    const contractAddress = command.split(' ')[1];

    if (!contractAddress) {
      await this.sendMessage(
        chatId,
        'Please provide a contract address: /audit <address>'
      );
      return;
    }

    await this.sendMessage(
      chatId,
      `Starting audit for: ${contractAddress}\n⏳ Please wait...`
    );

    this.emit('audit_request', { chatId, contractAddress });
  }

  /**
   * Handle /stats command
   */
  private async handleStatsCommand(
    chatId: number | string,
    userId: number
  ): Promise<void> {
    await this.sendMessage(chatId, '📊 Fetching your statistics...');
    this.emit('stats_request', { chatId, userId });
  }

  /**
   * Send settings keyboard
   */
  private async sendSettingsKeyboard(chatId: number | string): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Language', callback_data: 'set_lang' }],
        [{ text: 'Notifications', callback_data: 'set_notif' }],
        [{ text: 'Privacy', callback_data: 'set_privacy' }],
      ],
    };

    await this.sendMessage(chatId, '⚙️ Settings:', keyboard);
  }

  /**
   * Send a message
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: any
  ): Promise<void> {
    try {
      const data: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      };

      if (replyMarkup) {
        data.reply_markup = replyMarkup;
      }

      await axios.post(
        `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`,
        data
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string
  ): Promise<void> {
    try {
      const data: any = { callback_query_id: callbackQueryId };
      if (text) {
        data.text = text;
        data.show_alert = false;
      }

      await axios.post(
        `${this.apiBaseUrl}/bot${this.botToken}/answerCallbackQuery`,
        data
      );
    } catch (error) {
      console.error('Error answering callback query:', error);
    }
  }

  /**
   * Get welcome message
   */
  private getWelcomeMessage(): string {
    return `Welcome to <b>Audityzer Bot</b> 🔍

I can help you:
• 🔒 Audit smart contracts
• 📊 View audit statistics
• ⚙️ Manage settings

Type /help for available commands.`;
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return `<b>Available Commands:</b>

/start - Start the bot
/audit &lt;address&gt; - Audit a smart contract
/stats - View your statistics
/settings - Manage preferences
/help - Show this message

<b>Examples:</b>
/audit 0x1234567890123456789012345678901234567890`;
  }
}

export default TelegramBotService;
