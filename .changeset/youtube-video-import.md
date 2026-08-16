---
"@gram-lang/cli": minor
---

`gram import` now accepts a YouTube URL.

```bash
gram import "https://www.youtube.com/watch?v=…"
gram import "https://www.youtube.com/shorts/…"
```

Gemini watches the video and writes the recipe. There is no subtitle step: no official API gives you the captions of a video you don't own, so the video itself is the source. Title, channel and URL come from YouTube and go straight into `title:`, `author:` and `source:`.

A few things follow from that, and the command is upfront about all of them:

- **It needs the Google provider.** Gemini is the only one that reads YouTube. With another provider the import stops rather than sending it something that isn't a video.
- **Long videos are expensive** — roughly 100 tokens per second, so a Short costs a few thousand and half an hour costs well over a hundred thousand. Anything past 20 minutes is refused unless you raise `--max-duration`.
- **Set `YOUTUBE_API_KEY` to see the price first.** With it, you get the video's length and an estimate before anything is spent. Without it the import still works, but says it can't tell you.
- **A video says far less than a written recipe.** Quantities are often shown and never spoken, or never shown at all. The model is told to leave those blank rather than guess, and the import then refuses anything where ingredients went missing. Expect to fill in some blanks yourself.

Shorts URLs are rewritten to the standard `watch?v=` form, which is what the video actually gets sent as.
