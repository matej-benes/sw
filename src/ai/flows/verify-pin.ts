'use server';

/**
 * @fileOverview A Genkit flow to securely verify a user's email and PIN.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const VerifyPinInputSchema = z.object({
  email: z.string().email(),
  pin: z.string(),
});

const VerifyPinOutputSchema = z.object({
  user: z.any().nullable(),
});

export async function verifyPin(
  input: z.infer<typeof VerifyPinInputSchema>
): Promise<z.infer<typeof VerifyPinOutputSchema>> {
  return verifyPinFlow(input);
}

const verifyPinFlow = ai.defineFlow(
  {
    name: 'verifyPinFlow',
    inputSchema: VerifyPinInputSchema,
    outputSchema: VerifyPinOutputSchema,
  },
  async ({ email, pin }) => {
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef
        .where('email', '==', email)
        .where('pin', '==', pin)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { user: null };
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      // Return user data along with the document ID
      return {
        user: {
          id: userDoc.id,
          ...userData,
        },
      };
    } catch (error: any) {
      console.error('Error verifying PIN:', error);
      // In case of an error, return null, client will handle it
      return { user: null };
    }
  }
);
