'use server';
/**
 * @fileOverview Flow for creating a new Firebase Authentication user.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getAuth} from 'firebase-admin/auth';
import {initializeApp, getApps} from 'firebase-admin/app';

const CreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

const CreateUserOutputSchema = z.object({
  uid: z.string(),
});
export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;

// Initialize Firebase Admin SDK if not already initialized
if (!getApps().length) {
  initializeApp();
}

export async function createUser(input: CreateUserInput): Promise<CreateUserOutput> {
  return createUserFlow(input);
}

const createUserFlow = ai.defineFlow(
  {
    name: 'createUserFlow',
    inputSchema: CreateUserInputSchema,
    outputSchema: CreateUserOutputSchema,
  },
  async input => {
    try {
      const userRecord = await getAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });
      return {uid: userRecord.uid};
    } catch (error: any) {
      console.error('Error creating user:', error);
      // It's important to throw the error so the client-side can catch it.
      throw new Error(error.message || 'Failed to create user.');
    }
  }
);
