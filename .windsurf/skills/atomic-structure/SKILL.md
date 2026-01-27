# Atomic Philosophy

> A skill for writing clean, maintainable React components by splitting them into smaller, reusable atomic units.

## Core Principle

**A component should do ONE thing well.** If you can describe what a component does and you use the word "and", it's probably doing too much.

---

## The 100x Developer Test

Before committing code, ask yourself:

1. **Can I understand this file in under 60 seconds?**
2. **Can a new developer navigate this without asking questions?**
3. **If I delete this component, how many other files break?** (fewer = better isolation)
4. **Does this component have a single, clear responsibility?**

---

## Atomic Hierarchy

Structure components in layers of increasing complexity:

```
atoms/          →  Single-purpose UI primitives (Button, Input, Label, Badge)
molecules/      →  Small combinations of atoms (FileCard, DropZone, SearchInput)
organisms/      →  Complex UI sections (ImporterSection, AccountsTab)
templates/      →  Page layouts
pages/          →  Full pages with data fetching
```

---

## When to Split a Component

### ✅ SPLIT when:

| Signal | Example |
|--------|---------|
| **> 150 lines** | File is getting long and hard to scan |
| **Repeated JSX blocks** | Same card structure rendered in a loop |
| **Multiple `useState` groups** | Separate concerns managing different state |
| **Conditional rendering blocks > 20 lines** | Large `if/else` or ternary JSX |
| **Props drilling > 2 levels** | Passing props through intermediate components |
| **File has multiple "sections"** | Visually distinct areas that could be named |

### ❌ DON'T SPLIT when:

- Component is < 50 lines and simple
- Split would create excessive prop passing
- Logic is tightly coupled and splitting adds complexity
- You're splitting just to split (premature abstraction)

---

## Extraction Patterns

### Pattern 1: Extract Repeated Items

**Before:**
```tsx
{files.map((file) => (
  <div className="flex items-center gap-3 p-4 border rounded-lg">
    <Icon className="w-5 h-5" />
    <div>
      <div className="font-medium">{file.name}</div>
      <div className="text-sm text-muted">{file.size}</div>
    </div>
    <Button onClick={() => remove(file.id)}>Remove</Button>
  </div>
))}
```

**After:**
```tsx
// molecules/FileCard.tsx
export function FileCard({ file, onRemove }: FileCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      <Icon className="w-5 h-5" />
      <div>
        <div className="font-medium">{file.name}</div>
        <div className="text-sm text-muted">{file.size}</div>
      </div>
      <Button onClick={onRemove}>Remove</Button>
    </div>
  );
}

// Usage
{files.map((file) => (
  <FileCard key={file.id} file={file} onRemove={() => remove(file.id)} />
))}
```

---

### Pattern 2: Extract Conditional States

**Before:**
```tsx
function ImporterSection({ isProcessing, ...props }) {
  if (isProcessing) {
    return (
      <Card>
        {/* 50 lines of processing UI */}
      </Card>
    );
  }
  
  return (
    <Card>
      {/* 200 lines of main UI */}
    </Card>
  );
}
```

**After:**
```tsx
// molecules/ProcessingState.tsx
export function ProcessingState({ stage, progress }) {
  return (
    <Card>
      {/* Processing UI */}
    </Card>
  );
}

// organisms/ImporterSection.tsx
function ImporterSection({ isProcessing, ...props }) {
  if (isProcessing) {
    return <ProcessingState stage={props.stage} progress={props.progress} />;
  }
  
  return <ImporterForm {...props} />;
}
```

---

### Pattern 3: Extract Logical Sections

**Before:**
```tsx
return (
  <Card>
    <CardHeader>...</CardHeader>
    <CardContent>
      {/* Drop zone - 40 lines */}
      <div className="border-dashed ...">
        ...
      </div>
      
      {/* File list - 60 lines */}
      <div className="space-y-2">
        {files.map(...)}
      </div>
      
      {/* Saved imports - 50 lines */}
      <div className="space-y-2">
        {savedDocs.map(...)}
      </div>
    </CardContent>
  </Card>
);
```

**After:**
```tsx
return (
  <Card>
    <CardHeader>...</CardHeader>
    <CardContent>
      <DropZone onDrop={onDrop} isDragging={isDragging} />
      <FileList files={files} onRemove={removeFile} />
      <SavedImportsList docs={savedDocs} onSelect={setSelectedSavedId} />
    </CardContent>
  </Card>
);
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Display components** | Noun | `FileCard`, `DropZone`, `ScoreGauge` |
| **Container components** | Noun + "Section/List/View" | `ImporterSection`, `FileList` |
| **Action components** | Verb + Noun | `SubmitButton`, `DeleteDialog` |
| **State components** | State + "State/View" | `LoadingState`, `EmptyState`, `ErrorView` |

---

## File Structure

```
components/
├── atoms/
│   ├── button.tsx
│   ├── input.tsx
│   └── card.tsx
├── molecules/
│   ├── FileCard/
│   │   ├── FileCard.tsx
│   │   ├── FileCard.types.ts      # Optional: if props are complex
│   │   └── index.ts
│   ├── DropZone.tsx
│   └── ProcessingAnimation.tsx
└── organisms/
    └── sections/
        ├── ImporterSection.tsx
        └── InlineCreditReportView.tsx
```

---

## Props Interface Rules

1. **Keep interfaces close to usage** - Define in the same file unless shared
2. **Use descriptive names** - `onFileRemove` not `onRemove` if ambiguous
3. **Prefer callbacks over state setters** - `onSelect` not `setSelected`
4. **Group related props** - `file: FileItem` not `fileName, fileSize, fileType`

---

## The Refactor Checklist

When splitting a component:

- [ ] New component has a clear, single purpose
- [ ] Props interface is minimal but complete
- [ ] No circular dependencies created
- [ ] Parent component is now easier to read
- [ ] New component is potentially reusable elsewhere
- [ ] File is in the correct atomic layer (atom/molecule/organism)
- [ ] Naming clearly describes what the component renders

---

## Anti-Patterns to Avoid

### ❌ Over-abstraction
Creating `<Wrapper>`, `<Container>`, `<Box>` components that add no semantic value.

### ❌ Prop explosion
Splitting creates a component with 15+ props - might be better kept together.

### ❌ Splitting coupled logic
Two pieces of state that always change together shouldn't be in separate components.

### ❌ One-use abstractions
Creating a component used exactly once with no reuse potential.

---

## Quick Reference

| File Size | Action |
|-----------|--------|
| < 100 lines | ✅ Probably fine |
| 100-200 lines | 🟡 Review for extraction opportunities |
| 200-300 lines | 🟠 Likely needs splitting |
| > 300 lines | 🔴 Definitely needs splitting |

**Remember:** The goal is *readability* and *maintainability*, not minimizing line count. Split with purpose.
