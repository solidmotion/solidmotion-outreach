import type { CampaignStatus } from "@/lib/db/schema";

export interface Campaign {
  id: number;
  businessId: number;
  demoWebsiteUrl: string | null;
  demoWebsiteHtml: string | null;
  emailHtml: string | null;
  emailSubject: string | null;
  emailPlainText: string | null;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  status: CampaignStatus;
  scheduledSendAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}
