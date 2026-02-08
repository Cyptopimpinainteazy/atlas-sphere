import { Routes, Route, NavLink } from "react-router-dom";
import { FloorDashboard } from "./pages/FloorDashboard";
import { IntentsPage } from "./pages/IntentsPage";
import { AgentsPage } from "./pages/AgentsPage";
import { SlashingPage } from "./pages/SlashingPage";
import { ProofExplorer } from "./pages/ProofExplorer";
import { FloorRules } from "./pages/FloorRules";
import { BondsPage } from "./pages/BondsPage";

export function App() {
  return (
    <>
      <nav className="nav">
        <span className="nav-brand">X3</span>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Floor
        </NavLink>
        <NavLink to="/intents" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Intents
        </NavLink>
        <NavLink to="/agents" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Agents
        </NavLink>
        <NavLink to="/slashing" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Slashing
        </NavLink>
        <NavLink to="/proofs" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Proofs
        </NavLink>
        <NavLink to="/bonds" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Bonds
        </NavLink>
        <NavLink to="/rules" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Rules
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<FloorDashboard />} />
        <Route path="/intents" element={<IntentsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/slashing" element={<SlashingPage />} />
        <Route path="/proofs" element={<ProofExplorer />} />
        <Route path="/bonds" element={<BondsPage />} />
        <Route path="/rules" element={<FloorRules />} />
      </Routes>
    </>
      </Routes>
    </>
  );
}
