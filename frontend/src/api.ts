const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) throw new Error('API unavailable')
  return response.json()
}

export async function calculateProject(input: {
  initial_investment: number
  annual_cash_flows: number[]
  discount_rate: number
}) {
  const response = await fetch(`${API_BASE}/api/v1/finance/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  if (!response.ok) throw new Error('Calculation failed')
  return response.json()
}
