# Website Mover - Frontend

React 19 + TypeScript + Vite frontend for the Website Mover application.

## 🚀 Development

```bash
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

## 🏗️ Build

```bash
npm run build
```

Build output will be in `dist/` directory.

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **shadcn/ui** - UI components
- **Lucide React** - Icons

## 📁 Structure

```
src/
├── components/
│   ├── onboarding/      # Welcome tour, help, guides
│   ├── simple/          # Main screens (Remotes, Migration, History)
│   └── ui/              # Base UI components (shadcn/ui)
├── api/                 # API client functions
├── hooks/               # Custom React hooks
└── App.tsx              # Main app component
```

## 🔌 API Configuration

Set the backend API URL via environment variable:

```bash
# .env
VITE_API_BASE=http://localhost:8080/api
```

Default is `http://localhost:8080/api` if not specified.
