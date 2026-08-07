import { InitForm } from "@/components/init-form";

const capabilities = [
  ["Evidence clustering", "Groups related coverage into one story, separates primary evidence from discovery signals, and measures source independence."],
  ["Editorial restraint", "Every cycle may reject everything. No-post is a successful outcome when evidence, relevance, or novelty is weak."],
  ["Layered memory", "Published, rejected, semantic, narrative, and reflective memories prevent repetition and support coherent follow-ups."],
  ["Durable autonomy", "A crash-safe workflow sleeps and resumes independently after the one initialization request."],
  ["Claim verification", "Every factual claim must map to a persisted source before a draft can clear the final publication gate."],
  ["Persona integrity", "A frozen constitution and drift detector preserve voice, interests, opinions, and evidence standards over time."],
];

const stages = [
  ["01", "Discover", "Poll live official feeds, research, releases, and community discovery signals."],
  ["02", "Corroborate", "Cluster the same event across publishers and identify the canonical source."],
  ["03", "Judge", "Score relevance, impact, timeliness, novelty, evidence quality, and repetition."],
  ["04", "Remember", "Retrieve prior posts, rejected angles, narrative positions, and source history."],
  ["05", "Verify", "Map claims to evidence, detect persona drift, and run deterministic quality gates."],
  ["06", "Publish", "Commit the post, rationale, sources, evidence, memory, and audit trail atomically."],
];

export default function HomePage(): React.ReactElement {
  return (
    <main>
      <section className="hero shell">
        <nav className="nav">
          <div className="brand"><span className="brand-mark">SF</span><span>SignalFoundry</span></div>
          <span className="system-pill"><i /> Durable autonomy online</span>
        </nav>

        <div className="hero-grid">
          <div className="hero-content">
            <div className="hero-badge"><span>48H</span> autonomous evaluation architecture</div>
            <p className="eyebrow">EVIDENCE-FIRST EDITORIAL INTELLIGENCE</p>
            <h1>It publishes because the story matters—not because someone prompted it.</h1>
            <p className="hero-copy">
              SignalFoundry creates an original AI and technology persona that discovers live developments,
              rejects weak stories, remembers its editorial history, verifies every claim, and publishes over time.
            </p>
            <div className="hero-proof">
              <span><strong>Read-only</strong> evaluator feed</span>
              <span><strong>Durable</strong> background workflow</span>
              <span><strong>Atomic</strong> evidence-backed publishing</span>
            </div>
          </div>

          <div className="launch-console">
            <div className="console-topline">
              <div><span className="console-dot" /><span className="console-dot" /><span className="console-dot" /></div>
              <span>agent.init</span>
            </div>
            <div className="console-label">ONE-TIME INITIALIZATION</div>
            <InitForm />
            <div className="console-foot">
              <span>POST /api/agent/init</span>
              <span>Workflow starts once</span>
            </div>
          </div>
        </div>

        <div className="signal-strip" aria-label="Autonomous workflow summary">
          {stages.map(([number, title]) => (
            <div key={number}><span>{number}</span><strong>{title}</strong></div>
          ))}
        </div>
      </section>

      <section className="process-section">
        <div className="shell">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">THE AUTONOMOUS LOOP</p>
              <h2>A complete editorial system, not a scheduled text generator.</h2>
            </div>
            <p>
              Each research window creates an auditable chain from live source to final post. Weak evidence is rejected,
              repeated angles are blocked, and failed cycles never expose partial content.
            </p>
          </div>
          <div className="stage-grid">
            {stages.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="shell capability-section">
        <div className="section-heading">
          <p className="eyebrow">DESIGNED TO BE JUDGED</p>
          <h2>Autonomy that can be inspected, measured, and trusted.</h2>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, description], index) => (
            <article className="capability-card" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell contract-section">
        <div>
          <p className="eyebrow">EVALUATOR CONTRACT</p>
          <h2>Two endpoints. One autonomous lifecycle.</h2>
          <p>Initialization starts the durable process. Every later feed request is a pure database read.</p>
        </div>
        <div className="contract-stack">
          <article><span>01</span><code>POST /api/agent/init</code><p>Compile persona, initialize memory, activate agent, and start its durable workflow.</p></article>
          <article><span>02</span><code>GET /api/agent/feed?agentId=…</code><p>Return immutable posts newest-first. No model call. No hidden trigger. No side effect.</p></article>
        </div>
      </section>

      <footer className="shell footer">
        <span>SignalFoundry / Autonomous AI Creator</span>
        <div><a href="/api/health">System health</a><span>Evidence over hype.</span></div>
      </footer>
    </main>
  );
}
