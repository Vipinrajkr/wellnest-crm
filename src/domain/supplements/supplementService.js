// domain/supplements/supplementService.js
// Orchestrates supplement CRUD plus the Complete/Discontinue lifecycle
// actions. Delegates persistence to the supplements repository; validation
// and the derived Duration label come from supplementRules. This is the
// only module the state layer calls into for supplement operations.

import { supplementsRepo } from '../../data/repositories/supplementsRepo.js';
import {
  normalizeSupplementInput,
  validateSupplement,
  calculateDurationLabel,
  SUPPLEMENT_STATUS,
} from './supplementRules.js';

export async function listSupplementsForClient(clientId) {
  const supplements = await supplementsRepo.getByClientId(Number(clientId));
  return supplements.map(decorateSupplement).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
}

export async function createSupplement(input) {
  const normalized = normalizeSupplementInput(input);
  const { isValid, errors } = validateSupplement(normalized);
  if (!isValid) {
    return { success: false, errors };
  }

  const now = new Date().toISOString();
  const record = { ...normalized, createdAt: now, updatedAt: now };
  const id = await supplementsRepo.create(record);
  return { success: true, id };
}

export async function completeSupplement(id) {
  const existing = await supplementsRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Supplement not found.' } };
  }

  await supplementsRepo.update(id, {
    ...existing,
    status: SUPPLEMENT_STATUS.COMPLETED,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}

export async function discontinueSupplement(id) {
  const existing = await supplementsRepo.getById(id);
  if (!existing) {
    return { success: false, errors: { _global: 'Supplement not found.' } };
  }

  await supplementsRepo.update(id, {
    ...existing,
    status: SUPPLEMENT_STATUS.DISCONTINUED,
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}

function decorateSupplement(supplement) {
  return {
    ...supplement,
    durationLabel: calculateDurationLabel(supplement.startDate, supplement.endDate),
  };
}
