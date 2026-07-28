# Splitting a file too big for one subagent

Reached from [SKILL.md](SKILL.md) when a source lesson or reference runs over ~600
lines (or ~40 KB). Such a file is translated in **sections, across waves** — the
exception, not the routine. Split it mechanically, so even a huge reference stays
**sight unseen**:

```sh
mkdir -p "topics/$SLUG/.parts/<key>"
csplit -z -s -f "topics/$SLUG/.parts/<key>/" -b '%02d.src.html' "topics/$SLUG/<dir>/<key>.html" '/<h2/' '{*}'
```

`.parts/` sits outside the translations tree, so it is never published. Then:

1. One subagent per chunk, **counting against the same wave of 4**, so a many-chunk
   file takes several waves — same four-line prompt plus:
   *this is a fragment — return it with exactly the tags it arrived with, in the
   same order and numbering; chunk 00 carries the `<title>`.* Each writes
   `NN.out.html` beside its source chunk.
2. `cat topics/$SLUG/.parts/<key>/*.out.html > topics/$SLUG/translations/$TRANSLATE_LANG/<dir>/<key>.html`
   — the zero-padded names sort into the right order.
3. Run SKILL.md's count check on the assembled file, re-run any bad chunk alone,
   publish.
4. `rm -rf topics/$SLUG/.parts` at the end of the run.
