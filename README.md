# NexusSports Live (React)

This is a simple, mobile-first sports streaming site built with **React (CDN)** + a lightweight Node server.

It includes:
- **Home page** with popular sports + trending streams
- **Sport sections** (Cricket, Football, etc.)
- **Watch page** (Cricket currently uses `/stream` from `server.js`)
- **Ad slots** placed for mobile + desktop layouts

## Features
- **Simple UI**: Black / White / Orange theme, clean and non-gimmicky.
- **Mobile-first**: Sticky player behavior on phones + scrollable nav.
- **Error handling**: Client retry + server timeouts + basic rate limiting.
- **Ad ready**: Multiple ad slots (mobile inline + sidebar + hero banner).

## Setup Instructions

1. **Run the server**

```bash
node server.js
```

Then open `http://localhost:3000`.

2. **Add your sports + streams (LEGAL only)**

Edit `script.js` and update the `SPORTS` array.

- Cricket stream is already wired to:
  - `streamSrc: '/stream'`
- For other sports/events, set `streamSrc` to your **official** embed/stream URL.

## Troubleshooting The Stream
If `/stream` fails, the upstream source may be down or blocking requests. The UI will show an error and auto-retry.

## Customization
- **Theme**: edit CSS variables in `style.css` (`--bg-main`, `--accent`, etc.).
- **Ads**: replace placeholders in `script.js` (`MobileAdStrip`, ad slots) with your ad network tags.
