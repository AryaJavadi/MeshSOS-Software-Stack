import { HouseholdRequest } from '../types'

export function computeTriageScore(request: HouseholdRequest): number {
  let score = 0
  if (request.supplies.includes('medical')) score += 3
  if (request.medicalProfiles.length > 0) score += 4
  if (request.people.infant > 0) score += 2
  if (request.people.senior > 0) score += 1
  if (request.status === 'new') score += 2
  const ageMinutes = (Date.now() - new Date(request.receivedAt).getTime()) / 60_000
  score += ageMinutes / 10
  return score
}
