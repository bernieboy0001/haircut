import { HashRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  )
}

export default App