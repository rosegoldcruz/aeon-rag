# Agent Rules

## Private Corpus Rule

Never commit private corpus artifacts.

The following are runtime/private data and must never be committed to Git:
- Google Drive manifests
- RAG manifests
- file inventories
- upload directories
- import directories
- document indexes
- embedding outputs
- vector export files
- extracted document text
- user files
- client files
- personal documents
- generated TSV/JSONL manifest files

These paths must always be ignored:
- storage/manifests/
- storage/imports/
- storage/uploads/
- *.jsonl
- *.tsv
- tsconfig.tsbuildinfo

If a task generates any corpus artifact, keep it local on the server only.

Before every commit, run:
- git status --short
- git ls-files | grep -E 'storage/manifests|storage/imports|storage/uploads|\.jsonl$|\.tsv$|tsconfig\.tsbuildinfo' && stop

If any private corpus file appears in Git, stop immediately. Do not commit. Do not push.
