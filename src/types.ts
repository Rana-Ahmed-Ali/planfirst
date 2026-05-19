/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

export const QuestionOptionSchema = z.object({
  label: z.string(),
  recommended: z.boolean(),
  conflict: z.string().optional().default("")
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const HealthCheckResponseSchema = z.object({
  type: z.literal("health_check"),
  viability_score: z.number().default(0),
  first_impression: z.string().default(""),
  immediate_flags: z.array(z.string()).default([]),
  tone_note: z.string().optional().default("")
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const QuestionResponseSchema = z.object({
  type: z.literal("question"),
  estimated_completion_percentage: z.number().optional().default(10),
  phase: z.string().optional().default("Discovery"),
  question: z.string().default("What are your specific thoughts?"),
  options: z.array(QuestionOptionSchema).default([]),
  why_this_matters: z.string().optional().default("")
});
export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

export const PivotAlertResponseSchema = z.object({
  type: z.literal("pivot_alert"),
  observation: z.string().default(""),
  original_path: z.string().default(""),
  suggested_pivot: z.string().default(""),
  pivot_reason: z.string().default(""),
  question: z.string().default(""),
  options: z.array(QuestionOptionSchema).default([])
});
export type PivotAlertResponse = z.infer<typeof PivotAlertResponseSchema>;

export const PlanResponseSchema = z.object({
  type: z.literal("plan"),
  tldr: z.string().default(""),
  summary: z.string().default(""),
  viability_score_final: z.number().optional().default(0),
  checklist: z.array(z.string()).default([]),
  completedTasks: z.array(z.string()).optional(),
  content: z.string().default("")
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const FollowUpResponseSchema = z.object({
  type: z.literal("follow_up"),
  content: z.string().default("")
});
export type FollowUpResponse = z.infer<typeof FollowUpResponseSchema>;

export const PlanForgeResponseSchema = z.discriminatedUnion("type", [
  HealthCheckResponseSchema,
  QuestionResponseSchema,
  PivotAlertResponseSchema,
  PlanResponseSchema,
  FollowUpResponseSchema
]);

export type PlanForgeResponse = z.infer<typeof PlanForgeResponseSchema>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | PlanForgeResponse;
  isNew?: boolean;
}

export interface ContextDocument {
  name: string;
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  contextDocs?: ContextDocument[];
  tag?: string;
  pinned?: boolean;
}
