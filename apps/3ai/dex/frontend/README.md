# 3aiXchange DEX Frontend

A decentralized exchange (DEX) frontend built with React, TypeScript, Chakra UI, and Vite.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/3ai-dex.git
   cd 3ai-dex/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Update the `.env` file with your configuration

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## 📁 Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── config/          # Application configuration
├── hooks/           # Custom React hooks
├── layouts/         # Layout components
├── pages/           # Page components
├── services/        # API and blockchain services
├── store/           # State management
├── styles/          # Global styles
├── theme/           # Chakra UI theme
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── App.tsx          # Root component
└── main.tsx         # Entry point
```

## 🛠 Development

### Tech Stack

- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [Chakra UI](https://chakra-ui.com/) - Component library
- [Vite](https://vitejs.dev/) - Build tool
- [React Query](https://tanstack.com/query) - Data fetching
- [Ethers.js](https://docs.ethers.org/v5/) - Ethereum interaction
- [Wagmi](https://wagmi.sh/) - React Hooks for Ethereum

### Environment Variables

See `.env.example` for required environment variables.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Chakra UI](https://chakra-ui.com/)
- [Vite](https://vitejs.dev/)
- [React Query](https://tanstack.com/query)
- [Ethers.js](https://docs.ethers.org/v5/)
- [Wagmi](https://wagmi.sh/)
