# Nerts League

A league management application for tracking Nertz game results, player statistics, and leaderboards.

Built with React, Convex, TanStack Router, Clerk, Vite, and Tailwind CSS.

## Features

- **Player Profiles**: Track individual player statistics including games played, wins, total points, and average points
- **Game Recording**: Record Nertz game results with multiple players and optional custom rules
- **Leaderboard**: Real-time leaderboard ranking players by total points
- **Game History**: View recent games with timestamps, winners, and detailed scores
- **Authentication**: Secure sign-in via Clerk (email, Google, GitHub)

## Quick Start

```bash
pnpm install
pnpm dev
```

## Project Structure

```
├── convex/
│   ├── _generated/
│   ├── auth.config.ts
│   ├── schema.ts
│   ├── users.ts
│   ├── players.ts      # Player statistics queries
│   ├── games.ts        # Game recording and history
│   └── settings.ts     # League and session rules
├── src/
│   ├── routes/
│   │   ├── __root.tsx  # Layout with auth
│   │   └── index.tsx   # Main app (tabs for leaderboard, games, recording)
│   ├── index.css
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## License

MIT