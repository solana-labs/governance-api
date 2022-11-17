import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';
import { hoursToMilliseconds } from 'date-fns';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { convertTextToRichTextDocument } from '@src/lib/textManipulation/convertTextToRichTextDocument';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import { RealmHubInfoRoadmapItemStatus } from './dto/RealmHubInfoRoadmapItemStatus';

function filterHas<T extends object, K1 extends keyof T>(
  keys: [K1],
): (
  item: Partial<T> | (Required<Pick<T, K1>> & Partial<Omit<T, K1>>),
) => item is Required<Pick<T, K1>> & Partial<Omit<T, K1>>;
function filterHas<T extends object, K1 extends keyof T, K2 extends keyof T>(
  keys: [K1, K2],
): (
  item: Partial<T> | (Required<Pick<T, K1 | K2>> & Partial<Omit<T, K1 | K2>>),
) => item is Required<Pick<T, K1 | K2>> & Partial<Omit<T, K1 | K2>>;
function filterHas<T extends object, K1 extends keyof T, K2 extends keyof T, K3 extends keyof T>(
  keys: [K1, K2, K3],
): (
  item: Partial<T> | (Required<Pick<T, K1 | K2 | K3>> & Partial<Omit<T, K1 | K2 | K3>>),
) => item is Required<Pick<T, K1 | K2 | K3>> & Partial<Omit<T, K1 | K2 | K3>>;
function filterHas<T extends object>(keys: (keyof T)[]) {
  return function filterFn(item) {
    for (const key of keys) {
      if (!item[key]) {
        return false;
      }
    }

    return true;
  };
}

function extractRoadmapStatus(status?: string) {
  if (!status) {
    return undefined;
  }

  if (['completed'].includes(status.toLocaleLowerCase())) {
    return RealmHubInfoRoadmapItemStatus.Completed;
  }

  if (['delayed'].includes(status.toLocaleLowerCase())) {
    return RealmHubInfoRoadmapItemStatus.Delayed;
  }

  if (['inprogress', 'in progress'].includes(status.toLocaleLowerCase())) {
    return RealmHubInfoRoadmapItemStatus.InProgress;
  }

  if (['upcoming'].includes(status.toLocaleLowerCase())) {
    return RealmHubInfoRoadmapItemStatus.Upcoming;
  }

  return undefined;
}

export interface CodeCommittedHubInfo {
  about?: {
    heading?: string;
    content?: string[];
  }[];
  documentation?: {
    title?: string;
    url?: string;
  };
  faq?: {
    question?: string;
    answer?: string[];
  }[];
  gallery?: {
    url?: string;
    caption?: string;
    height?: number;
    width?: number;
  }[];
  heading?: string;
  resources?: {
    title?: string;
    content?: string[];
    url?: string;
  }[];
  roadmap?: {
    description?: string[];
    items?: {
      title?: string;
      date?: string;
      status?: string;
      resource?: {
        title?: string;
        url?: string;
      };
    }[];
  };
  symbol?: string;
  token?: string;
  team?: {
    name?: string;
    avatar?: string;
    description?: string[];
    role?: string;
    twitter?: string;
  }[];
}

@Injectable()
export class RealmHubService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly realmSettingsService: RealmSettingsService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Get all the hub info committed into the app.realms.today github repo
   */
  async fetchAllCodeCommittedHubInfo(environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const cacheKey = `realm-hub-info-all-${environment}`;
    const cached = await this.cacheManager.get<{ [address: string]: CodeCommittedHubInfo }>(
      cacheKey,
    );

    if (cached) {
      return cached;
    }

    const url = this.configService.get('app.codeCommitedInfoUrl') + '/realms/about.json';
    const resp = await fetch(url);
    const allInfo: { [address: string]: CodeCommittedHubInfo } = await resp.json();

    this.cacheManager.set(cacheKey, allInfo, 60 * 5);
    return allInfo;
  }

  /**
   * Get a count of twitter followers. If the realm does not have a twitter,
   * returns 0
   */
  async getTwitterFollowerCount(realmPublicKey: PublicKey, environment: Environment) {
    const settings = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
      realmPublicKey,
      environment,
    );

    const twitterHandle = settings.twitter;

    if (!twitterHandle) {
      return 0;
    }

    return this.getTwitterFollowerCountForHandle(twitterHandle);
  }

  /**
   * Get a count of twitter followers for a twitter handle
   */
  async getTwitterFollowerCountForHandle(handle: string) {
    const cacheKey = `hub-twitter-handle-${handle}`;
    const cached = await this.cacheManager.get<number>(cacheKey);

    if (typeof cached === 'number') {
      return cached;
    }

    try {
      const count = await this.getFollowerCount(
        handle,
        this.configService.get('external.twitterBearerKey'),
      );

      await this.cacheManager.set(cacheKey, count, 60 * 60 * 2);
      return count;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get hub info for a specific Realm
   */
  async getCodeCommittedHubInfoForRealm(realmPublicKey: PublicKey, environment: Environment) {
    const allInfo = await this.fetchAllCodeCommittedHubInfo(environment);
    const info = allInfo[realmPublicKey.toBase58()];

    if (info) {
      return {
        about: info.about
          ? (
              await Promise.all(
                info.about.map(async (detail) => ({
                  ...detail,
                  content: detail.content
                    ? await convertTextToRichTextDocument(detail.content.join('\n'))
                    : undefined,
                })),
              )
            ).filter(filterHas(['content']))
          : [],
        documentation: info.documentation?.url ? info.documentation : undefined,
        faq: info.faq
          ? (
              await Promise.all(
                info.faq.map(async (item) => ({
                  ...item,
                  answer: item.answer
                    ? await convertTextToRichTextDocument(item.answer.join('\n'))
                    : undefined,
                })),
              )
            ).filter(filterHas(['question', 'answer']))
          : [],
        gallery: info.gallery?.filter(filterHas(['height', 'url', 'width'])) || [],
        heading: info.heading ? await convertTextToRichTextDocument(info.heading) : undefined,
        resources: info.resources
          ? (
              await Promise.all(
                info.resources.map(async (resource) => ({
                  ...resource,
                  content: resource.content
                    ? await convertTextToRichTextDocument(resource.content.join('\n'))
                    : undefined,
                })),
              )
            ).filter(filterHas(['title', 'url']))
          : [],
        roadmap: {
          ...info.roadmap,
          description: info.roadmap?.description
            ? await convertTextToRichTextDocument(info.roadmap.description.join('\n'))
            : undefined,
          items:
            info.roadmap?.items
              ?.map((item) => ({
                ...item,
                date: item.date ? new Date(item.date) : undefined,
                status: extractRoadmapStatus(item.status),
              }))
              .filter(filterHas(['title'])) || [],
        },
        symbol: info.symbol,
        team: info.team
          ? (
              await Promise.all(
                info.team.map(async (member) => ({
                  ...member,
                  description: member.description
                    ? await convertTextToRichTextDocument(member.description.join('\n'))
                    : undefined,
                })),
              )
            ).filter(filterHas(['name']))
          : [],
        token: info.token ? { mint: new PublicKey(info.token) } : undefined,
      };
    }

    return {
      about: [],
      documentation: undefined,
      faq: [],
      gallery: [],
      heading: undefined,
      resources: [],
      roadmap: {
        description: undefined,
        items: [],
      },
      symbol: undefined,
      team: [],
    };
  }

  /**
   * Get a count of twitter followers
   */
  private getFollowerCount = this.staleCacheService.dedupe(
    async (handle: string, bearerToken: string) => {
      const username = handle.replace('@', '');

      return fetch(
        `https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`,
        {
          method: 'get',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      )
        .then<{
          data: { public_metrics: { followers_count: number } };
        }>((resp) => resp.json())
        .then((result) => {
          if (!result?.data?.public_metrics) {
            throw new errors.RateLimit('get twitter follower count');
          }

          return result?.data?.public_metrics?.followers_count || 0;
        });
    },
    {
      dedupeKey: (handle, bearerToken) => handle + bearerToken,
      maxStaleAgeMs: hoursToMilliseconds(24),
    },
  );
}
