'use server';

/**
 * @fileOverview A Genkit flow to securely verify a user's PIN.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';


const VerifyPinInputSchema = z.object({
  pin: z.string(),
});

const VerifyPinOutputSchema = z.object({
  user: z.any().nullable(),
});

export async function verifyPinByPin(
  input: z.infer<typeof VerifyPinInputSchema>
): Promise<z.infer<typeof VerifyPinOutputSchema>> {
  // This is a wrapper, the actual implementation is in the flow.
  // We are keeping this structure for consistency.
  return verifyPinFlow(input);
}

const verifyPinFlow = ai.defineFlow(
  {
    name: 'verifyPinByPinFlow',
    inputSchema: VerifyPinInputSchema,
    outputSchema: VerifyPinOutputSchema,
  },
  async ({ pin }) => {
    try {
      const { firestore: db } = initializeFirebase();

      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('pin', '==', pin),
        limit(1)
      );
      
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { user: null };
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      return {
        user: {
          id: userDoc.id,
          ...userData,
        },
      };
    } catch (error: any) {
      console.error('Error verifying PIN:', error);
      // In case of any error (including permissions), return null.
      return { user: null };
    }
  }
);
