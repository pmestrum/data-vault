import { Injectable } from '@angular/core';

export interface CurlSettings {
  publicUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CurlSettingsService {
  private readonly STORAGE_KEY = 'recordsTest.curlSettings';
  private readonly defaults: CurlSettings = {
    publicUrl: this.getDefaultPublicUrl(),
  };

  getSettings(): CurlSettings {
    if (typeof window === 'undefined') {
      return this.defaults;
    }

    const raw = window.localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return this.defaults;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CurlSettings>;
      return this.normalizeSettings(parsed);
    } catch {
      return this.defaults;
    }
  }

  saveSettings(settings: Partial<CurlSettings>): CurlSettings {
    const normalized = this.normalizeSettings(settings);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
  }

  toAbsoluteUrl(requestUrl: string): string {
    const settings = this.getSettings();
    const publicUrl = this.normalizePublicUrl(settings.publicUrl);

    if (!requestUrl.startsWith('/')) {
      return `${publicUrl}/${requestUrl}`;
    }

    if (requestUrl === '/api' || requestUrl.startsWith('/api/')) {
      return `${publicUrl}/${requestUrl.slice('/api'.length)}`;
    }

    return `${publicUrl}${requestUrl}`;
  }

  private normalizeSettings(settings: Partial<CurlSettings>): CurlSettings {
    return {
      publicUrl: this.normalizePublicUrl(settings.publicUrl),
    };
  }

  private normalizePublicUrl(publicUrl?: string): string {
    const trimmed = (publicUrl ?? '').trim();
    const fallback = this.defaults.publicUrl;

    if (!trimmed) {
      return fallback;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.origin;
    } catch {
      return fallback;
    }
  }


  private getDefaultPublicUrl(): string {
    if (typeof window === 'undefined') {
      return 'http://localhost:4200';
    }
    return window.location.origin;
  }
}

