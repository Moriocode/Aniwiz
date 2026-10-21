import { IAnimeProvider, AnimeItem, AnimeEpisode, StreamServerOption, StreamSourceResult, StreamAudioMode, AiringScheduleItem } from './types';

/**
 * Provider Registry for Modular Anime Engines
 * Supports multiple scrapers and APIs (AniList, AniWixi, OpenAnime, etc.)
 * Provides seamless fallback if an upstream provider fails.
 */
export class AnimeProviderRegistry {
  private providers = new Map<string, IAnimeProvider>();
  private defaultProviderId = 'anilist';

  /**
   * Register a new API provider or scraper
   */
  public register(provider: IAnimeProvider, setAsDefault = false): void {
    this.providers.set(provider.id, provider);
    if (setAsDefault || this.providers.size === 1) {
      this.defaultProviderId = provider.id;
    }
  }

  /**
   * Get an installed provider by ID
   */
  public get(id?: string): IAnimeProvider {
    const targetId = id || this.defaultProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      // Fallback to first available provider
      const first = this.providers.values().next().value;
      if (!first) {
        throw new Error(`No anime provider registered in registry.`);
      }
      return first;
    }
    return provider;
  }

  /**
   * List all registered providers
   */
  public listProviders(): Array<{ id: string; name: string; version: string; isDefault: boolean }> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      isDefault: p.id === this.defaultProviderId,
    }));
  }

  /**
   * Change default provider
   */
  public setDefault(id: string): boolean {
    if (this.providers.has(id)) {
      this.defaultProviderId = id;
      return true;
    }
    return false;
  }

  /**
   * Execute with automatic provider fallback
   */
  public async executeWithFallback<T>(
    operationName: string,
    // Returning null/undefined (e.g. an empty result set) or throwing both
    // count as "this provider had nothing", so the cascade moves on.
    operation: (provider: IAnimeProvider) => Promise<T | null | undefined>,
    preferredProviderId?: string
  ): Promise<T> {
    const attempted: string[] = [];
    const providersToTry = [
      ...(preferredProviderId && this.providers.has(preferredProviderId) ? [this.providers.get(preferredProviderId)!] : []),
      ...Array.from(this.providers.values()).filter(p => p.id !== preferredProviderId),
    ];

    for (const provider of providersToTry) {
      try {
        attempted.push(provider.id);
        const result = await operation(provider);
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (err) {
        // Quietly try next provider
      }
    }

    throw new Error(`Failed to execute ${operationName} across all registered providers: [${attempted.join(', ')}]`);
  }
}

// Global registry instance
export const providerRegistry = new AnimeProviderRegistry();
