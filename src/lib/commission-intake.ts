import type {
  ContactInquiryKey,
  ContactInquiryType,
  ContactPageContent,
} from '@/lib/site-content-shared';
import {
  CONTACT_INQUIRY_KEYS,
  DEFAULT_CONTACT_INQUIRY_TYPES,
  DEFAULT_CONTACT_PAGE,
  normalizeInquiryTypes,
} from '@/lib/site-content-shared';

export type CommissionIntakeOffer = {
  key: ContactInquiryKey;
  title: string;
  description: string;
  recommendedOrder: number;
};

export const COMMISSION_INTAKE_OFFERS: CommissionIntakeOffer[] = [
  {
    key: 'purchase',
    title: 'Buy artwork from my shop',
    description: 'Visitors want to purchase a piece you already have listed.',
    recommendedOrder: 0,
  },
  {
    key: 'commission',
    title: 'Request a custom commission',
    description: 'Visitors ask you to create a one-of-a-kind piece for them.',
    recommendedOrder: 1,
  },
  {
    key: 'exhibition',
    title: 'Exhibition or gallery opportunity',
    description: 'Curators, galleries, or venues reach out about showing your work.',
    recommendedOrder: 2,
  },
  {
    key: 'press',
    title: 'Press and media',
    description: 'Journalists or publications request interviews, images, or statements.',
    recommendedOrder: 3,
  },
  {
    key: 'general',
    title: 'General questions',
    description: 'Catch-all for hello messages and anything that does not fit above.',
    recommendedOrder: 4,
  },
];

const COMMISSION_SIDEBAR_HTML = `
<p>I accept a limited number of commission projects each year. Please include details about:</p>
<ul>
  <li>Desired size and medium</li>
  <li>Timeline and deadline</li>
  <li>Subject matter or theme</li>
  <li>Budget range</li>
</ul>
`.trim();

export function enabledInquiryKeys(inquiryTypes: ContactInquiryType[]): ContactInquiryKey[] {
  return normalizeInquiryTypes(inquiryTypes)
    .filter((item) => item.visible)
    .map((item) => item.key);
}

export function applyCommissionIntake(
  contact: ContactPageContent,
  enabledKeys: ContactInquiryKey[],
): ContactPageContent {
  const enabled = new Set(enabledKeys);
  const byKey = new Map(
    normalizeInquiryTypes(contact.form.inquiryTypes).map((item) => [item.key, item]),
  );

  const orderedKeys = [
    ...COMMISSION_INTAKE_OFFERS
      .filter((offer) => enabled.has(offer.key))
      .sort((a, b) => a.recommendedOrder - b.recommendedOrder)
      .map((offer) => offer.key),
    ...CONTACT_INQUIRY_KEYS.filter((key) => !enabled.has(key)),
  ];

  const inquiryTypes = orderedKeys.map((key) => {
    const existing = byKey.get(key) ?? DEFAULT_CONTACT_INQUIRY_TYPES.find((item) => item.key === key)!;
    return {
      ...existing,
      visible: enabled.has(key),
    };
  });

  const commissionsEnabled = enabled.has('commission');
  const sidebar = { ...contact.sidebar };

  if (commissionsEnabled) {
    if (!sidebar.commissionTitle.trim()) {
      sidebar.commissionTitle = DEFAULT_CONTACT_PAGE.sidebar.commissionTitle;
    }
    const currentCommissionHtml = sidebar.commissionHtml.trim();
    const defaultCommissionHtml = DEFAULT_CONTACT_PAGE.sidebar.commissionHtml.trim();
    if (!currentCommissionHtml || currentCommissionHtml === defaultCommissionHtml) {
      sidebar.commissionHtml = COMMISSION_SIDEBAR_HTML;
    }
  }

  return {
    ...contact,
    form: {
      ...contact.form,
      inquiryTypes,
    },
    sidebar,
  };
}

export function commissionIntakeMatchesSelection(
  contact: ContactPageContent,
  enabledKeys: ContactInquiryKey[],
): boolean {
  const current = enabledInquiryKeys(contact.form.inquiryTypes).sort().join(',');
  const next = [...enabledKeys].sort().join(',');
  return current === next;
}
