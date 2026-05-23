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
import { CurlSettingsService } from '../../core/records/curl-settings.service';

type RecordsTestTab = 'query' | 'manage' | 'create' | 'bulk-patch';

interface RequestPreview {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: {
    'x-database-id': string;
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
  databaseId = '';
  apiToken = '';
  databaseIdReadonly = false;
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

  bulkPatchRecordIdsText = '';
  bulkPatchJsonText = '{\n  "status": "bulk-updated"\n}';

  records = signal<VaultRecord[]>([]);
  busy = signal(false);
  message = signal('');
  error = signal('');
  resultJson = signal('');
  lastRequestJson = signal('');
  activeTab = signal<RecordsTestTab>('query');

  constructor(
    private recordsApi: RecordsApiService,
    private route: ActivatedRoute,
    private curlSettings: CurlSettingsService,
  ) {
    this.route.queryParamMap.subscribe((params) => {
      const databaseId = params.get('databaseId');
      const apiToken = params.get('apiToken');

      if (databaseId) {
        this.databaseId = databaseId;
        this.databaseIdReadonly = true;
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

  copyCreateAsCurl(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.createJsonText);
    if (!headers || !json || !this.createTableId || !this.createBy) return;

    const payload = {
      id: this.createId || undefined,
      tableId: this.createTableId,
      createdBy: this.createBy,
      json,
    };
    this.copyRequestAsCurl({
      method: 'POST',
      url: '/api/records',
      headers: this.toRequestHeaders(headers),
      body: payload,
    });
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

  copyQueryAsCurl(): void {
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

    this.copyRequestAsCurl({
      method: 'GET',
      url: '/api/records',
      headers: this.toRequestHeaders(headers),
      ...(Object.keys(params).length ? { params } : {}),
    });
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

  copyPutAsCurl(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.updateJsonText);
    if (!headers || !json || !this.targetRecordId) {
      if (!this.targetRecordId) this.error.set('record id is required');
      return;
    }

    const payload = {
      tableId: this.updateTableId || undefined,
      json,
    };
    this.copyRequestAsCurl({
      method: 'PUT',
      url: `/api/records/${this.targetRecordId}`,
      headers: this.toRequestHeaders(headers),
      body: payload,
    });
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

  copyPatchAsCurl(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.updateJsonText);
    if (!headers || !json || !this.targetRecordId) {
      if (!this.targetRecordId) this.error.set('record id is required');
      return;
    }

    const payload = {
      tableId: this.updateTableId || undefined,
      json,
    };
    this.copyRequestAsCurl({
      method: 'PATCH',
      url: `/api/records/${this.targetRecordId}`,
      headers: this.toRequestHeaders(headers),
      body: payload,
    });
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

  copyDeleteAsCurl(recordId?: string): void {
    const effectiveRecordId = recordId ?? this.targetRecordId;
    if (!effectiveRecordId) {
      this.error.set('record id is required');
      return;
    }

    const headers = this.getHeaders();
    if (!headers) return;

    this.copyRequestAsCurl({
      method: 'DELETE',
      url: `/api/records/${effectiveRecordId}`,
      headers: this.toRequestHeaders(headers),
    });
  }

  initiateBulkPatch(): void {
    const recordIds = this.records().map((r) => r.id);
    if (recordIds.length === 0) {
      this.error.set('No records to patch');
      return;
    }
    this.bulkPatchRecordIdsText = JSON.stringify(recordIds, null, 2);
    this.setActiveTab('bulk-patch');
  }

  bulkPatchRecords(): void {
    const headers = this.getHeaders();
    const json = this.parseJson(this.bulkPatchJsonText);
    if (!headers || !json) return;

    const recordIds = this.parseBulkPatchRecordIds();
    if (!recordIds || recordIds.length === 0) return;

    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    let completed = 0;
    let failed = 0;
    const errors: string[] = [];

    recordIds.forEach((recordId) => {
      const payload = { json };
      this.recordsApi.patch(headers, recordId, payload).subscribe({
        next: () => {
          completed++;
          if (completed + failed === recordIds.length) {
            this.finalizeBulkPatch(completed, failed, errors);
          }
        },
        error: (err: HttpErrorResponse) => {
          failed++;
          const msg = err.error?.message || err.message;
          errors.push(`${recordId}: ${msg}`);
          if (completed + failed === recordIds.length) {
            this.finalizeBulkPatch(completed, failed, errors);
          }
        },
      });
    });

    this.captureRequest({
      method: 'PATCH',
      url: `/api/records/[${recordIds.length} records]`,
      headers: this.toRequestHeaders(headers),
      body: { recordIds, json },
    });
  }

  private finalizeBulkPatch(completed: number, failed: number, errors: string[]): void {
    this.busy.set(false);
    if (failed === 0) {
      this.message.set(`Successfully patched ${completed} record(s)`);
      this.resultJson.set(JSON.stringify({ patched: completed, failed, errors: [] }, null, 2));
    } else {
      this.error.set(`Patched ${completed}, failed ${failed}`);
      this.resultJson.set(JSON.stringify({ patched: completed, failed, errors }, null, 2));
    }
  }

  private parseBulkPatchRecordIds(): string[] | null {
    const trimmed = this.bulkPatchRecordIdsText.trim();
    if (!trimmed) {
      this.error.set('Record IDs are required');
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        this.error.set('Record IDs must be a JSON array of strings');
        return null;
      }
      if (!parsed.every((id): id is string => typeof id === 'string')) {
        this.error.set('All record IDs must be strings');
        return null;
      }
      this.error.set('');
      return parsed;
    } catch {
      this.error.set('Record IDs must be valid JSON');
      return null;
    }
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
    if (!this.databaseId || !this.apiToken) {
      this.error.set('x-database-id and x-api-token are required');
      return null;
    }
    this.error.set('');
    return { databaseId: this.databaseId, apiToken: this.apiToken };
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
      'x-database-id': headers.databaseId,
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

  private copyRequestAsCurl(request: RequestPreview): void {
    this.captureRequest(request);
    const curlCommand = this.toCurlCommand(request);

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.error.set('Clipboard API is not available in this browser.');
      return;
    }

    navigator.clipboard
      .writeText(curlCommand)
      .then(() => {
        this.error.set('');
        this.message.set('Copied as cURL command.');
      })
      .catch(() => {
        this.error.set('Could not copy cURL command to clipboard.');
      });
  }

  private toCurlCommand(request: RequestPreview): string {
    const url = this.withQueryParams(this.curlSettings.toAbsoluteUrl(request.url), request.params);
    const command = ['curl', '-X', request.method, this.shellQuote(url)];

    Object.entries(request.headers).forEach(([key, value]) => {
      command.push('-H', this.shellQuote(`${key}: ${value}`));
    });

    if (request.body !== undefined) {
      command.push('-H', this.shellQuote('Content-Type: application/json'));
      command.push('--data-raw', this.shellQuote(JSON.stringify(request.body)));
    }

    return command.join(' ');
  }

  private withQueryParams(url: string, params?: Record<string, string>): string {
    if (!params || Object.keys(params).length === 0) return url;

    const queryString = new URLSearchParams(params).toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `"'"'`)}'`;
  }
}

