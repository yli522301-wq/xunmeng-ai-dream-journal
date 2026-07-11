# Security Notes

This repository is open source. Do not commit real API keys, database passwords,
tokens, model credentials, or private service URLs.

## Secrets

Use `.env.example` to document required variables. Keep real values in local
`.env` files or in the deployment platform's environment variable / secret
manager.

The following files are intentionally ignored:

- `.env`
- `.env.*`
- `!.env.example`

Before publishing, run:

```bash
git status --short
git grep -n -E "OPENAI_API_KEY=.*[A-Za-z0-9]|ELEVENLABS_API_KEY=.*[A-Za-z0-9]|DATABASE_URL=.*://" -- ':!DEPLOYMENT.md' ':!SECURITY.md'
```

The `git grep` command should produce no output for real secrets.

## If a Secret Leaks

1. Revoke or rotate the leaked key immediately.
2. Remove the secret from the repository.
3. If the secret was committed, clean the Git history before relying on the
   repository again.
4. Review deployment logs, screenshots, and issue comments for accidental
   exposure.
