import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface AuthUser {
  username: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'dv_token';
  private readonly USER_KEY = 'dv_user';
  readonly user = signal<AuthUser | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    const persistedUser = this.getPersistedUser();
    if (persistedUser) {
      this.user.set(persistedUser);
    }

    // Restore session on startup
    const token = this.getToken();
    if (token) {
      this.fetchMe().subscribe({
        error: (err: HttpErrorResponse) => {
          // Keep session on transient network/server errors; clear only on auth failures.
          if (err.status === 401 || err.status === 403) {
            this.logout();
          }
        },
      });
    }
  }

  login(username: string, password: string): Observable<{ access_token: string }> {
    return this.http
      .post<{ access_token: string }>('/api/auth/login', { username, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.access_token);
          this.fetchMe().subscribe();
        }),
      );
  }

  fetchMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/users/me').pipe(
      tap((u) => {
        this.user.set(u);
        localStorage.setItem(this.USER_KEY, JSON.stringify(u));
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>('/api/users/me/password', {
      currentPassword,
      newPassword,
    });
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private getPersistedUser(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(this.USER_KEY);
      return null;
    }
  }
}

