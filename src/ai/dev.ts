import { config } from 'dotenv';
config();

import '@/ai/flows/generate-communication-message.ts';
import '@/ai/flows/generate-grade-summary.ts';
import '@/ai/flows/draft-message-to-parents.ts';
import '@/ai/flows/create-user.ts';
