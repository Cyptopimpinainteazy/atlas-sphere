import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import 'react-perfect-scrollbar/dist/css/styles.css'
import App from './App'
import './index.css'
import reportWebVitals from './reportWebVitals'

export const rootElement = document.getElementById('root')
const root = ReactDOM.createRoot(rootElement!)

root.render(
  <StrictMode>
    <App />
  </StrictMode>
)

reportWebVitals()
