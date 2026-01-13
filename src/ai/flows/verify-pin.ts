'use server';

/**
 * @fileOverview A Genkit flow to securely verify a user's email and PIN.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';


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
      // Use the client SDK initialization
      const { firestore: db } = initializeFirebase();

      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '==', email),
        where('pin', '==', pin),
        limit(1)
      );
      
      const snapshot = await getDocs(q);

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
