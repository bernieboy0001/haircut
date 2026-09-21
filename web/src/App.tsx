import { HashRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import SleevePage from './pages/SleevePage'
import RulesPage from './pages/RulesPage'
import ClockPage from './pages/ClockPage'
import EnginePage from './pages/EnginePage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sleeve" element={<SleevePage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/clock" element={<ClockPage />} />
        <Route path="/engine" element={<EnginePage />} />
      </Routes>
    </HashRouter>
  )
}

export default App