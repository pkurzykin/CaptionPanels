# Specification Documentation

This folder is the canonical location for versioned JSON contracts and schemas.

Repository convention:
- Legacy components are moved to `archive/` (for example `archive/legacy_cep`) and are not part of active specs.

Current v1 schemas:
- [`config.schema.json`](config.schema.json)
  - `config.json` contract (sectioned format + legacy flat keys for compatibility).
- [`job.schema.json`](job.schema.json)
  - job contract for `host/lib/job_runner.jsx` (`schemaVersion=1`, `type`, `payload`).
- [`results.schema.json`](results.schema.json)
  - run manifest contract (`run.json`) for `host/lib/run_registry.jsx`.

Related runtime schemas (payload-level validation):
- [`../schemas/import.schema.json`](../schemas/import.schema.json)
- [`../schemas/blocks.schema.json`](../schemas/blocks.schema.json)
- [`../schemas/alignment.schema.json`](../schemas/alignment.schema.json)

Reference notes:
- [`../SCHEMAS_REFERENCE_RU.md`](../SCHEMAS_REFERENCE_RU.md)

Compatibility policy:
- `config.schema.json` intentionally allows extra properties (`additionalProperties: true`) to avoid breaking existing custom keys.
- Versioning for these schemas starts at v1 and evolves in dedicated spec PRs.
