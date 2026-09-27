# English display and catalog delivery

## English scope

Korean remains a supported locale. English mode uses English UI copy, food vocabulary, price and serving labels, and romanized proper names and addresses. Original values remain intact for storage and map directions. English display does not certify an official English restaurant name or a postal-standard English address.

The food glossary is partial. A glossary match can translate only part of a menu label; it is not proof that the whole menu has an authored English translation. Unresolved names use romanization. See `deliverables/english-menu-coverage.json` for the canonical dataset audit. Korean freeform user reviews are not machine-translated; an English availability notice is shown instead. Do not advertise that every menu and review has been translated.

## Data protection boundary

The browser should receive a bounded result page or a single restaurant, not a JavaScript asset containing the complete restaurant database. Public metadata counts can remain visible without distributing all restaurant records. Administrator catalog access requires existing server-side authorization.

Rate limits and browser request checks deter simple bulk collection. Request headers can be imitated; these checks are not proof of a human visitor or a substitute for authentication. Publicly visible restaurant information and SEO pages can still be copied. No absolute anti-crawling guarantee is made.

Production-wide counters require the existing KV/Upstash Redis environment settings. Without that store, counters are process-local and can reset between serverless instances. Never expose or commit Redis credentials. Search engine indexing must remain compatible with the site's discovery goals; robots directives are advisory.

## Release checks

- TypeScript and production build pass.
- Bounded result pagination, nearest-first matching, admin edits/deletions, source/episode filters, and authentic admin access are checked.
- Production browser assets contain no full catalog; the bundle checker rejects bulk payload regressions.
- Existing deployment function limits remain satisfied.
- A git push is not evidence of a successful production deployment; verify the deployment separately before reporting it as live.
