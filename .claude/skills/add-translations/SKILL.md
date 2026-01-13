---
name: add-translations
description: Instructions for adding i18n translations to the codebase. Use when replacing hardcoded text with translation keys.
---

# i18n Translation Instructions

## Your Task

When you encounter hardcoded UI-visible text in the `src/` directory, you MUST:

1. Replace it with a translation key using the `t()` function
2. Add the translation key to the appropriate Dutch translation file in `src/translations/nl/`
3. Follow the naming conventions and file mapping rules below

## Step 1: Create Translation Keys

### Naming Rules

- ALWAYS use `UPPER_SNAKE_CASE` for all translation keys
- Include component/feature prefixes for context when appropriate
- Use descriptive names that indicate the text's purpose

### Key Patterns

- **Generic actions**: Use simple action names
  - Examples: `SAVE`, `CANCEL`, `DELETE`, `EDIT`, `CREATE`, `CLOSE`
- **Feature-specific**: Use `FEATURE_CONTEXT_DESCRIPTION` pattern
  - Examples: `CUSTOMER_PRODUCTS_MANAGE`, `WORKFLOW_PHASE_COMPLETE`, `TASK_DEADLINE_EXPIRED`
- **With variables**: Use `{{variableName}}` syntax in the translation value
  - Example key: `MANAGE_WITH_VARIABLE` with value `"{{name}} beheren"`
  - Example key: `ITEMS_COUNT` with value `"{{count}} items"`

## Step 2: Choose the Correct Translation File

Map hardcoded text to the appropriate translation file in `src/translations/nl/`. All files are merged together (no namespaces).

**Use Basic.ts for:**

- Common UI elements (buttons, labels, actions, validations, dates, generic messages)

**Use feature-specific files for:**

- **CRM.ts** - Customer/Person/Contact related features
- **Dashboard.ts** - Dashboard specific features
- **Dossier.ts** - Document/file management features
- **Tasks.ts** - Task management features
- **Threads.ts** - Messaging/communication features
- **Workflows.ts** - Workflow related features
- **Settings.ts** - Settings and configuration features
- **ProductsPackages.ts** - Products and packages features
- **Notes.ts** - Notes features
- **VoipCalls.ts** - Phone calls features
- **Planboard.ts** - Planning features
- **AutoPlanner.ts** - Auto planner features

## Step 3: Replace Hardcoded Text

### What to Translate

Focus on these locations where UI-visible text appears:

- Component render methods with JSX
- Modal titles and buttons
- Form labels and placeholders
- Toast messages and alerts
- Table headers and cells
- Badge and status text
- Empty state messages
- Error messages shown to users

### Implementation Pattern

Replace hardcoded strings with the translation function:

```tsx
// ❌ WRONG - Don't do this
<Button>Opslaan</Button>
<div>Geen resultaten gevonden</div>

// ✅ CORRECT - Do this instead
<Button>{t("SAVE")}</Button>
<div>{t("NO_RESULTS_FOUND")}</div>
```

### Notification Messages

```tsx
// ❌ WRONG
notification.success('De actie is succesvol uitgevoerd');

// ✅ CORRECT
notification.success(t('ACTION_SUCCESS'));
```

## Step 4: Add Translation to File

### Before Adding a New Key

1. **Check for existing keys first** - Search the translation files to see if a similar key already exists
2. **Reuse when possible** - If the text and context match, use the existing key instead of creating a duplicate

### Adding the Translation

1. Open the appropriate translation file in `src/translations/nl/`
2. Find the relevant section (grouped by category)
3. Add your new key following the existing grouping pattern
4. Use the exact Dutch text that was hardcoded as the translation value

### Organization Pattern

Group related keys together with comments:

```typescript
// Basic.ts example
export default {
	// Actions
	SAVE: 'Opslaan',
	CANCEL: 'Annuleren',
	DELETE: 'Verwijderen',

	// States
	NO_RESULTS_FOUND: 'Geen resultaten gevonden',
	LOADING: 'Laden...',

	// Messages
	ACTION_SUCCESS: 'De actie is succesvol uitgevoerd',
};
```

## What NOT to Translate

DO NOT translate or replace these items:

- Code comments
- Console logs (console.log, console.error, etc.)
- Error codes for debugging
- Test files (_.test.ts, _.spec.ts)
- Configuration files (config.json, \*.config.js)
- Type definitions and TypeScript types
- Variable names and function names
- Import/export statements
- API endpoint URLs
- Technical error messages for developers
- Type annotations like `Promise`, `Array`, `Collection`

## Quality Checklist

Before completing your translation work, verify:

- [ ] All UI-visible hardcoded strings are replaced with `t()` calls
- [ ] Translation keys follow `UPPER_SNAKE_CASE` convention
- [ ] Keys are added to the appropriate translation file
- [ ] Keys are organized and grouped logically with related keys
- [ ] No excluded content (logs, comments, etc.) was translated
- [ ] Existing similar translations were checked and reused when applicable
- [ ] Variable interpolation uses correct `{{variableName}}` syntax
- [ ] Generic keys are in Basic.ts, feature-specific keys are in appropriate feature files
