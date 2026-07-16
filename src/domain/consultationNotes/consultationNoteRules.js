// domain/consultationNotes/consultationNoteRules.js
// Business rules for a single consultation note: validation and the
// derived BMI calculation. No IndexedDB or Capacitor/DOM imports here.

/** Normalizes raw form input into a clean consultation note record shape. */
export function normalizeConsultationNoteInput(input) {
  return {
    clientId: Number(input.clientId),
    date: input.date || '',
    weight: parseOptionalNumber(input.weight),
    bodyFatPercent: parseOptionalNumber(input.bodyFatPercent),
    waist: parseOptionalNumber(input.waist),
    bloodPressure: (input.bloodPressure || '').trim(),
    medicalNotes: (input.medicalNotes || '').trim(),
    dietChanges: (input.dietChanges || '').trim(),
    followUpDate: input.followUpDate || '',
  };
}

export function validateConsultationNote(note) {
  const errors = {};

  if (!note.clientId) errors._global = 'A consultation note must belong to a client.';
  if (!note.date) errors.date = 'Date is required.';

  if (note.weight !== null && note.weight <= 0) {
    errors.weight = 'Weight must be greater than 0.';
  }

  if (note.bodyFatPercent !== null && (note.bodyFatPercent < 0 || note.bodyFatPercent > 100)) {
    errors.bodyFatPercent = 'Body fat must be between 0 and 100.';
  }

  if (note.waist !== null && note.waist <= 0) {
    errors.waist = 'Waist must be greater than 0.';
  }

  if (note.followUpDate && note.date && new Date(note.followUpDate) < new Date(note.date)) {
    errors.followUpDate = 'Follow-up date should be on or after the consultation date.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * BMI = weight(kg) / height(m)^2, rounded to 1 decimal. Computed once at
 * write-time from the client's height at that moment and stored on the
 * note — not re-derived on every read — so a client's height changing
 * later never rewrites historical BMI values.
 */
export function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  if (heightM <= 0) return null;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

function parseOptionalNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}
