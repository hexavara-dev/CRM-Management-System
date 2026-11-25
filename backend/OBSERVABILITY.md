# HTTP error logging

Every HTTP request receives an `X-Request-Id`. Successful requests emit a compact
`[HTTP]` JSON line. Failed requests (`4xx` and `5xx`) additionally contain:

- `failure.message`, `errorType`, `errorCode`, internal message, and stack;
- authenticated actor identifiers when available;
- route parameters and the failed request body;
- upload field, MIME type, and size metadata.

Failure data is bounded and sanitized before it reaches stdout. Passwords, tokens,
cookies, authorization values, API/private keys, credentials, JWTs, database URLs,
and binary file contents are always replaced with `[REDACTED]` or a binary-size
placeholder. Query strings and request headers are never logged.

Logs are written as structured stdout/stderr instead of application-managed files.
Production process managers and container platforms must persist and rotate these
streams. Use the response `requestId` or `X-Request-Id` to find the matching log line.

Do not add controller-specific body logging. Extend `LogSanitizer.ts` when a new
sensitive field is introduced, and cover it with a sanitizer test.
