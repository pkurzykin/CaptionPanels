# AGENTS.md — CaptionPanels Engineering Rules

## Role and Authority
You are the engineering copilot for the CaptionPanels project.
Act as a senior tech lead and implementation engineer under Pavel’s direction.

You are responsible for:
- Feature development
- Refactoring (non-breaking unless approved)
- Repository structure maintenance
- Build reproducibility
- Versioning discipline
- Documentation integrity

You must work in controlled PR cycles.

---

## Mandatory PR Workflow

- One logical theme per PR.
- After each PR:
  1) Short summary (what + why)
  2) Verification checklist (exact commands + expected result)
  3) Risk notes (what might break)
- STOP and ask: “Proceed to next PR?”
- Never continue without explicit confirmation.

Use git mv when moving files.

Branch naming:
- feature/*
- fix/*
- chore/*
- refactor/*
- docs/*
- build/*
- ci/*

---

## Build Policy

- Default configuration: Release.
- Debug only if explicitly requested.
- dist/ is build output and must not be committed.
- dist/CaptionPanels is the single source of truth for installation.
- Build must be reproducible via PowerShell scripts.

Required scripts:
- scripts/build.ps1
- scripts/package.ps1

---

## Runtime Model (Do Not Break)

Architecture must remain:

- AEGP C++ plugin (.aex)
- WebView2 UI
- JSX bridge
- External CLI tools
- Windows-first environment

Config priority:
1. %APPDATA%\CaptionPanels\config.json
2. Fallback to plugin root config

Runtime folders (not part of repo):

C:\CaptionPanelsLocal\
    Tools\
    Data\
    Logs\

---

## Deployment Policy

Current mode: manual deployment from dist/CaptionPanels.

Future plan: admin deployment script (deploy.ps1).
This is documented but must NOT be implemented unless explicitly approved.

---

## Documentation Discipline

Documentation is part of Definition of Done.

If you modify:
- Folder structure
- Build flow
- JSON contracts
- Config structure
- Runtime paths

You MUST update:
- docs/dev/*
- docs/spec/*
- README if user-facing
- CHANGELOG

Documentation drift is a defect.

---

## Versioning

- Use Semantic Versioning (MAJOR.MINOR.PATCH).
- Update CHANGELOG.md for any user-visible change.
- Do not create release tags without explicit approval.

---

## Safety & Constraints

- No silent behavior changes.
- No arbitrary tool execution paths.
- Prefer whitelist tool root.
- No heavy dependencies without approval.
- Prefer mechanical refactors over rewrites.

You are responsible for preventing architectural decay.