# Matpick Security Hardening Checklist

## Already addressed in code

- Replace permanently reusable sync tokens with expiring signed tokens for new logins.
- Keep temporary legacy-token validation only as a migration bridge for existing logged-in users.
- Add structured security logs for:
  - rate-limit blocks
  - invalid sync-token writes
  - legacy token usage
  - auth/review/upload failures
- Add rate limits to:
  - `/api/auth/kakao`
  - `/api/auth/naver`
  - `/api/auth/profile`
  - `/api/reviews`
  - `/api/reviews/upload`
- Add same-origin validation to mutating routes.
- Add no-store / noindex API response protections.
- Return clearer session-expired messages for review/profile write actions.
- Fix garbled Korean text on:
  - social login buttons
  - OAuth helper labels/errors
  - privacy policy page
  - terms page

## Vercel dashboard checks

- Add spend alerts and usage notifications.
- Review Firewall / WAF / bot protection settings.
- Confirm no debug endpoints are exposed.
- Confirm deployment logs are not broadly shared.
- Review source map exposure policy.

## Google Cloud checks

- Disable unused APIs and delete unused API keys.
- Set billing budget alerts.
- Set API quotas where possible.
- Audit all active projects and remove non-production projects that are no longer needed.

## Kakao / Naver developer console checks

- Restrict allowed callback URLs.
- Restrict allowed domains/origins for public client IDs where supported.
- Remove test domains that are no longer needed.

## Next code hardening steps

- Remove legacy sync-token fallback after active-user migration.
- Consider server-side session storage instead of client-stored write tokens.
- Route structured security logs into a real log sink / alerting pipeline.
- Review whether stricter CSP can be introduced without breaking ads/maps/social login.
