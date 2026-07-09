-- Rastreamento de follow-up de feedback: quando o lead recebe uma abordagem de
-- WhatsApp (ex: aviso de atualização do sistema) e não responde em ~30 min,
-- a Kely manda uma segunda mensagem pedindo feedback/sugestão.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastOutreachAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "feedbackFollowUpSentAt" TIMESTAMP(3);
