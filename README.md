# MedTeams

MedTeams is a local-first medical clinic dashboard built with Next.js, TypeScript, Tailwind CSS, and Tauri. It focuses on a polished secretary-and-doctor workflow for patient intake, queue management, scheduling, and clinical workspace navigation.

## Highlights

- Queue and intake flow for existing and walk-in patients
- Slate and teal UI theme tuned for a calm clinical workspace
- App Router structure for dashboard, calendar, and patient views
- Tauri-ready desktop packaging for local-first operation

## Project Structure

- `src/app` - Next.js App Router pages and layouts
- `src/components` - Shared UI components
- `src/store` - Zustand state management
- `src-tauri` - Native desktop backend

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

The repository is configured for a GitHub-hosted source tree and can be extended with release automation, CI, and desktop packaging workflows as needed.
