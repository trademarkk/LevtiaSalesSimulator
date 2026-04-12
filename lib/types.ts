export type UserRole = "admin" | "manager" | "master";

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
  managerEmail?: string | null;
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

export type TrainingReplyQuality = "weak" | "medium" | "strong";
export type ClientAnswerStyle = "direct_with_doubt" | "direct_with_question" | "direct_with_relief" | "direct_with_emotion";

export type TrainingState = {
  turnNumber: number;
  currentMainConcern: string;
  resolvedConcerns: string[];
  unresolvedConcerns: string[];
  trustLevel: number;
  interestLevel: number;
  resistanceLevel: number;
  clientMood: string;
  lastAdminReplyQuality: TrainingReplyQuality;
  lastAdminAskedQuestion: boolean;
  lastAdminQuestionTopic: string;
  shouldAnswerDirectly: boolean;
  pendingDirectAnswerTopic: string;
  directAnswerUrgency: number;
  preferredAnswerStyle: ClientAnswerStyle;
  factsLearned: string[];
  rapportNotes: string[];
};

export type ScenarioContext = {
  objectionIds: number[];
  city?: string;
  ownerEmail?: string;
  persona: string;
  speechStyle: string;
  temperament: string;
  lessonDirection: string;
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
  managerEmail?: string | null;
  role: UserRole;
  exp: number;
};
