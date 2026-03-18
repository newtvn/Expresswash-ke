# ExpressWash - Professional Cleaning Service Platform

## Project Overview

ExpressWash is a modern web application for managing carpet and furniture cleaning services in Kitengela, Athi River, and Greater Nairobi, Kenya.

## Features

- **Service Management** - Display cleaning services with transparent pricing
- **Order Tracking** - 12-stage order pipeline tracking system
- **Instant Quote Calculator** - Real-time price estimation
- **Responsive Design** - Mobile-first approach with modern UI
- **Customer Testimonials** - Social proof and the ratings display

## Technology Stack

This project is built with:

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React 18** - Modern UI library
- **shadcn-ui** - Beautiful UI components
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **TanStack Query** - Server state management

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd applecrafted-app

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:8080/`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Project Structure

```
src/
├── pages/           # Page components
├── components/      # Reusable components
│   ├── layout/     # Header, Footer
│   ├── landing/    # Homepage sections
│   └── ui/         # shadcn-ui components
├── hooks/          # Custom React hooks
└── lib/            # Utility functions
```

## Order Tracking

Demo tracking code: `EW-2024-00123`

The order tracking system includes 12 stages from quote to delivery with real-time status updates and visual progress indicators.

## License

All rights reserved - ExpressWash © 2024
