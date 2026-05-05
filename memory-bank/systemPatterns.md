# System Patterns

## Architectural Patterns

- Pattern 1: Description

## Design Patterns

- Pattern 1: Description

## Common Idioms

- Idiom 1: Description

## Wave Blue Design Language

The app uses Wave Blue (#1dc5ff) as the primary trust color, paired with clean whites, slate text, rounded surfaces, and large high-contrast CTAs. Campaign cards should feel lightweight and mobile-first, with edge-to-edge imagery, bold progress bars, and donation actions that are easy to tap on low-end phones. QR code and expenditure proof areas should remain uncluttered and visually distinct from campaign browsing.

### Examples

- frontend-next/src/components/providers.tsx
- frontend-next/src/app/globals.css
- frontend-next/src/app/(public)/page.tsx
- frontend-next/src/components/auth/login-form.tsx


## Responsive table fallback

Shared data tables must collapse from dense row layouts into stacked cards on compact screens. Each card should label fields clearly, preserve actions, and avoid horizontal scrolling on small phones.

### Examples

- frontend-next/src/components/tables/tanstack-data-grid.tsx
- frontend-next/src/app/(admin)/admin/campaigns/page.tsx
- frontend-next/src/app/(admin)/admin/users/page.tsx
- frontend-next/src/app/(admin)/admin/moderation/page.tsx
