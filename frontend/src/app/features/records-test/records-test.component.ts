import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  RecordHeaders,
  RecordQueryFilter,
  RecordQuerySort,
  RecordsApiService,
  VaultRecord,
} from '../../core/records/records-api.service';

type RecordsTestTab = 'query' | 'manage' | 'create';

interface RequestPreview {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: {
    'x-app-id': string;
    'x-api-token': string;
  };
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}

@Component({
  selector: 'app-records-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './records-test.component.html',
  styleUrl: './records-test.component.css',
})
export class RecordsTestComponent {
  appId = '';
  apiToken = '';
  appIdReadonly = false;
  apiTokenReadonly = false;

  createId = '';
  createTableId = 'users';
  createBy = 'manual-tester';
  createJsonText = '{\n  "name": "Alice"\n}';

  queryTableId = '';
  queryCreatedBy = '';
  queryLogic: 'and' | 'or' = 'and';
  queryFiltersText = '[\n  { "field": "json.name", "op": "contains", "value": "ali" }\n]';
  querySortText = '[\n  { "field": "createdAt", "dir": "desc" }\n]';
  queryLimitText = '';

  targetRecordId = '';
  updateTableId = '';
  updateJsonText = '{\n  "status": "updated"\n}';

  records = signal<VaultRecord[]>([]);
  busy = signal(false);
  message = signal('');
  error = signal('');
  resultJson = signal('');
  lastRequestJson = signal('');
  activeTab = signal<RecordsTestTab>('query');

  constructor(private recordsApi: RecordsApiService, private route: ActivatedRoute) {
    this.route.queryParamMap.subscribe((params) => {
      const appId = params.get('appId');
      const apiToken = params.get('apiToken');

      if (appId) {
        this.appId = appId;
        this.appIdReadonly = true;
      }
      if (apiToken) {
        this.apiToken = apiToken;
        this.apiTokenReadonly = true;
      }
    });
  }

  createRecord(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.createJsonText);
    if (!headers || !json || !this.createTableId || !this.createBy) return;

    const payload = {
      id: this.createId || undefined,
      tableId: this.createTableId,
      createdBy: this.createBy,
      json,
    };
    this.captureRequest({
      method: 'POST',
      url: '/api/records',
      headers: this.toRequestHeaders(headers),
      body: payload,
    });

    this.runRequest(
      this.recordsApi.create(headers, payload),
      (record) => {
        this.targetRecordId = record.id;
        this.message.set(`Created record ${record.id}`);
        this.records.update((list) => [record, ...list.filter((r) => r.id !== record.id)]);
      },
    );
  }

  queryRecords(): void {
    const headers = this.getHeaders();
    if (!headers) return;

    const advancedFilters = this.parseJsonArray<RecordQueryFilter>(this.queryFiltersText, 'advanced filters');
    if (advancedFilters === null) return;

    const advancedSort = this.parseJsonArray<RecordQuerySort>(this.querySortText, 'sort clauses');
    if (advancedSort === null) return;

    let limit: number | undefined;
    if (this.queryLimitText.trim()) {
      const parsed = Number(this.queryLimitText);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        this.error.set('Limit must be an integer between 1 and 500');
        return;
      }
      limit = parsed;
    }

    const params: Record<string, string> = {};
    if (this.queryTableId) params['tableId'] = this.queryTableId;
    if (this.queryCreatedBy) params['createdBy'] = this.queryCreatedBy;
    if (advancedFilters.length) params['filters'] = JSON.stringify(advancedFilters);
    if (advancedSort.length) params['sort'] = JSON.stringify(advancedSort);
    if (this.queryLogic !== 'and') params['logic'] = this.queryLogic;
    if (limit !== undefined) params['limit'] = String(limit);
    this.captureRequest({
      method: 'GET',
      url: '/api/records',
      headers: this.toRequestHeaders(headers),
      ...(Object.keys(params).length ? { params } : {}),
    });

    this.runRequest(
      this.recordsApi.query(headers, {
        tableId: this.queryTableId || undefined,
        createdBy: this.queryCreatedBy || undefined,
        logic: this.queryLogic,
        filters: advancedFilters.length ? advancedFilters : undefined,
        sort: advancedSort.length ? advancedSort : undefined,
        limit,
      }),
      (records) => {
        this.records.set(records);
        this.message.set(`Loaded ${records.length} record(s)`);
      },
    );
  }

  getRecord(): void {
    const headers = this.getHeaders();
    if (!headers || !this.targetRecordId) {
      this.error.set('record id is required');
      return;
    }

    this.captureRequest({
      method: 'GET',
      url: `/api/records/${this.targetRecordId}`,
      headers: this.toRequestHeaders(headers),
    });

    this.runRequest(this.recordsApi.getById(headers, this.targetRecordId), (record) => {
      this.updateTableId = record.tableId;
      this.updateJsonText = JSON.stringify(record.json, null, 2);
      this.message.set(`Loaded record ${record.id}`);
    });
  }

  replaceRecord(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.updateJsonText);
    if (!headers || !json || !this.targetRecordId) return;

    const payload = {
      tableId: this.updateTableId || undefined,
      json,
    };
    this.captureRequest({
      method: 'PUT',
      url: `/api/records/${this.targetRecordId}`,
      headers: this.toRequestHeaders(headers),
      body: payload,
    });

    this.runRequest(
      this.recordsApi.replace(headers, this.targetRecordId, payload),
      (record) => this.message.set(`Replaced record ${record.id}`),
    );
  }

  patchRecord(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.updateJsonText);
    if (!headers || !json || !this.targetRecordId) return;

    const payload = {
      tableId: this.updateTableId || undefined,
      json,
    };
    this.captureRequest({
      method: 'PATCH',
      url: `/api/records/${this.targetRecordId}`,
      headers: this.toRequestHeaders(headers),
      body: payload,
    });

    this.runRequest(
      this.recordsApi.patch(headers, this.targetRecordId, payload),
      (record) => this.message.set(`Patched record ${record.id}`),
    );
  }

  deleteRecord(recordId: string): void {
    if (!recordId) return;
    if (!confirm(`Delete record ${recordId}? This cannot be undone.`)) return;

    const headers = this.getHeaders();
    if (!headers) return;

    this.captureRequest({
      method: 'DELETE',
      url: `/api/records/${recordId}`,
      headers: this.toRequestHeaders(headers),
    });

    this.runRequest(this.recordsApi.delete(headers, recordId), () => {
      this.records.update((list) => list.filter((r) => r.id !== recordId));
      if (this.targetRecordId === recordId) this.targetRecordId = '';
      this.message.set(`Deleted record ${recordId}`);
    });
  }

  deleteTargetRecord(): void {
    if (!this.targetRecordId) {
      this.error.set('record id is required');
      return;
    }
    this.deleteRecord(this.targetRecordId);
  }

  setActiveTab(tab: RecordsTestTab): void {
    this.activeTab.set(tab);
  }

  loadForUpdate(record: VaultRecord): void {
    this.targetRecordId = record.id;
    this.updateTableId = record.tableId;
    this.updateJsonText = JSON.stringify(record.json, null, 2);
    this.resultJson.set(JSON.stringify(record, null, 2));
    this.message.set(`Loaded ${record.id} into update form`);
    this.error.set('');
  }

  stringify(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  private getHeaders(): RecordHeaders | null {
    if (!this.appId || !this.apiToken) {
      this.error.set('x-app-id and x-api-token are required');
      return null;
    }
    this.error.set('');
    return { appId: this.appId, apiToken: this.apiToken };
  }

  private parseJson(raw: string): Record<string, any> | null {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error.set('JSON payload must be a JSON object');
        return null;
      }
      this.error.set('');
      return parsed as Record<string, any>;
    } catch {
      this.error.set('Invalid JSON payload');
      return null;
    }
  }

  private parseJsonArray<T>(raw: string, fieldLabel: string): T[] | null {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        this.error.set(`${fieldLabel} must be a JSON array`);
        return null;
      }
      this.error.set('');
      return parsed as T[];
    } catch {
      this.error.set(`${fieldLabel} must be valid JSON`);
      return null;
    }
  }

  private captureRequest(request: RequestPreview): void {
    this.lastRequestJson.set(JSON.stringify(request, null, 2));
  }

  private toRequestHeaders(headers: RecordHeaders): RequestPreview['headers'] {
    return {
      'x-app-id': headers.appId,
      'x-api-token': headers.apiToken,
    };
  }

  private runRequest<T>(
    request$: Observable<T>,
    onSuccess: (result: T) => void,
  ): void {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    request$.subscribe({
      next: (result) => {
        onSuccess(result);
        this.resultJson.set(JSON.stringify(result ?? { ok: true }, null, 2));
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg || err.message || 'Request failed');
        this.busy.set(false);
      },
    });
  }
}

