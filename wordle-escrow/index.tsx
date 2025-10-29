import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 👇 Add these imports
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 👇 Create a single client for your app
const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* 👇 Wrap your whole app in the QueryClientProvider */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
