
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error || `API request failed (${response.status})`
    );
  }

  return response.json();
}

export const realityCheckApi = {
  getDashboard: () => request("/api/dashboard"),

  createRealityCheck: (decision) =>
    request("/api/reality-check", {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),

  createCommitment: (payload) =>
    request("/api/commitments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateOutcome: (id, payload) =>
    request(`/api/commitments/${encodeURIComponent(id)}/outcome`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
