import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VaultRecord {
  id: string;
  tableId: string;
  json: Record<string, any>;
  createdAt: string;
  createdBy: string;
}

export interface RecordHeaders {
  appId: string;
  apiToken: string;
}

export interface RecordQueryFilter {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'exists';
  value?: unknown;
}

export interface RecordQuerySort {
  field: string;
  dir: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class RecordsApiService {
  constructor(private http: HttpClient) {}

  create(headers: RecordHeaders, payload: {
    id?: string;
    tableId: string;
    createdBy: string;
    json: Record<string, any>;
  }): Observable<VaultRecord> {
    return this.http.post<VaultRecord>('/api/records', payload, {
      headers: this.toHeaders(headers),
    });
  }

  query(
    headers: RecordHeaders,
    filters: {
      tableId?: string;
      createdBy?: string;
      logic?: 'and' | 'or';
      filters?: RecordQueryFilter[];
      sort?: RecordQuerySort[];
      limit?: number;
    },
  ): Observable<VaultRecord[]> {
    let params = new HttpParams();
    if (filters.tableId) params = params.set('tableId', filters.tableId);
    if (filters.createdBy) params = params.set('createdBy', filters.createdBy);
    if (filters.logic) params = params.set('logic', filters.logic);
    if (filters.filters?.length) params = params.set('filters', JSON.stringify(filters.filters));
    if (filters.sort?.length) params = params.set('sort', JSON.stringify(filters.sort));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<VaultRecord[]>('/api/records', {
      headers: this.toHeaders(headers),
      params,
    });
  }

  getById(headers: RecordHeaders, recordId: string): Observable<VaultRecord> {
    return this.http.get<VaultRecord>(`/api/records/${recordId}`, {
      headers: this.toHeaders(headers),
    });
  }

  replace(headers: RecordHeaders, recordId: string, payload: {
    tableId?: string;
    json?: Record<string, any>;
  }): Observable<VaultRecord> {
    return this.http.put<VaultRecord>(`/api/records/${recordId}`, payload, {
      headers: this.toHeaders(headers),
    });
  }

  patch(headers: RecordHeaders, recordId: string, payload: {
    tableId?: string;
    json?: Record<string, any>;
  }): Observable<VaultRecord> {
    return this.http.patch<VaultRecord>(`/api/records/${recordId}`, payload, {
      headers: this.toHeaders(headers),
    });
  }

  delete(headers: RecordHeaders, recordId: string): Observable<void> {
    return this.http.delete<void>(`/api/records/${recordId}`, {
      headers: this.toHeaders(headers),
    });
  }

  private toHeaders(headers: RecordHeaders): HttpHeaders {
    return new HttpHeaders({
      'x-api-token': headers.apiToken,
      'x-app-id': headers.appId,
    });
  }
}

