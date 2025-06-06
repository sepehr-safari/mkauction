import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'

// Using system fonts for now

createRoot(document.getElementById("root")!).render(<App />);
