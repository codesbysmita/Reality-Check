// DEMO ONLY: Replace this fixture with API responses when the backend is ready.
// Never present these sample metrics as a real user's behavior.
export const demoDashboard = {
  mode: 'demo',
  userLabel: 'Demo profile',
  periodLabel: 'Last 14 days',
  summary: {
    commitments: 12,
    completed: 7,
    postponed: 3,
    completionRate: 58,
  },
  focusPattern: {
    title: 'Planning beyond your recent pace',
    description: 'Your planned study sessions have been longer than the sessions you logged.',
    plannedAverageMinutes: 120,
    actualAverageMinutes: 48,
    sampleSize: 5,
    confidence: 'Based on 5 logged sessions',
  },
  commitments: [
    { id: 'demo-1', title: 'Study DSA', category: 'Study', planned: '60 min', status: 'Completed', when: 'Today' },
    { id: 'demo-2', title: 'Finish portfolio case study', category: 'Project', planned: '90 min', status: 'Postponed', when: 'Yesterday' },
    { id: 'demo-3', title: 'Apply to 3 internships', category: 'Career', planned: '45 min', status: 'In progress', when: 'Yesterday' },
  ],
  realityCheck: {
    currentDecision: 'Plan a four-hour study session tomorrow',
    facts: [
      'Your last 5 logged study sessions averaged 48 minutes.',
      'Your recent plans averaged 120 minutes per session.',
      'That is a 72-minute gap between planned and logged time.',
    ],
    pattern: 'Your planned sessions are consistently longer than your recent logged sessions.',
    interpretation: 'A four-hour block may be harder to follow through on unless something changes in the plan.',
    recommendation: 'Start with a 45-minute focused session, then decide whether to continue.',
    nextAction: 'Schedule one 45-minute DSA session',
  },
};
