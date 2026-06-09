# R2 for artifact blobs, served privately through the worker

Lesson and Reference HTML blobs are stored in **Cloudflare R2** (S3-compatible, zero egress), not in Neon. Neon holds only the metadata + conversation, keyed to each blob by its R2 object key. Claude Code publishes a blob with `wrangler r2 object put <bucket>/<key> --file=... --content-type=text/html --remote` — file-based, so no large-string escaping. The bucket is **private**: the worker serves HTML through an R2 binding so it inherits the Cloudflare Access gate (ADR-0004); there is no public `r2.dev` or custom-domain bucket URL.

This reverses an earlier call to make Neon a single hub holding HTML in Postgres columns. That was abandoned because writing multi-KB HTML through MCP SQL (or equivalently through an R2 *MCP* `put`, which also passes the blob as a tool argument) means escaping large strings; uploading from a file sidesteps it entirely.

## Considered Options

- **HTML in Postgres (Neon single hub).** One store, but multi-KB blobs via MCP SQL are awkward and you lose blob-appropriate storage/caching.
- **R2 MCP `r2_put_object`.** A real tool, but the blob is still a tool argument — same escaping pain as SQL.
- **Chosen: R2 via `wrangler r2 object put --file`, private, worker-served.** File-based upload, cheap blob storage, and (with immutable Lessons, ADR-0003) HTML that can be cached by content.

## Consequences

- Two storage systems instead of one (R2 + Neon), bridged by an R2 key stored on each metadata row.
- The bucket must never be made public — doing so would bypass Cloudflare Access. Serving through the worker binding costs a byte-streaming hop (no R2 edge cache directly), which is negligible for a single reader and can be fronted with the Cache API later if needed.
- `wrangler` becomes part of the publish toolchain (it already is, for deploys).
