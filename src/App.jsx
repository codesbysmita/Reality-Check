
import { useEffect, useMemo, useState } from 'react';
import { realityCheckApi } from './api.js';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  FileText,
  Flag,
  History,
  Leaf,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', icon: Compass },
  { label: 'Reality Check', icon: Target },
  { label: 'Commitments', icon: CheckCircle2 },
  { label: 'History', icon: History },
];

const emptyDashboard = {
  mode: 'live',
  userLabel: 'Local profile',
  periodLabel: 'All recorded commitments',
  summary: {
    commitments: 0,
    completed: 0,
    postponed: 0,
    completionRate: 0,
  },
  focusPattern: null,
  commitments: [],
  realityCheck: null,
};

function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState('Reality Check');
  const [decision, setDecision] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCommitment, setNewCommitment] = useState('');
  const [plannedMinutes, setPlannedMinutes] = useState('30');
  const [check, setCheck] = useState(null);
  const [checked, setChecked] = useState(false);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCommitment, setSavingCommitment] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [nextStepAdded, setNextStepAdded] = useState(false);

  async function loadDashboard() {
    try {
      const data = await realityCheckApi.getDashboard();
      setDashboard(data);
      setApiError('');
    } catch (error) {
      setApiError(
        error.message || 'Could not connect to the backend.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const completionRate = useMemo(() => {
    const total = dashboard.summary.commitments;
    return total
      ? Math.round((dashboard.summary.completed / total) * 100)
      : 0;
  }, [dashboard]);

  const focusPattern = dashboard.focusPattern;
  const plannedAverage = focusPattern?.plannedAverageMinutes;
  const actualAverage = focusPattern?.actualAverageMinutes;
  const sampleSize = focusPattern?.sampleSize ?? 0;

  const actualBarWidth =
    Number.isFinite(plannedAverage) &&
    plannedAverage > 0 &&
    Number.isFinite(actualAverage)
      ? `${Math.min(100, Math.max(0, (actualAverage / plannedAverage) * 100))}%`
      : '0%';

  const isReality = activeNav === 'Reality Check';

  async function runRealityCheck(event) {
    event.preventDefault();

    if (!decision.trim()) return;

    setRunningCheck(true);
    setApiError('');
    setNextStepAdded(false);

    try {
      const result = await realityCheckApi.createRealityCheck(
        decision.trim()
      );

      setCheck(result.realityCheck);
      setChecked(true);
    } catch (error) {
      setApiError(
        error.message || 'Could not generate a reality check.'
      );
    } finally {
      setRunningCheck(false);
    }
  }

  async function addCommitment(event) {
    event.preventDefault();

    if (!newCommitment.trim()) return;

    const duration = Number(plannedMinutes);

    if (!Number.isFinite(duration) || duration <= 0) {
      setApiError('Enter a planned duration greater than zero.');
      return;
    }

    setSavingCommitment(true);
    setApiError('');

    try {
      await realityCheckApi.createCommitment({
        title: newCommitment.trim(),
        category: 'Personal',
        plannedMinutes: duration,
      });

      await loadDashboard();

      setNewCommitment('');
      setPlannedMinutes('30');
      setShowAddForm(false);
    } catch (error) {
      setApiError(
        error.message || 'Could not save the commitment.'
      );
    } finally {
      setSavingCommitment(false);
    }
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Leaf size={19} strokeWidth={2.3} />
          </div>
          <div>
            <div className="brand-name">
              reality check<span>.</span>
            </div>
            <div className="brand-caption">
              PERSONAL ACCOUNTABILITY
            </div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${
                activeNav === label ? 'active' : ''
              }`}
              onClick={() => setActiveNav(label)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Reality Check' && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Your data, your call.</strong>
              <span>
                Patterns are based on logged commitments, not
                assumptions.
              </span>
            </div>
          </div>

          <button className="profile-button">
            <div className="avatar">L</div>
            <div className="profile-copy">
              <strong>Local profile</strong>
              <span>Personal workspace</span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Leaf size={17} />
            </div>
            <span>
              reality check<span className="green-dot">.</span>
            </span>
          </div>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{activeNav}</strong>
          </div>

          <div className="topbar-right">
            <span className="status-dot" />
            <span>Personal space</span>
            <button className="icon-button" aria-label="Help">
              <CircleHelp size={18} />
            </button>
          </div>
        </header>

        <div className="page-wrap">
          {apiError && (
            <div role="alert" className="demo-banner">
              <strong>Notice:</strong> {apiError}
              <button onClick={loadDashboard}>Retry</button>
            </div>
          )}

          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                {todayLabel} <span className="eyebrow-line" />
              </div>

              <h1>
                {isReality ? (
                  <>
                    A little clarity.
                    <br />
                    <span>A more honest plan.</span>
                  </>
                ) : activeNav === 'Overview' ? (
                  <>
                    See the pattern.
                    <br />
                    <span>Choose what comes next.</span>
                  </>
                ) : activeNav === 'Commitments' ? (
                  <>
                    Your word,
                    <br />
                    <span>made visible.</span>
                  </>
                ) : (
                  <>
                    Progress is a pattern,
                    <br />
                    <span>not a perfect streak.</span>
                  </>
                )}
              </h1>

              <p className="intro-copy">
                No judgement. Just the gap between what you plan
                and what happens — and what you can do about it.
              </p>
            </div>

            <div className="date-chip">
              <Clock3 size={15} />
              <span>All recorded activity</span>
              <ChevronDown size={14} />
            </div>
          </section>

          <section className="stats-grid" aria-label="Commitment summary">
            <div className="stat-card">
              <div className="stat-top">
                <span>Commitments logged</span>
                <span className="stat-icon">
                  <FileText size={17} />
                </span>
              </div>
              <div className="stat-number">
                {loading ? '—' : dashboard.summary.commitments}
                <span className="stat-suffix"> total</span>
              </div>
              <div className="stat-foot">
                <span className="tiny-dot dot-green" />
                Saved commitments
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Follow-through</span>
                <span className="stat-icon">
                  <TrendingUp size={17} />
                </span>
              </div>
              <div className="stat-number">
                {loading ? '—' : completionRate}
                <span className="stat-suffix">%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${completionRate}%` }} />
              </div>
              <div className="stat-foot">
                {loading
                  ? 'Loading saved records…'
                  : `${dashboard.summary.completed} of ${dashboard.summary.commitments} completed`}
                <span className="mini-arrow">
                  <ArrowUpRight size={13} />
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Postponed</span>
                <span className="stat-icon">
                  <History size={17} />
                </span>
              </div>
              <div className="stat-number">
                {loading ? '—' : dashboard.summary.postponed}
                <span className="stat-suffix"> times</span>
              </div>
              <div className="stat-foot">
                <span className="tiny-dot dot-amber" />
                A signal to understand, not a score
              </div>
            </div>
          </section>

          <section className="reality-section">
            <SectionHeading
              eyebrow="THE MOMENT THAT MATTERS"
              title="Your reality check"
              detail="Bring a decision. We'll put it beside the evidence."
              action={
                <Pill tone="green">
                  <span className="pill-dot" /> Evidence-led
                </Pill>
              }
            />

            <div className="reality-layout">
              <div className="decision-panel">
                <div className="panel-topline">
                  <span className="step-number">01</span>
                  <span className="panel-label">THE DECISION</span>
                  <AudioLines size={17} className="muted-icon" />
                </div>

                <form onSubmit={runRealityCheck}>
                  <label htmlFor="decision-input">
                    What are you thinking of doing?
                  </label>
                  <textarea
                    id="decision-input"
                    value={decision}
                    onChange={(event) => {
                      setDecision(event.target.value);
                      setChecked(false);
                    }}
                    rows={3}
                    maxLength={240}
                    placeholder="e.g. I'll study for four hours tomorrow..."
                  />

                  <div className="input-hint">
                    <span>
                      Be specific. The context makes the check useful.
                    </span>
                    <span>{decision.length}/240</span>
                  </div>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={runningCheck || !decision.trim()}
                  >
                    {runningCheck
                      ? 'Checking your plan…'
                      : 'Run reality check'}
                    <ArrowRight size={16} />
                  </button>
                </form>

                <div className="suggestion-row">
                  <span>TRY:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDecision(
                        'I will study for four hours tomorrow'
                      );
                      setChecked(false);
                    }}
                  >
                    Plan a long study session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDecision('I want to start another project');
                      setChecked(false);
                    }}
                  >
                    Start another project
                  </button>
                </div>

                {checked && (
                  <div className="inline-confirm">
                    <Check size={14} />
                    Reality check generated using the available
                    commitment data.
                  </div>
                )}
              </div>

              <div className="insight-panel">
                <div className="insight-heading">
                  <div>
                    <div className="eyebrow">
                      YOUR PATTERN, IN CONTEXT
                    </div>
                    <h3>
                      {check
                        ? 'Your decision, in context'
                        : focusPattern
                          ? 'Your recorded pace'
                          : 'Your pattern is still taking shape'}
                    </h3>
                  </div>
                  <div className="insight-mark">
                    <Activity size={19} />
                  </div>
                </div>

                <div className="comparison">
                  <div className="comparison-item">
                    <span className="comparison-label">YOU PLANNED</span>
                    <div className="comparison-value">
                      {Number.isFinite(plannedAverage)
                        ? plannedAverage
                        : '—'}
                      <small> min</small>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar-planned"
                        style={{
                          width: focusPattern ? '100%' : '0%',
                        }}
                      />
                    </div>
                    <span className="comparison-sub">
                      Average planned session
                    </span>
                  </div>

                  <div className="comparison-divider">
                    <ArrowDownRight size={17} />
                  </div>

                  <div className="comparison-item">
                    <span className="comparison-label">YOU LOGGED</span>
                    <div className="comparison-value actual">
                      {Number.isFinite(actualAverage)
                        ? actualAverage
                        : '—'}
                      <small> min</small>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar-actual"
                        style={{ width: actualBarWidth }}
                      />
                    </div>
                    <span className="comparison-sub">
                      Average actual session
                    </span>
                  </div>
                </div>

                <div className="evidence-note">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>Evidence, not a verdict.</strong>{' '}
                    {sampleSize > 0
                      ? `Based on ${sampleSize} recorded sessions.`
                      : 'Actual session data has not been recorded yet.'}
                  </span>
                </div>

                <div className="pattern-callout">
                  <div className="pattern-icon">
                    <Target size={17} />
                  </div>
                  <div>
                    <span className="callout-label">
                      {check
                        ? 'REALITY CHECK'
                        : focusPattern
                          ? 'RECORDED PATTERN'
                          : 'WAITING FOR EVIDENCE'}
                    </span>
                    <p>
                      {check?.pattern ||
                        (focusPattern
                          ? 'Your recorded sessions provide a starting point for understanding your planning habits.'
                          : 'Log commitments and record their outcomes to build a reliable picture of your actual pace.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flow-strip" aria-label="Reality Check process">
              <div className="flow-step done">
                <span>01</span>
                <strong>Promise</strong>
              </div>
              <div className="flow-connector" />
              <div className="flow-step done">
                <span>02</span>
                <strong>Observe</strong>
              </div>
              <div className="flow-connector" />
              <div className="flow-step done">
                <span>03</span>
                <strong>Compare</strong>
              </div>
              <div className="flow-connector" />
              <div className="flow-step current">
                <span>04</span>
                <strong>Detect</strong>
              </div>
              <div className="flow-connector" />
              <div className="flow-step">
                <span>05</span>
                <strong>Challenge</strong>
              </div>
              <div className="flow-connector" />
              <div className="flow-step">
                <span>06</span>
                <strong>Plan</strong>
              </div>
            </div>
          </section>

          <section className="recommendation-grid">
            <div className="recommendation-card">
              <div className="recommendation-top">
                <div className="recommendation-icon">
                  <Compass size={18} />
                </div>
                <Pill tone="neutral">
                  {check ? 'Based on this check' : 'Evidence first'}
                </Pill>
              </div>

              <h3>Why it matters</h3>
              <p>
                {check?.interpretation ||
                  'A useful reality check starts with recorded outcomes. Add commitments and log what actually happens to build a more grounded interpretation.'}
              </p>

              <div className="card-footnote">
                <CircleHelp size={14} />
                A pattern is a prompt for reflection, not a label.
              </div>
            </div>

            <div className="recommendation-card next-card">
              <div className="recommendation-top">
                <div className="recommendation-icon filled">
                  <Flag size={18} />
                </div>
                <Pill tone="green">One next step</Pill>
              </div>

              <h3>
                {check
                  ? 'Make the next step realistic.'
                  : 'Start with one commitment.'}
              </h3>
              <p>
                {check?.recommendation ||
                  'Choose one manageable commitment, record the time you plan to spend, and compare it with the actual outcome.'}
              </p>

              <button
                className={`next-action ${
                  nextStepAdded ? 'action-done' : ''
                }`}
                onClick={() => setNextStepAdded(true)}
              >
                {nextStepAdded ? (
                  <>
                    <CheckCircle2 size={16} />
                    Next step noted
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    {check?.nextAction || 'Acknowledge next step'}
                  </>
                )}
                <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <section className="commitments-section">
            <SectionHeading
              eyebrow="THE RECEIPTS"
              title="Recent commitments"
              detail="Intentions only become useful when you can compare them with outcomes."
              action={
                <button
                  className="text-button"
                  onClick={() => setActiveNav('Commitments')}
                >
                  View all <ArrowRight size={15} />
                </button>
              }
            />

            <div className="commitments-card">
              <div className="commitment-table-head">
                <span>COMMITMENT</span>
                <span>PLANNED</span>
                <span>WHEN</span>
                <span>STATUS</span>
              </div>

              {dashboard.commitments.slice(0, 4).map((item) => (
                <div className="commitment-row" key={item.id}>
                  <div className="commitment-title">
                    <span
                      className={`commitment-marker ${
                        item.status === 'Completed'
                          ? 'marker-complete'
                          : item.status === 'Postponed'
                            ? 'marker-postponed'
                            : ''
                      }`}
                    >
                      {item.status === 'Completed' ? (
                        <Check size={13} />
                      ) : item.status === 'Postponed' ? (
                        <History size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}
                    </span>

                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.category}</span>
                    </div>
                  </div>

                  <span className="planned-time">
                    {item.planned ||
                      `${item.plannedMinutes ?? '—'} min`}
                  </span>
                  <span className="when-label">
                    {item.when ||
                      (item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : '—')}
                  </span>

                  <span>
                    <Pill
                      tone={
                        item.status === 'Completed'
                          ? 'green'
                          : item.status === 'Postponed'
                            ? 'amber'
                            : 'neutral'
                      }
                    >
                      {item.status}
                    </Pill>
                  </span>
                </div>
              ))}

              {!loading && dashboard.commitments.length === 0 && (
                <div className="empty-state">
                  No commitments yet. Add your first one to get started.
                </div>
              )}

              <div className="commitment-table-foot">
                <span>
                  {dashboard.commitments.length} saved commitment
                  {dashboard.commitments.length === 1 ? '' : 's'}
                </span>

                <button
                  className="add-commitment-button"
                  onClick={() => setShowAddForm((value) => !value)}
                >
                  {showAddForm ? (
                    <X size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  {showAddForm ? 'Cancel' : 'Add a commitment'}
                </button>
              </div>

              {showAddForm && (
                <form className="add-form" onSubmit={addCommitment}>
                  <input
                    value={newCommitment}
                    onChange={(event) =>
                      setNewCommitment(event.target.value)
                    }
                    placeholder="What will you commit to?"
                    aria-label="New commitment"
                    required
                  />

                  <input
                    type="number"
                    min="1"
                    value={plannedMinutes}
                    onChange={(event) =>
                      setPlannedMinutes(event.target.value)
                    }
                    placeholder="Minutes"
                    aria-label="Planned duration in minutes"
                    required
                  />

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={savingCommitment}
                  >
                    {savingCommitment
                      ? 'Saving…'
                      : 'Save commitment'}
                    <ArrowRight size={15} />
                  </button>
                </form>
              )}
            </div>
          </section>

          <footer className="footer">
            <div className="footer-brand">
              <Leaf size={15} /> reality check<span>.</span>
            </div>
            <span>Built around evidence, not judgement.</span>
            <span className="footer-demo">
              LIVE DATA · LOCAL WORKSPACE
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
