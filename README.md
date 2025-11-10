# Website Mover

Assistant de migration d'hébergement qui détecte et propose les meilleures commandes à exécuter côté utilisateur pour migrer des sites web (WordPress, PrestaShop, Drupal, etc.) entre hébergeurs.

## 🎯 Vision Produit

Migrer un site d'un hébergeur vers un autre en utilisant **uniquement** FTP/SFTP/FTPS/HTTP(S)/SCP/SSH depuis la machine de l'utilisateur, sans installer aucun package sur les serveurs source/destination.

### Contraintes

- ✅ Aucun package installé sur les hôtes mutualisés
- ✅ Détection automatique des capacités des serveurs
- ✅ Génération de commandes adaptées
- ✅ Support de la reprise en cas d'échec
- ✅ Vérifications d'intégrité

## 🏗️ Architecture

### Stack Technique

**Frontend (Web App)**
- React 19 + TypeScript
- Vite 7 (build tool & dev server)
- shadcn/ui + TailwindCSS v4 (UI)
- Zustand (state management)
- TanStack Query (data fetching)

**Backend (Go Server)**
- Go 1.25
- HTTP REST API (127.0.0.1:8080)
- CORS enabled for local development
- Packages :
  - `pkg/sftp` (SFTP client)
  - `jlaffaye/ftp` (FTP/FTPS)
  - `golang.org/x/crypto/ssh` (SSH)
  - `povsister/scp` (SCP)

**Sécurité**
- Credentials in memory only (session-based)
- Communication localhost uniquement
- Backend API not exposed to internet

### Structure du Projet

```
website-mover/
├── frontend/              # React Web App
│   ├── src/
│   │   ├── components/   # Composants UI
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   ├── screens/  # 7 écrans principaux
│   │   │   ├── connection/
│   │   │   ├── detection/
│   │   │   ├── command-builder/
│   │   │   ├── progress/
│   │   │   ├── verification/
│   │   │   └── database/
│   │   ├── stores/       # Zustand stores
│   │   ├── hooks/        # TanStack Query hooks
│   │   ├── lib/          # Utils + API client
│   │   └── types/        # TypeScript definitions
│   ├── dist/             # Production build output
│   └── package.json
│
├── backend/              # Backend Go
│   ├── cmd/server/       # HTTP server entry point
│   ├── internal/
│   │   ├── probe/        # Server capabilities detection
│   │   ├── transfer/     # Transfer engine (SFTP/FTP/SCP)
│   │   ├── integrity/    # Checksum verification
│   │   ├── database/     # MySQL dump/restore
│   │   ├── parser/       # PHP parser (wp-config.php)
│   │   ├── planner/      # Strategy scoring
│   │   └── progress/     # Progress tracking
│   ├── bin/              # Compiled binaries
│   └── go.mod
│
└── Makefile              # Build commands
```

## 🚀 Quick Start

### Prérequis

- Node.js 18+
- Go 1.25+
- macOS ou Linux

### Installation

```bash
# Cloner le repo
git clone https://github.com/gonzague/website-mover.git
cd website-mover

# Installer les dépendances
make install
```

### Développement

**Option 1 : Lancer tout en une commande**
```bash
make dev    # Lance backend + frontend ensemble
```

**Option 2 : Lancer séparément (2 terminaux)**
```bash
# Terminal 1 - Backend
make run-backend    # http://127.0.0.1:8080

# Terminal 2 - Frontend
make dev-frontend   # http://localhost:5173
```

**Arrêter le backend**
```bash
make stop-backend
```

### Build de Production

```bash
# Compiler tout
make build

# Ou individuellement :
make build-backend   # Compile le serveur Go -> backend/bin/server
make build-frontend  # Compile le frontend React -> frontend/dist
```

## 📋 Phases de Développement

### ✅ Phase 1 : Setup & Infrastructure (COMPLÉTÉ)

- [x] 1.1 : Projet React + TypeScript + Vite
- [x] 1.2 : TailwindCSS + shadcn/ui + Zustand + TanStack Query
- [x] 1.3 : Backend Go (structure + HTTP server)
- [x] 1.4 : Communication Frontend ↔ Backend via HTTP

### ✅ Phase 2 : Écran 1 - Connexions & Probe (COMPLÉTÉ)

- [x] 2.1 : UI Écran Connexions (cartes Source/Destination)
- [x] 2.2 : Probe SFTP (capacités, latence, throughput)
- [x] 2.3 : Probe FTP/FTPS
- [ ] 2.4 : Listing récursif avec progress

### 📅 Phase 3 : Écran 2 - Détection & Plan (À venir)

- [ ] 3.1 : Planner (scoring des méthodes)
- [ ] 3.2 : Détection CMS
- [ ] 3.3 : Exclusions automatiques
- [ ] 3.4 : UI Plan de transfert

### 📅 Phases 4-10 : Suite du développement

Voir le plan détaillé dans le document de conception.

## 🔧 Commandes Utiles

```bash
make help            # Afficher l'aide
make dev             # Lancer backend + frontend
make build           # Compiler pour production
make build-backend   # Compiler le backend Go
make build-frontend  # Compiler le frontend React
make run-backend     # Lancer le backend seul
make dev-frontend    # Lancer Vite dev server seul
make stop-backend    # Arrêter le backend
make clean           # Nettoyer les artifacts
```

## 🧪 Tests

```bash
# Tester le backend
cd backend
go test ./...

# Tester que le serveur répond
curl http://127.0.0.1:8080/health
```

## 📡 API Endpoints (Backend)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/api/probe` | POST | Tester connexion serveur |
| `/api/plan` | POST | Générer plan de transfert |
| `/api/transfer/start` | POST | Démarrer transfert |
| `/ws/progress` | WebSocket | Progress en temps réel |

## 🎨 Design System

Utilise shadcn/ui avec TailwindCSS v4 :
- Composants : Button, Card, Input, Select, Progress, Toast
- Thème : Support dark mode automatique
- Icons : lucide-react

## 🔒 Sécurité

- Credentials stockés en mémoire uniquement (session)
- API backend exposée uniquement sur localhost
- CORS configuré pour développement local

## 🤝 Contribution

Projet en développement actif. Les contributions sont bienvenues !

## 📄 Licence

À définir

## 🙏 Remerciements

Stack technique moderne :
- [React](https://react.dev/) - Library UI
- [Vite](https://vite.dev/) - Build tool ultra-rapide
- [shadcn/ui](https://ui.shadcn.com/) - Composants UI
- [TailwindCSS](https://tailwindcss.com/) - CSS utility-first
- [Go](https://go.dev/) - Backend performant

---

**Note**: Ce projet est en développement. Les Phases 1-2 sont complétées. Phase 3 (Détection & Plan) à venir.
