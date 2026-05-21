import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { randomUUID } from 'crypto';
import { DataRecord, RecordDocument } from './schemas/record.schema';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';

type QueryLogic = 'and' | 'or';
type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'exists';

interface FilterCondition {
  field: string;
  op: FilterOperator;
  value?: unknown;
}

interface SortCondition {
  field: string;
  dir: 'asc' | 'desc';
}

@Injectable()
export class RecordsService {
  constructor(@InjectModel(DataRecord.name) private recordModel: Model<RecordDocument>) {}

  async create(databaseId: string, dto: CreateRecordDto): Promise<RecordDocument> {
    const record = new this.recordModel({ ...dto, id: dto.id ?? randomUUID(), databaseId: databaseId });
    try {
      return await record.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Record id already exists for this database');
      }
      throw error;
    }
  }

  async query(databaseId: string, query: QueryRecordsDto): Promise<RecordDocument[]> {
    const baseQuery: FilterQuery<DataRecord> = { databaseId };
    if (query.tableId) baseQuery.tableId = query.tableId;
    if (query.createdBy) baseQuery.createdBy = query.createdBy;

    const filters = this.parseJsonArray<FilterCondition>(query.filters, 'filters');
    const sort = this.parseJsonArray<SortCondition>(query.sort, 'sort');
    const logic: QueryLogic = query.logic ?? 'and';
    const clauses = filters.map((condition) => this.buildFilterClause(condition));

    const mongoQuery: FilterQuery<DataRecord> =
      clauses.length === 0
        ? baseQuery
        : logic === 'or'
          ? { ...baseQuery, $or: clauses }
          : { ...baseQuery, $and: clauses };

    let finder = this.recordModel.find(mongoQuery).sort(this.buildSort(sort));
    if (query.limit) {
      finder = finder.limit(query.limit);
    }

    return finder.exec();
  }

  async findOne(databaseId: string, id: string): Promise<RecordDocument> {
    const record = await this.recordModel.findOne({ id, databaseId }).exec();
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  async replace(databaseId: string, id: string, dto: UpdateRecordDto): Promise<RecordDocument> {
    const record = await this.recordModel
      .findOneAndUpdate({ id, databaseId }, { $set: dto }, { new: true })
      .exec();
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  async patch(databaseId: string, id: string, dto: UpdateRecordDto): Promise<RecordDocument> {
    const existing = await this.findOne(databaseId, id);
    const update: UpdateRecordDto = {
      ...dto,
      json: dto.json ? { ...existing.json, ...dto.json } : existing.json,
    };
    const record = await this.recordModel
      .findOneAndUpdate({ id, databaseId }, { $set: update }, { new: true })
      .exec();
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  async remove(databaseId: string, id: string): Promise<void> {
    const result = await this.recordModel.findOneAndDelete({ id, databaseId }).exec();
    if (!result) throw new NotFoundException('Record not found');
  }

  private parseJsonArray<T>(raw: string | undefined, fieldName: string): T[] {
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException(`${fieldName} must be valid JSON`);
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException(`${fieldName} must be a JSON array`);
    }

    return parsed as T[];
  }

  private buildFilterClause(condition: FilterCondition): FilterQuery<DataRecord> {
    if (!condition || typeof condition !== 'object') {
      throw new BadRequestException('Each filter must be an object');
    }

    const { field, op, value } = condition;
    if (!this.isAllowedField(field)) {
      throw new BadRequestException(`Unsupported filter field: ${field}`);
    }

    switch (op) {
      case 'eq':
        return { [field]: value };
      case 'ne':
        return { [field]: { $ne: value } };
      case 'gt':
        return { [field]: { $gt: value } };
      case 'gte':
        return { [field]: { $gte: value } };
      case 'lt':
        return { [field]: { $lt: value } };
      case 'lte':
        return { [field]: { $lte: value } };
      case 'in':
        if (!Array.isArray(value)) throw new BadRequestException('Filter op "in" requires array value');
        return { [field]: { $in: value } };
      case 'nin':
        if (!Array.isArray(value)) throw new BadRequestException('Filter op "nin" requires array value');
        return { [field]: { $nin: value } };
      case 'contains':
        if (typeof value !== 'string') {
          throw new BadRequestException('Filter op "contains" requires string value');
        }
        return { [field]: { $regex: this.escapeRegex(value), $options: 'i' } };
      case 'exists':
        if (typeof value !== 'boolean') {
          throw new BadRequestException('Filter op "exists" requires boolean value');
        }
        return { [field]: { $exists: value } };
      default:
        throw new BadRequestException(`Unsupported filter operator: ${String(op)}`);
    }
  }

  private buildSort(sort: SortCondition[]): Record<string, SortOrder> {
    if (!sort.length) return { createdAt: -1 };

    const sortObj: Record<string, SortOrder> = {};
    for (const condition of sort) {
      if (!condition || typeof condition !== 'object') {
        throw new BadRequestException('Each sort entry must be an object');
      }

      const { field, dir } = condition;
      if (!this.isAllowedField(field)) {
        throw new BadRequestException(`Unsupported sort field: ${field}`);
      }
      if (dir !== 'asc' && dir !== 'desc') {
        throw new BadRequestException(`Unsupported sort direction: ${String(dir)}`);
      }
      sortObj[field] = dir === 'asc' ? 1 : -1;
    }

    return sortObj;
  }

  private isAllowedField(field: string): boolean {
    if (!field || typeof field !== 'string') return false;

    const topLevel = new Set(['id', 'tableId', 'createdBy', 'createdAt']);
    if (topLevel.has(field)) return true;

    // Allow nested JSON paths while blocking Mongo operator/key injection.
    return /^json\.[A-Za-z0-9_.-]+$/.test(field);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
