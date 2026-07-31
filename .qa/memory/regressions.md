# NodeBook QA regressions

- Do not substitute the NodeKit-generated deterministic demo for the real production notebook application.
- The query UI and API must share one typed response contract; natural-language provider output is not JSON-parsed.
- Production requests without a bearer token must return 401 and must never fall through to the shared anonymous user.
- A successful agent answer must disclose when its receipt could not be stored.
