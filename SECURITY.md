# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub's
"Report a vulnerability" button on the Security tab of this repository, or by email to the maintainer at the
address on the GitHub profile https://github.com/LapaluLiyanage.

Include what you found, how to reproduce it, and the version (see `package.json`). You can expect an
acknowledgement within a few days.

## Supported versions

Only the latest release receives fixes.

## Notes for people running their own copy

- Never commit `server/.env` or `client/.env`. Only the Supabase **publishable** key belongs in the client;
  keep `YOUTUBE_API_KEY` and `GETSONGBPM_API_KEY` on the server.
- Keep row-level security enabled by running `supabase/schema.sql` unchanged.
