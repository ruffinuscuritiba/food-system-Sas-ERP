import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  aiProvider?: string; // GEMINI | ANTHROPIC | OPENAI

  @IsString()
  @IsOptional()
  aiModel?: string;

  @IsString()
  @IsOptional()
  attendantName?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsString()
  @IsOptional()
  greetingMessage?: string;

  @IsString()
  @IsOptional()
  offlineMessage?: string;

  @IsString()
  @IsOptional()
  transferKeywords?: string;

  @IsString()
  @IsOptional()
  mode?: string; // AUTO | HYBRID | MANUAL

  @IsInt()
  @Min(0)
  @IsOptional()
  typingDelay?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  messageDelay?: number;

  @IsBoolean()
  @IsOptional()
  useEmojis?: boolean;

  @IsString()
  @IsOptional()
  businessHoursStart?: string;

  @IsString()
  @IsOptional()
  businessHoursEnd?: string;

  @IsString()
  @IsOptional()
  businessDays?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // ── Personalidade avançada ────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  responseStyle?: string; // DIRECT | CONVERSATIONAL

  @IsString()
  @IsOptional()
  personalityType?: string; // FRIENDLY | PLAYFUL | FORMAL

  @IsString()
  @IsOptional()
  emojiUsage?: string; // NONE | MODERATE | ALWAYS

  @IsBoolean()
  @IsOptional()
  advancedPersonality?: boolean;

  @IsString()
  @IsOptional()
  speechHabits?: string;

  @IsString()
  @IsOptional()
  characteristics?: string;

  @IsString()
  @IsOptional()
  principles?: string;

  @IsString()
  @IsOptional()
  humor?: string;

  // ── Comportamento de pedidos ──────────────────────────────────────────────
  @IsString()
  @IsOptional()
  menuLinkStyle?: string; // BUTTON | TEXT

  @IsBoolean()
  @IsOptional()
  conversationalOrdering?: boolean;

  @IsString()
  @IsOptional()
  orderHandlingMode?: string; // LINK_ONLY | LINK_THEN_HUMAN_3 | LINK_THEN_HUMAN_2 | ALWAYS_HUMAN
}
