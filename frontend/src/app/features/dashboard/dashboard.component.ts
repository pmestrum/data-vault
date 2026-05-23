import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface VaultDatabase {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

interface TokenResponse {
  apiToken: string;
  previousTokenPreview?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  databases = signal<VaultDatabase[]>([]);
  loading = signal(true);
  visibleToken = signal<string | null>(null);
  tokenMap = signal<Record<string, string>>({});
  previousTokenPreviewMap = signal<Record<string, string>>({});
  tokenLoadingFor = signal<string | null>(null);
  refreshingTokenFor = signal<string | null>(null);
  copied = signal<string | null>(null);
  editingDescriptionFor = signal<string | null>(null);
  saveDescriptionFor = signal<string | null>(null);
  testing = signal<string | null>(null);
  deleting: string | null = null;
  creating = false;
  createError = '';
  createSuccess = '';
  descriptionDraft = '';

  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  constructor(private http: HttpClient, private fb: FormBuilder, private router: Router) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<VaultDatabase[]>('/api/databases').subscribe({
      next: (databases) => {
        this.databases.set(databases);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createDatabase(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.createError = '';
    this.createSuccess = '';
    const { name, description } = this.createForm.getRawValue();
    this.http.post<VaultDatabase>('/api/databases', { name, description }).subscribe({
      next: (database) => {
        this.databases.update((list) => [database, ...list]);
        this.createForm.reset();
        this.createSuccess = `Database "${database.name}" created successfully.`;
        this.creating = false;
        setTimeout(() => (this.createSuccess = ''), 4000);
      },
      error: (err) => {
        this.createError = err?.error?.message ?? 'Failed to create database';
        this.creating = false;
      },
    });
  }

  toggleToken(databaseId: string): void {
    if (this.visibleToken() === databaseId) {
      this.visibleToken.set(null);
      return;
    }

    this.visibleToken.set(databaseId);
    this.ensureToken(databaseId);
  }

  refreshToken(databaseId: string): void {
    this.refreshingTokenFor.set(databaseId);
    this.http.post<TokenResponse>(`/api/databases/${databaseId}/token/rotate`, {}).subscribe({
      next: (res) => {
        this.tokenMap.update((m) => ({ ...m, [databaseId]: res.apiToken }));
        if (res.previousTokenPreview) {
          this.previousTokenPreviewMap.update((m) => ({ ...m, [databaseId]: res.previousTokenPreview! }));
        }
        this.refreshingTokenFor.set(null);
        this.copied.set(null);
      },
      error: () => this.refreshingTokenFor.set(null),
    });
  }

  async copyToken(databaseId: string): Promise<void> {
    const token = this.tokenMap()[databaseId];
    if (!token) {
      this.ensureToken(databaseId, async (loaded) => {
        await this.copyTextToClipboard(loaded, databaseId);
      });
      return;
    }

    await this.copyTextToClipboard(token, databaseId);
  }

  startEditDescription(database: VaultDatabase): void {
    this.editingDescriptionFor.set(database._id);
    this.descriptionDraft = database.description ?? '';
  }

  cancelEditDescription(): void {
    this.editingDescriptionFor.set(null);
    this.descriptionDraft = '';
  }

  saveDescription(databaseId: string): void {
    this.saveDescriptionFor.set(databaseId);
    this.http.patch<VaultDatabase>(`/api/databases/${databaseId}`, { description: this.descriptionDraft }).subscribe({
      next: (updated) => {
        this.databases.update((list) => list.map((database) => (database._id === databaseId ? updated : database)));
        this.saveDescriptionFor.set(null);
        this.cancelEditDescription();
      },
      error: () => this.saveDescriptionFor.set(null),
    });
  }

  goToRecordsTest(databaseId: string): void {
    const existingToken = this.tokenMap()[databaseId];
    if (existingToken) {
      this.router.navigate(['/records-test'], { queryParams: { databaseId, apiToken: existingToken } });
      return;
    }

    this.testing.set(databaseId);
    this.ensureToken(
      databaseId,
      (token) => {
        this.testing.set(null);
        this.router.navigate(['/records-test'], { queryParams: { databaseId, apiToken: token } });
      },
      () => this.testing.set(null),
    );
  }

  deleteDatabase(databaseId: string): void {
    if (!confirm('Delete this database? All its records will still exist in the master-database.')) return;
    this.deleting = databaseId;
    this.http.delete(`/api/databases/${databaseId}`).subscribe({
      next: () => {
        this.databases.update((list) => list.filter((a) => a._id !== databaseId));
        if (this.visibleToken() === databaseId) this.visibleToken.set(null);
        this.deleting = null;
      },
      error: () => (this.deleting = null),
    });
  }

  private ensureToken(databaseId: string, onLoaded?: (token: string) => void, onError?: () => void): void {
    const cached = this.tokenMap()[databaseId];
    if (cached) {
      onLoaded?.(cached);
      return;
    }

    this.tokenLoadingFor.set(databaseId);
    this.http.get<TokenResponse>(`/api/databases/${databaseId}/token`).subscribe({
      next: (res) => {
        this.tokenMap.update((m) => ({ ...m, [databaseId]: res.apiToken }));
        if (res.previousTokenPreview) {
          this.previousTokenPreviewMap.update((m) => ({ ...m, [databaseId]: res.previousTokenPreview! }));
        }
        this.tokenLoadingFor.set(null);
        onLoaded?.(res.apiToken);
      },
      error: () => {
        this.tokenLoadingFor.set(null);
        onError?.();
      },
    });
  }

  private async copyTextToClipboard(token: string, databaseId: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        this.copyWithTextareaFallback(token);
      }
      this.copied.set(databaseId);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      try {
        this.copyWithTextareaFallback(token);
        this.copied.set(databaseId);
        setTimeout(() => this.copied.set(null), 2000);
      } catch {
        this.copied.set(null);
      }
    }
  }

  private copyWithTextareaFallback(value: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) {
      throw new Error('copy failed');
    }
  }
}
