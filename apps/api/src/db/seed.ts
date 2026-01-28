import { getDatabase } from './database.js';
import { DEFAULT_CATEGORIES, getLocalizedCategories, CATEGORY_NAME_TRANSLATIONS } from '@compasso/shared';
import { DEFAULT_LOCALE, type SupportedLocale } from '@compasso/shared';
import { SUPPORTED_BANKS, BANK_CATEGORY_PATTERNS } from '../parsers/registry.js';

const DEFAULT_WORKSPACE = {
  name: 'Personal',
  description: 'Default workspace',
  color: '#6366f1',
  icon: 'user',
};

export function seedDefaultWorkspace(): number {
  const db = getDatabase();

  // Check if default workspace exists
  const existing = db
    .prepare('SELECT id FROM workspaces WHERE is_default = 1')
    .get() as { id: number } | undefined;

  if (existing) {
    return existing.id;
  }

  console.log('Creating default workspace...');

  const result = db
    .prepare(
      `
    INSERT INTO workspaces (name, description, color, icon, is_default)
    VALUES (?, ?, ?, ?, 1)
  `
    )
    .run(
      DEFAULT_WORKSPACE.name,
      DEFAULT_WORKSPACE.description,
      DEFAULT_WORKSPACE.color,
      DEFAULT_WORKSPACE.icon
    );

  const workspaceId = result.lastInsertRowid as number;
  console.log(`Created default workspace with ID ${workspaceId}`);
  return workspaceId;
}

export function seedDefaultCategories(locale: SupportedLocale = DEFAULT_LOCALE): void {
  const db = getDatabase();

  // First ensure we have a default workspace
  const workspaceId = seedDefaultWorkspace();

  // Check if categories already exist for this workspace
  const count = db
    .prepare('SELECT COUNT(*) as count FROM categories WHERE workspace_id = ?')
    .get(workspaceId) as { count: number };

  if (count.count > 0) {
    console.log('Categories already seeded for default workspace, skipping...');
    return;
  }

  console.log('Seeding default categories...');
  seedCategoriesForWorkspace(workspaceId, locale);
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories`);
}

// Seed categories and patterns for a new workspace from shared constants
export function seedCategoriesForWorkspace(workspaceId: number, locale: SupportedLocale = DEFAULT_LOCALE): void {
  const db = getDatabase();

  const localizedCategories = getLocalizedCategories(locale);

  // Build reverse map: English name -> localized name (for pattern linking)
  const englishToLocalized: Record<string, string> = {};
  for (const cat of DEFAULT_CATEGORIES) {
    const localizedName = CATEGORY_NAME_TRANSLATIONS[cat.name]?.[locale] ?? cat.name;
    englishToLocalized[cat.name] = localizedName;
  }

  const insertCategory = db.prepare(`
    INSERT INTO categories (name, color, icon, is_default, workspace_id)
    VALUES (?, ?, ?, 1, ?)
  `);

  const insertPattern = db.prepare(`
    INSERT INTO category_patterns (category_id, bank_id, pattern, priority)
    VALUES (?, ?, ?, ?)
  `);

  // Use immediate transaction to acquire write lock upfront
  const seedTransaction = db.transaction(() => {
    // Map localized category name -> ID
    const categoryIds: Record<string, number> = {};

    // Insert localized categories
    for (const category of localizedCategories) {
      const result = insertCategory.run(category.name, category.color, category.icon, workspaceId);
      categoryIds[category.name] = result.lastInsertRowid as number;
    }

    // Insert patterns from shared constants
    // BANK_CATEGORY_PATTERNS uses English names as keys, so we map to localized names
    for (const bankId of Object.values(SUPPORTED_BANKS)) {
      const bankPatterns = BANK_CATEGORY_PATTERNS[bankId];
      if (!bankPatterns) continue;

      for (const [englishName, patterns] of Object.entries(bankPatterns)) {
        const localizedName = englishToLocalized[englishName];
        const categoryId = localizedName ? categoryIds[localizedName] : undefined;
        if (!categoryId) continue;

        patterns.forEach((pattern, index) => {
          insertPattern.run(categoryId, bankId, pattern, index);
        });
      }
    }
  });

  // Call with immediate mode to acquire write lock upfront
  seedTransaction.immediate();
}
