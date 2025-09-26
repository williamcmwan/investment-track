# Investment Tracker

A comprehensive investment portfolio tracking application built with React, TypeScript, and Tailwind CSS. Track your investment accounts, currency exchanges, and portfolio performance with real-time data visualization.

![Investment Tracker Dashboard](https://via.placeholder.com/800x400/0ea5e9/ffffff?text=Investment+Tracker+Dashboard)

## 🚀 Features

- **Multi-Account Portfolio Tracking**: Monitor multiple investment accounts with detailed breakdowns
- **Currency Exchange Management**: Track currency pairs and exchange rate fluctuations
- **Real-time P&L Visualization**: Interactive charts showing profit/loss over time
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Collapsible Sidebar**: Clean navigation with mobile-friendly hamburger menu
- **Multi-Currency Support**: Set your base currency and track foreign exchange positions
- **Dark/Light Mode**: Adaptive UI theme support

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design tokens
- **UI Components**: shadcn/ui component library
- **Charts**: Recharts for data visualization
- **Routing**: React Router DOM
- **State Management**: React hooks and context
- **Icons**: Lucide React
- **Development**: ESLint for code quality

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                    # Reusable UI components (shadcn/ui)
│   │   ├── button.tsx         # Button component with variants
│   │   ├── card.tsx          # Card container component
│   │   ├── dialog.tsx        # Modal dialog component
│   │   ├── input.tsx         # Form input component
│   │   ├── select.tsx        # Dropdown select component
│   │   ├── sidebar.tsx       # Sidebar navigation component
│   │   └── ...               # Other UI primitives
│   ├── AccountsView.tsx      # Investment accounts management
│   ├── CurrencyView.tsx      # Currency exchange tracking
│   ├── Dashboard.tsx         # Main dashboard with charts and overview
│   ├── Login.tsx            # Authentication/login interface
│   └── Sidebar.tsx          # Main navigation sidebar
├── pages/
│   ├── Index.tsx            # Main application page
│   └── NotFound.tsx         # 404 error page
├── hooks/
│   ├── use-mobile.tsx       # Mobile device detection hook
│   └── use-toast.ts         # Toast notification hook
├── lib/
│   └── utils.ts             # Utility functions and helpers
├── App.tsx                  # Root application component
├── main.tsx                 # Application entry point
├── index.css               # Global styles and design tokens
└── vite-env.d.ts          # Vite environment type definitions
```

## 🎨 Design System

The application uses a comprehensive design system with semantic color tokens:

- **Primary Colors**: Brand blue with gradient variants
- **Semantic Colors**: Success (green), warning (yellow), destructive (red)
- **Surface Colors**: Background, card, and border variants
- **Typography**: Consistent font scaling and weights
- **Spacing**: Standardized spacing scale
- **Shadows**: Elegant shadow system with primary color integration

## 📱 Component Overview

### Core Components

#### `Dashboard.tsx`
Main dashboard component featuring:
- Portfolio overview cards showing total value, cash, and P&L
- Interactive line chart for profit/loss visualization
- Navigation between different views (accounts, currency)
- Responsive layout with mobile optimizations

#### `AccountsView.tsx`
Investment account management with:
- Account listing with expandable details
- Individual stock holdings display
- Profit/loss calculations per account
- Add/edit account functionality

#### `CurrencyView.tsx`
Currency exchange tracking featuring:
- Currency pair monitoring (USD/HKD, EUR/HKD, etc.)
- Real-time exchange rate display
- Profit/loss from currency fluctuations
- Base currency configuration (collapsible)

#### `Sidebar.tsx`
Navigation sidebar with:
- Collapsible design for desktop
- Mobile-friendly overlay mode
- User profile section
- Active route highlighting
- Logout functionality

#### `Login.tsx`
Authentication interface with:
- Clean, professional design
- Feature highlights
- Responsive layout
- Brand consistency

### UI Components (`src/components/ui/`)

Built on shadcn/ui, these components provide:
- Consistent styling and behavior
- Accessibility compliance
- Theme integration
- TypeScript support

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/investment-track.git
   cd investment-track
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## 🎯 Usage

1. **Login**: Start with the login screen to access the dashboard
2. **Dashboard**: View your portfolio overview and P&L chart
3. **Accounts**: Manage your investment accounts and holdings
4. **Currency**: Track currency exchange positions and rates
5. **Navigation**: Use the collapsible sidebar to switch between views

### Mobile Experience

- Tap the hamburger menu to open the sidebar
- Sidebar automatically closes when selecting items
- Charts are optimized for touch interaction
- Responsive layouts adapt to screen size

## 🔧 Configuration

### Environment Variables

No environment variables are required for basic functionality. The app uses mock data for demonstration purposes.

### Customization

- **Colors**: Modify `src/index.css` for color scheme changes
- **Components**: Extend or modify components in `src/components/`
- **Layout**: Adjust responsive breakpoints in Tailwind config

## 📊 Data Structure

The application uses TypeScript interfaces for type safety:

```typescript
interface Account {
  name: string;
  value: number;
  cash: number;
  profitLoss: number;
  stocks: Stock[];
}

interface Currency {
  pair: string;
  rate: number;
  avgCost: number;
  profitLoss: number;
  amount: number;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙋‍♂️ Support

For support, questions, or feature requests:
- Open an issue on GitHub
- Contact the development team

## 🔗 Links

- **Live Demo**: [Investment Tracker App](https://your-deployment-url.com)
- **Documentation**: This README
- **Repository**: [GitHub Repository](https://github.com/yourusername/investment-track)

---

Built with ❤️ using [Lovable](https://lovable.dev) - The fastest way to build web applications with AI assistance.