import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureBigIntJsonSerialization } from './app/bootstrap-bigint-json'
import { applyUiPreferencesToRoot, readUiPreferences } from './app/ui-preferences'
import { registerAppServiceWorker } from './app/pwa'

ensureBigIntJsonSerialization()
applyUiPreferencesToRoot(readUiPreferences())
void registerAppServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
