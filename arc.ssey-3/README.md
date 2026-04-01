# arc.ssey

A meditative archival simulation game. Pilot a retrofuturistic skiff across a bioluminescent alien ocean, recovering fragments of the pre-AI internet from the Internet Archive, Wayback Machine, and Wikipedia.

**No AI tokens consumed. No API keys required. All content comes from free public APIs.**

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`

## Stack

- React 19 + TypeScript + Vite
- Three.js (3D ocean, skiff, islands, skybox)
- Tailwind CSS (UI)
- Internet Archive API (audio, video, web archives)
- Wikipedia API (search expansion, animal data, gull facts)
- Wayback Machine (archived websites)
- localStorage (journal persistence)
