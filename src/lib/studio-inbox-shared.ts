export const CRM_STAGES = ['new', 'inquiry', 'quote', 'active', 'waiting', 'closed'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export type MessageSenderRole = 'buyer' | 'artist' | 'system';

export type StudioThreadSummary = {
  id: string;
  subject: string;
  userEmail: string;
  userName: string | null;
  relatedPostSlug: string | null;
  relatedOrderId: string | null;
  status: string;
  crmStage: CrmStage;
  tags: string[];
  lastMessageAt: string;
  unread: boolean;
  lastPreview: string;
};

export type StudioMessageRecord = {
  id: string;
  senderRole: MessageSenderRole;
  body: string;
  createdAt: string;
};
