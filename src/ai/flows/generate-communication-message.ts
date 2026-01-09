'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating communication messages from teachers to parents regarding student performance.
 *
 * generateCommunicationMessage - A function that generates a message to parents about their child's performance.
 * GenerateCommunicationMessageInput - The input type for the generateCommunicationMessage function.
 * GenerateCommunicationMessageOutput - The return type for the generateCommunicationMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCommunicationMessageInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  performanceSummary: z.string().describe('A summary of the student\'s performance in class.'),
  strengths: z.string().describe('The student\'s strengths.'),
  areasForImprovement: z.string().describe('Areas where the student can improve.'),
  teacherName: z.string().describe('The name of the teacher.'),
});
export type GenerateCommunicationMessageInput = z.infer<typeof GenerateCommunicationMessageInputSchema>;

const GenerateCommunicationMessageOutputSchema = z.object({
  message: z.string().describe('The generated communication message to the parent.'),
});
export type GenerateCommunicationMessageOutput = z.infer<typeof GenerateCommunicationMessageOutputSchema>;

export async function generateCommunicationMessage(
  input: GenerateCommunicationMessageInput
): Promise<GenerateCommunicationMessageOutput> {
  return generateCommunicationMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCommunicationMessagePrompt',
  input: {schema: GenerateCommunicationMessageInputSchema},
  output: {schema: GenerateCommunicationMessageOutputSchema},
  prompt: `You are an experienced teacher drafting a message to a parent about their child's performance in your class.

  Student Name: {{{studentName}}}
  Performance Summary: {{{performanceSummary}}}
  Strengths: {{{strengths}}}
  Areas for Improvement: {{{areasForImprovement}}}
  Teacher Name: {{{teacherName}}}

  Compose a message that is informative, encouraging, and professional. Highlight both the student's strengths and areas where they can improve. Offer specific suggestions for how the parent can support the student's learning.`, 
});

const generateCommunicationMessageFlow = ai.defineFlow(
  {
    name: 'generateCommunicationMessageFlow',
    inputSchema: GenerateCommunicationMessageInputSchema,
    outputSchema: GenerateCommunicationMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
