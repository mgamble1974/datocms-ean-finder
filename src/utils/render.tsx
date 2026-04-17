import React from 'react';
import { createRoot } from 'react-dom/client';

export function render(component: React.ReactNode): void {
  const root = createRoot(document.getElementById('root')!);
  root.render(<React.StrictMode>{component}</React.StrictMode>);
}
