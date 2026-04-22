import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureBigIntJsonSerialization } from './app/bootstrap-bigint-json'
import { applyUiPreferencesToRoot, readUiPreferences } from './app/ui-preferences'
import { registerAppServiceWorker } from './app/pwa'

const unregisterAppServiceWorkers = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

ensureBigIntJsonSerialization()
applyUiPreferencesToRoot(readUiPreferences())

if (import.meta.env.PROD) {
  void registerAppServiceWorker()
} else {
  void unregisterAppServiceWorkers()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
