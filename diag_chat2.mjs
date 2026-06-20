import mongoose from 'mongoose';
import config from './config.js';
import { processChat } from './services/ai_chat_service.js';
await mongoose.connect(config.mongoUri);
const host = '6a3635eb75da0b861fbfa0f7', userId = '6a3635eb75da0b861fbfa0f6';
try {
  const r = await processChat({ hostId: host, userId, query: 'What can you help me with?', includeEmails: false });
  console.log('CHAT OK. answer:', (r.answer||'').slice(0,180));
} catch (e) {
  console.log('CHAT THREW:', e.message);
}
await mongoose.disconnect();
