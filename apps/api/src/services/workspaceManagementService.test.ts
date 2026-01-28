import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));
vi.mock('../db/seed.js', () => ({ seedCategoriesForWorkspace: vi.fn() }));
vi.mock('./workspaceService.js', () => ({
  requireWorkspaceRole: vi.fn().mockReturnValue('owner'),
}));

import { getDatabase } from '../db/database.js';
import { seedCategoriesForWorkspace } from '../db/seed.js';
import { requireWorkspaceRole } from './workspaceService.js';
import { AppError } from '../errors.js';
import {
  listUserWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from './workspaceManagementService.js';

const mockDb = { prepare: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations after clearAllMocks
  vi.mocked(requireWorkspaceRole).mockReturnValue('owner' as any);
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('listUserWorkspaces', () => {
  it('should return mapped workspaces for a user', () => {
    const rows = [
      { id: 1, name: 'Work', description: 'Work stuff', color: '#fff', icon: 'briefcase', is_default: 1, role: 'owner' },
      { id: 2, name: 'Personal', description: null, color: '#000', icon: 'home', is_default: 0, role: 'editor' },
    ];
    const mockAll = vi.fn().mockReturnValue(rows);
    mockDb.prepare.mockReturnValue({ all: mockAll });

    const result = listUserWorkspaces(10);

    expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    expect(mockAll).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(2);
    expect(result[0].isDefault).toBe(true);
    expect(result[1].isDefault).toBe(false);
    expect(result[0].id).toBe(1);
    expect(result[1].role).toBe('editor');
  });
});

describe('getWorkspace', () => {
  it('should return a mapped workspace when found', () => {
    const row = { id: 1, name: 'Work', description: 'desc', color: '#fff', icon: 'briefcase', is_default: 0, role: 'owner' };
    const mockGet = vi.fn().mockReturnValue(row);
    mockDb.prepare.mockReturnValue({ get: mockGet });

    const result = getWorkspace(1, 10);

    expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(1, 10);
    expect(result.id).toBe(1);
    expect(result.isDefault).toBe(false);
  });

  it('should throw not found when workspace does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => getWorkspace(999, 10)).toThrow(AppError);
    expect(() => getWorkspace(999, 10)).toThrow('Workspace not found');
  });
});

describe('createWorkspace', () => {
  it('should create a workspace, seed categories, and return it', () => {
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1 });
    const mockGet = vi.fn().mockReturnValue({ locale: 'en' });
    mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet });

    const data = { name: 'New Workspace', description: 'A workspace', color: '#123', icon: 'star' };
    const result = createWorkspace(10, data);

    expect(result.name).toBe('New Workspace');
    expect(result.role).toBe('owner');
    expect(result.isDefault).toBe(false);
    expect(vi.mocked(seedCategoriesForWorkspace)).toHaveBeenCalledTimes(1);
    // prepare is called 3 times: workspace insert, member insert, locale lookup
    expect(mockDb.prepare).toHaveBeenCalledTimes(3);
  });

  it('should throw bad request when name is missing', () => {
    expect(() => createWorkspace(10, { name: '' })).toThrow(AppError);
    expect(() => createWorkspace(10, { name: '' })).toThrow('Workspace name is required');
  });

  it('should throw bad request when name is undefined', () => {
    expect(() => createWorkspace(10, {} as any)).toThrow('Workspace name is required');
  });
});

describe('updateWorkspace', () => {
  it('should update workspace fields', () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });
    mockDb.prepare.mockReturnValue({ run: mockRun });

    expect(() => updateWorkspace(1, 10, { name: 'Updated' })).not.toThrow();
    expect(vi.mocked(requireWorkspaceRole)).toHaveBeenCalledWith(1, 10, ['owner', 'editor']);
  });

  it('should throw bad request when no fields are provided', () => {
    expect(() => updateWorkspace(1, 10, {})).toThrow(AppError);
    expect(() => updateWorkspace(1, 10, {})).toThrow('No fields to update');
  });

  it('should throw not found when workspace does not exist', () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 0 });
    mockDb.prepare.mockReturnValue({ run: mockRun });

    expect(() => updateWorkspace(999, 10, { name: 'X' })).toThrow(AppError);
    expect(() => updateWorkspace(999, 10, { name: 'X' })).toThrow('Workspace not found');
  });

  it('should throw forbidden when user lacks required role', () => {
    vi.mocked(requireWorkspaceRole).mockImplementation(() => {
      throw AppError.forbidden('You do not have permission to perform this action');
    });

    expect(() => updateWorkspace(1, 10, { name: 'X' })).toThrow(AppError);
    expect(() => updateWorkspace(1, 10, { name: 'X' })).toThrow('You do not have permission');
  });
});

describe('deleteWorkspace', () => {
  it('should delete a non-default workspace', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 1, is_default: 0 });
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });
    mockDb.prepare
      .mockReturnValueOnce({ get: mockGet })
      .mockReturnValueOnce({ run: mockRun });

    expect(() => deleteWorkspace(1, 10)).not.toThrow();
    expect(vi.mocked(requireWorkspaceRole)).toHaveBeenCalledWith(1, 10, ['owner']);
  });

  it('should throw not found when workspace does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => deleteWorkspace(999, 10)).toThrow(AppError);
    expect(() => deleteWorkspace(999, 10)).toThrow('Workspace not found');
  });

  it('should throw bad request when trying to delete the default workspace', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 1, is_default: 1 });
    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => deleteWorkspace(1, 10)).toThrow(AppError);
    expect(() => deleteWorkspace(1, 10)).toThrow('Cannot delete the default workspace');
  });

  it('should throw forbidden when user lacks owner role', () => {
    vi.mocked(requireWorkspaceRole).mockImplementation(() => {
      throw AppError.forbidden('You do not have permission to perform this action');
    });

    expect(() => deleteWorkspace(1, 10)).toThrow(AppError);
    expect(() => deleteWorkspace(1, 10)).toThrow('You do not have permission');
  });
});
