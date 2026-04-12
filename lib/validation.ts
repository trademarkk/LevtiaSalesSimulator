import { z } from "zod";

export const scenarioDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const trainerModeSchema = z.enum(["openai", "deepseek", "openrouter", "demo"]);
export const chatPhaseSchema = z.enum(["conversation", "evaluation"]);

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  inputSource: z.enum(["text", "voice"]).optional(),
});

export const trainingStateSchema = z.object({
  turnNumber: z.number().int().nonnegative(),
  currentMainConcern: z.string(),
  resolvedConcerns: z.array(z.string()),
  unresolvedConcerns: z.array(z.string()),
  trustLevel: z.number().int().min(0).max(10),
  interestLevel: z.number().int().min(0).max(10),
  resistanceLevel: z.number().int().min(0).max(10),
  clientMood: z.string(),
  lastAdminReplyQuality: z.enum(["weak", "medium", "strong"]),
  lastAdminAskedQuestion: z.boolean(),
  lastAdminQuestionTopic: z.string(),
  shouldAnswerDirectly: z.boolean(),
  pendingDirectAnswerTopic: z.string(),
  directAnswerUrgency: z.number().int().min(0).max(10),
  preferredAnswerStyle: z.enum(["direct_with_doubt", "direct_with_question", "direct_with_relief", "direct_with_emotion"]),
  factsLearned: z.array(z.string()),
  rapportNotes: z.array(z.string()),
});

export const scenarioContextSchema = z.object({
  objectionIds: z.array(z.number().int().positive()),
  city: z.string().optional(),
  ownerEmail: z.string().optional(),
  persona: z.string(),
  speechStyle: z.string(),
  temperament: z.string(),
  lessonDirection: z.string(),
  lessonImpression: z.string(),
  purchaseSignal: z.string(),
  difficulty: scenarioDifficultySchema,
  stepCount: z.number().finite().int().positive(),
});

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().trim().min(1),
});

export const registerRequestSchema = z.object({
  city: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают.",
  path: ["confirmPassword"],
});

export const managerInviteCreateSchema = z.object({
  city: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export const masterInviteCreateSchema = managerInviteCreateSchema;

export const managerRegisterSchema = z.object({
  code: z.string().trim().min(6),
  city: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают.",
  path: ["confirmPassword"],
});

export const managerObjectionCreateSchema = z.object({
  title: z.string().trim().min(1),
  objectionText: z.string().trim().min(1),
  coachHint: z.string().default(""),
  stage: z.string().trim().min(1),
  difficulty: scenarioDifficultySchema.default("medium"),
  isActive: z.boolean().default(true),
  isRequired: z.boolean().default(false),
});

export const managerObjectionToggleSchema = z.object({
  isActive: z.boolean(),
});

export const managerObjectionUpdateSchema = managerObjectionCreateSchema;

export const managerSettingsSchema = z.object({
  trainerPrompt: z.string().trim().min(1),
});

export const scenarioRequestSchema = z.object({
  difficulty: scenarioDifficultySchema.optional(),
  stepCount: z.number().int().positive().optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).default([]),
  scenario: scenarioContextSchema,
  trainingState: trainingStateSchema.optional(),
  phase: chatPhaseSchema.optional(),
  turnNumber: z.number().int().positive().optional(),
});

export const trainingSessionCreateSchema = z.object({
  adminDisplayName: z.string().trim().min(1),
  scenario: scenarioContextSchema,
  trainerMode: trainerModeSchema,
  evaluationText: z.string().trim().min(1),
  messages: z.array(chatMessageSchema),
  startedAt: z.string().optional(),
});

export const trainingSessionDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export function getZodErrorMessage(error: z.ZodError) {
  const firstIssue = error.issues[0];

  if (!firstIssue) {
    return "Некорректные входные данные.";
  }

  const path = firstIssue.path.length ? `${firstIssue.path.join(".")}: ` : "";
  return `${path}${firstIssue.message}`;
}
