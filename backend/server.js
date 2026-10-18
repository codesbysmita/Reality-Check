
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { commitments: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function minutes(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Reality Check API" });
});

app.get("/api/dashboard", (req, res) => {
  const { commitments } = loadData();

  const completed = commitments.filter(c => c.status === "Completed");
  const postponed = commitments.filter(c => c.status === "Postponed");
  const observed = commitments.filter(c => c.actualMinutes != null);

  const plannedValues = observed
    .map(c => c.plannedMinutes)
    .filter(n => Number.isFinite(n));

  const actualValues = observed
    .map(c => c.actualMinutes)
    .filter(n => Number.isFinite(n));

  const avg = values =>
    values.length
      ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
      : null;

  const plannedAverageMinutes = avg(plannedValues);
  const actualAverageMinutes = avg(actualValues);

  let focusPattern = null;

  if (observed.length >= 3) {
    focusPattern = {
      title: "Planning compared with observed time",
      description:
        "Compare planned session lengths with the time recorded.",
      plannedAverageMinutes,
      actualAverageMinutes,
      sampleSize: observed.length,
      confidence: `Based on ${observed.length} recorded outcomes`,
    };
  }

  const latest = [...commitments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    mode: "live",
    userLabel: "Local profile",
    periodLabel: "All recorded commitments",
    summary: {
      commitments: commitments.length,
      completed: completed.length,
      postponed: postponed.length,
      completionRate: commitments.length
        ? Math.round((completed.length / commitments.length) * 100)
        : 0,
    },
    focusPattern,
    commitments: latest.map(c => ({
      ...c,
      planned: `${c.plannedMinutes} min`,
      when: new Date(c.createdAt).toLocaleDateString(),
    })),
    realityCheck: null,
  });
});

app.post("/api/commitments", (req, res) => {
  const { title, category = "Other", plannedMinutes, dueAt = null } = req.body;
  const planned = minutes(plannedMinutes);

  if (typeof title !== "string" || !title.trim() || planned === null || planned <= 0) {
    return res.status(400).json({
      error: "A title and a positive plannedMinutes value are required.",
    });
  }

  const data = loadData();

  const commitment = {
    id: crypto.randomUUID(),
    title: title.trim(),
    category: String(category),
    plannedMinutes: planned,
    dueAt,
    status: "In progress",
    actualMinutes: null,
    note: "",
    createdAt: new Date().toISOString(),
  };

  data.commitments.push(commitment);
  saveData(data);

  res.status(201).json(commitment);
});

app.patch("/api/commitments/:id/outcome", (req, res) => {
  const { status, actualMinutes, note = "" } = req.body;
  const allowed = ["Completed", "Postponed", "In progress", "Missed"];
  const data = loadData();

  const commitment = data.commitments.find(
    c => c.id === req.params.id
  );

  if (!commitment) {
    return res.status(404).json({ error: "Commitment not found." });
  }

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${allowed.join(", ")}`,
    });
  }

  if (actualMinutes !== undefined) {
    const actual = minutes(actualMinutes);

    if (actual === null) {
      return res.status(400).json({
        error: "actualMinutes must be a non-negative number.",
      });
    }

    commitment.actualMinutes = actual;
  }

  commitment.status = status;
  commitment.note = String(note);
  commitment.updatedAt = new Date().toISOString();

  saveData(data);
  res.json(commitment);
});

app.post("/api/reality-check", (req, res) => {
  const { decision } = req.body;

  if (typeof decision !== "string" || !decision.trim()) {
    return res.status(400).json({
      error: "Please provide a decision to evaluate.",
    });
  }

  const { commitments } = loadData();

  const observed = commitments.filter(c => c.actualMinutes != null);

  const plannedAverage = observed.length
    ? Math.round(observed.reduce((sum, c) =>
        sum + c.plannedMinutes, 0) / observed.length)
    : null;

  const actualAverage = observed.length
    ? Math.round(observed.reduce((sum, c) =>
        sum + c.actualMinutes, 0) / observed.length)
    : null;

  const facts = observed.length
    ? [
        `${observed.length} commitment outcome(s) have recorded time.`,
        `Average planned time: ${plannedAverage} minutes.`,
        `Average recorded time: ${actualAverage} minutes.`,
      ]
    : [
        "No commitment outcomes with recorded time are available yet.",
      ];

  const enoughEvidence = observed.length >= 3;
  const gap = plannedAverage !== null && actualAverage !== null
    ? plannedAverage - actualAverage
    : null;

  const realityCheck = {
    currentDecision: decision.trim(),
    facts,
    pattern: enoughEvidence && gap > 0
      ? "Recorded sessions have averaged less time than planned."
      : enoughEvidence
        ? "The recorded averages do not show a consistent planning-overrun pattern."
        : null,
    interpretation: enoughEvidence
      ? "Use these recorded outcomes as context, not as a prediction of what you can achieve."
      : "There is not enough recorded history to identify a recurring pattern yet.",
    recommendation: enoughEvidence && gap > 0
      ? `Consider starting with a ${Math.max(15, actualAverage)}-minute session and reviewing your progress.`
      : "Record a few commitments and their actual outcomes before drawing conclusions.",
    nextAction: enoughEvidence && gap > 0
      ? `Schedule a ${Math.max(15, actualAverage)}-minute focused session`
      : "Record the outcome of your next commitment",
  };

  res.json({ realityCheck });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Reality Check API running at http://localhost:${PORT}`);
});
