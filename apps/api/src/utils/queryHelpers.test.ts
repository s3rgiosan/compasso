import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { requireQueryInt, optionalQueryInt, optionalQueryString } from './queryHelpers.js';
import { AppError } from '../errors.js';

function fakeRequest(query: Record<string, string>): Request {
  return { query } as unknown as Request;
}

describe('requireQueryInt', () => {
  it('returns parsed integer for valid value', () => {
    expect(requireQueryInt(fakeRequest({ workspaceId: '42' }), 'workspaceId')).toBe(42);
  });

  it('throws when param is missing', () => {
    expect(() => requireQueryInt(fakeRequest({}), 'workspaceId')).toThrow(AppError);
    expect(() => requireQueryInt(fakeRequest({}), 'workspaceId')).toThrow('workspaceId is required');
  });

  it('throws when param is not a valid integer', () => {
    expect(() => requireQueryInt(fakeRequest({ workspaceId: 'abc' }), 'workspaceId')).toThrow(AppError);
    expect(() => requireQueryInt(fakeRequest({ workspaceId: 'abc' }), 'workspaceId')).toThrow(
      'workspaceId must be a valid integer',
    );
  });
});

describe('optionalQueryInt', () => {
  it('returns parsed integer for valid value', () => {
    expect(optionalQueryInt(fakeRequest({ limit: '10' }), 'limit')).toBe(10);
  });

  it('returns undefined when param is missing and no default', () => {
    expect(optionalQueryInt(fakeRequest({}), 'limit')).toBeUndefined();
  });

  it('returns default when param is missing', () => {
    expect(optionalQueryInt(fakeRequest({}), 'limit', 20)).toBe(20);
  });

  it('throws when param is not a valid integer', () => {
    expect(() => optionalQueryInt(fakeRequest({ limit: 'abc' }), 'limit')).toThrow(AppError);
    expect(() => optionalQueryInt(fakeRequest({ limit: 'abc' }), 'limit')).toThrow(
      'limit must be a valid integer',
    );
  });
});

describe('optionalQueryString', () => {
  it('returns string value when present', () => {
    expect(optionalQueryString(fakeRequest({ name: 'test' }), 'name')).toBe('test');
  });

  it('returns undefined when param is missing', () => {
    expect(optionalQueryString(fakeRequest({}), 'name')).toBeUndefined();
  });
});
