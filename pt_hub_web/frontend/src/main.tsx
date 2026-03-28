import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeroUIProvider } from '@heroui/system'
import { setPortfolioQueryClient } from './store/portfolioStore'
import { setPropertyQueryClient } from './store/propertyStore'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min — data stays fresh
      gcTime: 10 * 60 * 1000,        // 10 min — cache retained
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

setPortfolioQueryClient(queryClient)
setPropertyQueryClient(queryClient)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HeroUIProvider>
  </React.StrictMode>,
)
