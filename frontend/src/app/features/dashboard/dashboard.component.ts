import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface VaultApp {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  apps = signal<VaultApp[]>([]);
  loading = signal(true);
  visibleToken = signal<string | null>(null);
  tokenMap = signal<Record<string, string>>({});
  tokenLoading = signal(false);
  copied = signal<string | null>(null);
  testing = signal<string | null>(null);
  deleting: string | null = null;
  creating = false;
  createError = '';
  createSuccess = '';

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
    this.http.get<VaultApp[]>('/api/apps').subscribe({
      next: (apps) => { this.apps.set(apps); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  createApp(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.createError = '';
    this.createSuccess = '';
    const { name, description } = this.createForm.getRawValue();
    this.http.post<VaultApp>('/api/apps', { name, description }).subscribe({
      next: (app) => {
        this.apps.update((list) => [app, ...list]);
        this.createForm.reset();
        this.createSuccess = `App "${app.name}" created successfully.`;
        this.creating = false;
        setTimeout(() => (this.createSuccess = ''), 4000);
      },
      error: (err) => {
        this.createError = err?.error?.message ?? 'Failed to create app';
        this.creating = false;
      },
    });
  }

  toggleToken(appId: string): void {
    if (this.visibleToken() === appId) {
      this.visibleToken.set(null);
      return;
    }
    this.visibleToken.set(appId);
    if (this.tokenMap()[appId]) return;
    this.tokenLoading.set(true);
    this.http.get<{ apiToken: string }>(`/api/apps/${appId}/token`).subscribe({
      next: (res) => {
        this.tokenMap.update((m) => ({ ...m, [appId]: res.apiToken }));
        this.tokenLoading.set(false);
      },
      error: () => this.tokenLoading.set(false),
    });
  }

  copyToken(appId: string): void {
    const token = this.tokenMap()[appId];
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      this.copied.set(appId);
      setTimeout(() => this.copied.set(null), 2000);
    });
  }

  goToRecordsTest(appId: string): void {
    const existingToken = this.tokenMap()[appId];
    if (existingToken) {
      this.router.navigate(['/records-test'], { queryParams: { appId, apiToken: existingToken } });
      return;
    }

    this.testing.set(appId);
    this.http.get<{ apiToken: string }>(`/api/apps/${appId}/token`).subscribe({
      next: (res) => {
        this.tokenMap.update((m) => ({ ...m, [appId]: res.apiToken }));
        this.testing.set(null);
        this.router.navigate(['/records-test'], { queryParams: { appId, apiToken: res.apiToken } });
      },
      error: () => this.testing.set(null),
    });
  }

  deleteApp(appId: string): void {
    if (!confirm('Delete this app? All its records will still exist in the database.')) return;
    this.deleting = appId;
    this.http.delete(`/api/apps/${appId}`).subscribe({
      next: () => {
        this.apps.update((list) => list.filter((a) => a._id !== appId));
        if (this.visibleToken() === appId) this.visibleToken.set(null);
        this.deleting = null;
      },
      error: () => (this.deleting = null),
    });
  }
}

