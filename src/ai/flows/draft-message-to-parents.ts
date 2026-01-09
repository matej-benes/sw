'use server';

/**
 * @fileOverview This file defines a Genkit flow for drafting messages to parents from teachers.
 *
 * draftMessageToParents - A function that drafts a message to parents regarding student performance or behavior.
 * DraftMessageToParentsInput - The input type for the draftMessageToParents function.
 * DraftMessageToParentsOutput - The return type for the draftMessageToParents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftMessageToParentsInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  topic: z.string().describe('The topic of the message (e.g., performance in math, behavior in class).'),
  details: z.string().describe('Specific details or observations to include in the message.'),
  teacherName: z.string().describe('The name of the teacher.'),
});
export type DraftMessageToParentsInput = z.infer<typeof DraftMessageToParentsInputSchema>;

const DraftMessageToParentsOutputSchema = z.object({
  messageDraft: z.string().describe('The drafted message to the parent.'),
});
export type DraftMessageToParentsOutput = z.infer<typeof DraftMessageToParentsOutputSchema>;

export async function draftMessageToParents(
  input: DraftMessageToParentsInput
): Promise<DraftMessageToParentsOutput> {
  return draftMessageToParentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'draftMessageToParentsPrompt',
  input: {schema: DraftMessageToParentsInputSchema},
  output: {schema: DraftMessageToParentsOutputSchema},
  prompt: `You are an experienced teacher drafting a message to a parent regarding their child's performance or behavior.

  Student Name: {{{studentName}}}
  Topic: {{{topic}}}
  Details: {{{details}}}
  Teacher Name: {{{teacherName}}}

  Compose a message that is informative, encouraging, and professional. Clearly communicate the topic and details, and offer suggestions or next steps as appropriate.`,
});

const draftMessageToParentsFlow = ai.defineFlow(
  {
    name: 'draftMessageToParentsFlow',
    inputSchema: DraftMessageToParentsInputSchema,
    outputSchema: DraftMessageToParentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
