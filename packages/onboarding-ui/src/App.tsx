import { Link } from "react-router-dom";

export default function App() {
  return (
    <div style={{ maxWidth: 720, margin: "4rem auto", padding: "0 2rem", textAlign: "center" }}>
      <h1>WaveX OS</h1>
      <p>This page only shows after onboarding. <Link to="/onboarding/welcome">Start onboarding →</Link></p>
    </div>
  );
}
