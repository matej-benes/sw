'use server';
/**
 * @fileOverview This file defines a Genkit flow for creating a Firebase user on the server.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const CreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string(),
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

/**
 * A server-side flow to create a Firebase user using the Admin SDK.
 * This avoids the client-side issue of automatically signing in the new user.
 *
 * @param {CreateUserInput} input - The user's email, password, and display name.
 * @returns {Promise<CreateUserOutput>} A promise that resolves with the new user's UID.
 */
export const createUser = ai.defineFlow(
  {
    name: 'createUserFlow',
    inputSchema: CreateUserInputSchema,
    outputSchema: CreateUserOutputSchema,
  },
  async (input) => {
    try {
      const userRecord = await getAuth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });

      return { uid: userRecord.uid };
    } catch (error: any) {
      console.error('Error creating user:', error);
      // It's important to throw the error so the client-side can catch it.
      throw new Error(error.message || 'Failed to create user.');
    }
  }
);
