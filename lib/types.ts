export type UserRole = "admin" | "manager";

export type ScenarioDifficulty = "easy" | "medium" | "hard";
export type ChatPhase = "conversation" | "evaluation";
export type TrainerMode = "openai" | "deepseek" | "openrouter" | "demo";

export type UserRecord = {
  id: number;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  city?: string;
  status?: "active" | "disabled";
  createdAt: string;
};

export type AdminAccountSummary = {
  id: number;
  name: string;
  email: string;
  city: string;
  status: "active" | "disabled";
  trainingCount: number;
  lastTrainingAt: string | null;
  createdAt: string;
};

export type ObjectionRecord = {
  id: number;
  title: number extends never ? never : string;
  objectionText: string;
  coachHint: string;
  stage: string;
  difficulty: ScenarioDifficulty;
  isActive: number;
  isRequired: number;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioContext = {
  objectionIds: number[];
  city?: string;
  persona: string;
  lessonImpression: string;
  purchaseSignal: string;
  difficulty: ScenarioDifficulty;
  stepCount: number;
};
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  inputSource?: "text" | "voice";
};

export type TrainingSessionRecord = {
  id: number;
  adminDisplayName: string;
  adminUserId: number | null;
  scenarioDifficulty: ScenarioDifficulty;
  stepCount: number;
  trainerMode: TrainerMode;
  evaluationText: string;
  score: number | null;
  transcript: ChatMessage[];
  startedAt: string;
  completedAt: string;
  createdAt: string;
};

export type TrainingAdministratorSummary = {
  adminDisplayName: string;
  sessionCount: number;
  averageScore: number | null;
  lastCompletedAt: string;
};

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
  city?: string;
  role: UserRole;
  exp: number;
};
