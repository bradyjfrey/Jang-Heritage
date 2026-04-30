# Jang Heritage

A private archive app for translating my wife's grandfather's Chinese and Chinese-American letters, diaries, and documents into English.

## Why

I began studying Chinese writing and speaking Mandarin in 2011. Recently married, we discussed having a child, but I was worried I would not be able to be a supportive guide to my daughter as she grows up as a mixed-race child. At first, I studied ancient and contemporary Chinese history, but soon realized that my wife's family history was not just a Chinese story but a Chinese-American story: distinctly "betwixt and between" what it means to be too Chinese to be American, and too American to be Chinese in feeling. Bicultural identity integration was challenging for a white, military brat.

After much reading, two certifications, and a graduate degree that touched on some of this theory, my father-in-law came to me with a suitcase of his father's historical letters, documents, and diaries. He'd saved them, but since most of his family could no longer read Chinese, they had sat preserved for almost 100 years. He wondered if the documents could tell more about his immigration to the US as a child and clarify some of his family history.

I set to work scanning each piece with CZUR scanners, storing them in archival-grade containers, and then slowly translating them. With some of the letters handwritten, and some of the characters more casual than I was used to, I was slowed down by the software options. Apps like Catalogit.app offer elegant solutions for keeping museum pieces organized, but their rigid categories and complex interfaces interfere with the translation process. Additionally, I feel these pieces are not mine, but my wife's family's, and they should be on a system that we own, protect, maintain, and back up. Other apps with SaaS or no-code interfaces were limited in their ability to be structured around just getting the translation done. So I've built this to do exactly as I need.

Rebuild it as you need. I hope it helps you and the ones you love.

## Who this might be useful for

In rough order:
1. Me, day to day. The app is built for the way I work, not for a generic audience.
2. Translators collaborating with me for review and transcription.
3. My family, who can read or browse what I've translated.
4. Anyone with similar materials. Old letters in a heritage language, diaries that need both transcription and translation, mixed-language family papers. If your situation looks like mine, the workflow may help. The code is public, so you can read it, fork it, or adapt it.

## What this isn't

- **Not enterprise translation software.** No translation memory, no team workflows, no review pipelines. One archive, a small handful of trusted users.
- **Not OCR.** Chinese OCR (especially for handwritten, brush-stroke, or vertically set old text) is not currently good enough to justify the cost in terms of quality. Everything is transcribed and translated by humans (although AI systems like DeepSeek do a great job with typed Chinese, including colloquial and regional usage).
- **Not a genealogy platform.** It does not replace Ancestry, MyHeritage, or FamilySearch. It complements them: those tell you who your ancestors were; this lets you read what they wrote.

## Stack

- Next.js 16 (App Router) for the frontend and API
- Payload 3.84 as the headless CMS layer (auth, collections, admin UI)
- Postgres for storage, Drizzle ORM under the hood
- Cloudflare R2 for scan and attachment storage
- Tailwind v3 for styling, with a small palette of CSS Modules where component-scoped styles make more sense
- Google SSO for authentication, with an explicit allowlist
- Deployed on a DigitalOcean droplet via Dokploy

## Running locally

This is a personal project; the setup assumes you're me. If you want to run it yourself, you'll need:

- Node 22+
- pnpm 10
- A Postgres database (the repo includes a `devenv` setup that provisions one)
- Cloudflare R2 (or any S3-compatible) bucket and credentials
- A Google OAuth client for sign-in

Then:

```bash
pnpm install
pnpm dev
```

Environment variables go in `.env`. See `payload.config.ts` for which ones are read.

## License and contribution

Released under the [MIT License](LICENSE). The license applies to this repository's code only. The family materials this app archives (scans, transcriptions, translations) live outside this repository, in a private database and object store, and are not licensed for redistribution.

Public so others can read, learn, or adapt. **Pull requests are unlikely to be accepted** because the design and product decisions are deliberately personal. Forks and issues that surface real bugs are welcome.