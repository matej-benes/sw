'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a summary of a student's grades, highlighting strengths and weaknesses.
 *
 * The flow takes a student's grades and a period as input and returns a summary of the student's performance, including strengths and weaknesses.
 *
 * @interface GenerateGradeSummaryInput - Represents the input schema for the generateGradeSummary function.
 * @interface GenerateGradeSummaryOutput - Represents the output schema for the generateGradeSummary function.
 * @function generateGradeSummary - The main function to generate the grade summary.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateGradeSummaryInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  grades: z.array(z.object({
    subject: z.string().describe('The subject name.'),
    grade: z.number().describe('The grade obtained in the subject.'),
  })).describe('An array of grades for the student.'),
  period: z.string().describe('The period for which the grades are to be summarized (e.g., "Fall 2024").'),
});

export type GenerateGradeSummaryInput = z.infer<typeof GenerateGradeSummaryInputSchema>;

const GenerateGradeSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the student\'s grades for the specified period, highlighting strengths and weaknesses.'),
});

export type GenerateGradeSummaryOutput = z.infer<typeof GenerateGradeSummaryOutputSchema>;

export async function generateGradeSummary(input: GenerateGradeSummaryInput): Promise<GenerateGradeSummaryOutput> {
  return generateGradeSummaryFlow(input);
}

const generateGradeSummaryPrompt = ai.definePrompt({
  name: 'generateGradeSummaryPrompt',
  input: {schema: GenerateGradeSummaryInputSchema},
  output: {schema: GenerateGradeSummaryOutputSchema},
  prompt: `You are a helpful AI that summarizes student grades for parents, highlighting strengths and weaknesses.\n
  Summarize the following grades for { {{studentName}} } for the period { {{period}} }.\n\n  Grades:\n  {{#each grades}}\n  - {{subject}}: {{grade}}\n  {{/each}}\n  `,
});

const generateGradeSummaryFlow = ai.defineFlow(
  {
    name: 'generateGradeSummaryFlow',
    inputSchema: GenerateGradeSummaryInputSchema,
    outputSchema: GenerateGradeSummaryOutputSchema,
  },
  async input => {
    const {output} = await generateGradeSummaryPrompt(input);
    return output!;
  }
);
