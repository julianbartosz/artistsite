import 'server-only';
import { getConfig } from '@/lib/config';

type PublishStatus = 'published' | 'scheduled' | 'needs_attention' | 'failed';

type SocialPostRecord = {
  id: string;
  platform: string;
  content: string;
  mediaUrls?: unknown;
  scheduledAt?: Date | string | null;
};

type SocialProvider = 'assist' | 'meta' | 'ayrshare';

export type ShareAssistLink = {
  label: string;
  url: string;
};

export type ShareAssistPayload = {
  platform: string;
  label: string;
  caption: string;
  mediaUrls: string[];
  links: ShareAssistLink[];
  instructions: string[];
};

export type SocialPublishResult = {
  mode: 'api' | 'assist';
  status: PublishStatus;
  externalId?: string;
  publishedAt?: Date;
  assist?: ShareAssistPayload;
  error?: string;
};

function isAutoPublishMode(value?: string): boolean {
  return ['auto', 'api', 'direct'].includes((value || '').trim().toLowerCase());
}

function normalizeProvider(value?: string): SocialProvider | undefined {
  const provider = (value || '').trim().toLowerCase();
  if (provider === 'ayrshare') return 'ayrshare';
  if (provider === 'meta' || provider === 'facebook') return 'meta';
  if (provider === 'assist' || provider === 'manual') return 'assist';
  return undefined;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  } catch {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
}

function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

async function getPublicSiteUrl(): Promise<string | undefined> {
  return safeUrl(await getConfig('NEXT_PUBLIC_SITE_URL') || await getConfig('NEXT_PUBLIC_BASE_URL'));
}

function normalizeAyrsharePlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === 'twitter') return 'twitter';
  if (normalized === 'x') return 'twitter';
  return normalized;
}

async function buildShareAssist(post: SocialPostRecord): Promise<ShareAssistPayload> {
  const platform = post.platform.toLowerCase();
  const siteUrl = await getPublicSiteUrl();
  const mediaUrls = parseStringArray(post.mediaUrls).map(safeUrl).filter((url): url is string => Boolean(url));
  const caption = post.content.trim();
  const links: ShareAssistLink[] = [];

  if (platform === 'facebook' && siteUrl) {
    links.push({ label: 'Open Facebook share', url: `https://www.facebook.com/sharer/sharer.php?u=${encode(siteUrl)}&quote=${encode(caption)}` });
  }

  if ((platform === 'twitter' || platform === 'x') && (siteUrl || caption)) {
    links.push({ label: 'Open X compose', url: `https://twitter.com/intent/tweet?text=${encode(caption)}${siteUrl ? `&url=${encode(siteUrl)}` : ''}` });
  }

  if (platform === 'linkedin' && siteUrl) {
    links.push({ label: 'Open LinkedIn share', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encode(siteUrl)}` });
  }

  if (platform === 'pinterest' && siteUrl) {
    links.push({ label: 'Open Pinterest pin', url: `https://www.pinterest.com/pin/create/button/?url=${encode(siteUrl)}${mediaUrls[0] ? `&media=${encode(mediaUrls[0])}` : ''}&description=${encode(caption)}` });
  }

  if (platform === 'instagram') {
    links.push({ label: 'Open Instagram', url: 'https://www.instagram.com/' });
  }

  if (links.length === 0) {
    links.push({ label: 'Open platform', url: siteUrl || 'https://www.google.com/search?q=social+media+publisher' });
  }

  return {
    platform,
    label: platform === 'instagram' ? 'Instagram publish assist' : `${platform.charAt(0).toUpperCase()}${platform.slice(1)} publish assist`,
    caption,
    mediaUrls,
    links,
    instructions: [
      'Copy the caption from this panel.',
      mediaUrls.length > 0 ? 'Download or attach the listed media.' : 'Attach artwork media if this post needs an image.',
      'Use the platform button to finish publishing in the connected social account.',
    ],
  };
}

async function publishFacebookPagePost(post: SocialPostRecord): Promise<SocialPublishResult | null> {
  if (post.platform.toLowerCase() !== 'facebook') return null;

  const [mode, pageId, accessToken, siteUrl] = await Promise.all([
    getConfig('SOCIAL_PUBLISH_MODE'),
    getConfig('FACEBOOK_PAGE_ID'),
    getConfig('FACEBOOK_ACCESS_TOKEN'),
    getPublicSiteUrl(),
  ]);

  if (!isAutoPublishMode(mode)) return null;
  if (!pageId || !accessToken) return null;

  const params = new URLSearchParams({
    access_token: accessToken,
    message: post.content,
  });
  if (siteUrl) params.set('link', siteUrl);

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}/feed`, {
      method: 'POST',
      body: params,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.id) {
      return { mode: 'api', status: 'failed', error: data?.error?.message || 'Facebook publish failed' };
    }

    return { mode: 'api', status: 'published', externalId: String(data.id), publishedAt: new Date() };
  } catch (error) {
    return { mode: 'api', status: 'failed', error: error instanceof Error ? error.message : 'Facebook publish failed' };
  }
}

async function publishInstagramBusinessPost(post: SocialPostRecord): Promise<SocialPublishResult | null> {
  if (post.platform.toLowerCase() !== 'instagram') return null;

  const [mode, pageId, accessToken] = await Promise.all([
    getConfig('SOCIAL_PUBLISH_MODE'),
    getConfig('FACEBOOK_PAGE_ID'),
    getConfig('FACEBOOK_ACCESS_TOKEN'),
  ]);
  if (!isAutoPublishMode(mode)) return null;
  if (!pageId || !accessToken) return null;

  const imageUrl = parseStringArray(post.mediaUrls).map(safeUrl).find(Boolean);
  if (!imageUrl) return { mode: 'api', status: 'failed', error: 'Instagram auto-publish requires one public image URL' };

  try {
    const accountParams = new URLSearchParams({
      fields: 'instagram_business_account',
      access_token: accessToken,
    });
    const accountResponse = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(pageId)}?${accountParams.toString()}`);
    const accountData = await accountResponse.json().catch(() => ({}));
    const instagramAccountId = accountData?.instagram_business_account?.id;
    if (!accountResponse.ok || !instagramAccountId) {
      return { mode: 'api', status: 'failed', error: accountData?.error?.message || 'Instagram business account is not connected to this Facebook page' };
    }

    const mediaParams = new URLSearchParams({
      access_token: accessToken,
      image_url: imageUrl,
      caption: post.content,
    });
    const mediaResponse = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(instagramAccountId)}/media`, {
      method: 'POST',
      body: mediaParams,
    });
    const mediaData = await mediaResponse.json().catch(() => ({}));
    if (!mediaResponse.ok || !mediaData?.id) {
      return { mode: 'api', status: 'failed', error: mediaData?.error?.message || 'Instagram media creation failed' };
    }

    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: String(mediaData.id),
    });
    const publishResponse = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(instagramAccountId)}/media_publish`, {
      method: 'POST',
      body: publishParams,
    });
    const publishData = await publishResponse.json().catch(() => ({}));
    if (!publishResponse.ok || !publishData?.id) {
      return { mode: 'api', status: 'failed', error: publishData?.error?.message || 'Instagram publish failed' };
    }

    return { mode: 'api', status: 'published', externalId: String(publishData.id), publishedAt: new Date() };
  } catch (error) {
    return { mode: 'api', status: 'failed', error: error instanceof Error ? error.message : 'Instagram publish failed' };
  }
}

async function publishViaAyrshare(post: SocialPostRecord): Promise<SocialPublishResult | null> {
  const [mode, apiKey] = await Promise.all([
    getConfig('SOCIAL_PUBLISH_MODE'),
    getConfig('AYRSHARE_API_KEY'),
  ]);
  if (!isAutoPublishMode(mode)) return null;
  if (!apiKey) return null;

  const mediaUrls = parseStringArray(post.mediaUrls).map(safeUrl).filter((url): url is string => Boolean(url));
  const payload = {
    post: post.content,
    platforms: [normalizeAyrsharePlatform(post.platform)],
    ...(mediaUrls.length ? { mediaUrls } : {}),
  };

  try {
    const response = await fetch('https://app.ayrshare.com/api/post', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { mode: 'api', status: 'failed', error: data?.message || data?.error || 'Ayrshare publish failed' };
    }

    const postId = data?.id || data?.postIds?.[normalizeAyrsharePlatform(post.platform)] || data?.postIds?.[0];
    return {
      mode: 'api',
      status: 'published',
      externalId: postId ? String(postId) : undefined,
      publishedAt: new Date(),
    };
  } catch (error) {
    return { mode: 'api', status: 'failed', error: error instanceof Error ? error.message : 'Ayrshare publish failed' };
  }
}

export async function publishSocialPost(post: SocialPostRecord): Promise<SocialPublishResult> {
  const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const assist = await buildShareAssist(post);

  if (scheduledAt && scheduledAt.getTime() > Date.now()) {
    return { mode: 'assist', status: 'scheduled', assist };
  }

  const provider = normalizeProvider(await getConfig('SOCIAL_PROVIDER'));
  const apiResult = provider === 'ayrshare'
    ? await publishViaAyrshare(post)
    : provider === 'meta' || provider === undefined
      ? await publishFacebookPagePost(post) || await publishInstagramBusinessPost(post)
      : null;
  if (apiResult?.status === 'published') return apiResult;

  return {
    mode: apiResult?.mode || 'assist',
    status: 'needs_attention',
    assist,
    error: apiResult?.error,
  };
}
