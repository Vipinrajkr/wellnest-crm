// domain/clients/clientRules.js
// Business rules for a client record: the status lifecycle, validation,
// and input normalization. No IndexedDB or Capacitor imports here.

export const CLIENT_STATUS = Object.freeze({
  LEAD: 'lead',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
});

export const CLIENT_STATUS_ORDER = [
  CLIENT_STATUS.LEAD,
  CLIENT_STATUS.ACTIVE,
  CLIENT_STATUS.COMPLETED,
  CLIENT_STATUS.DROPPED,
];

export const CLIENT_STATUS_LABELS = {
  [CLIENT_STATUS.LEAD]: 'Lead',
  [CLIENT_STATUS.ACTIVE]: 'Active',
  [CLIENT_STATUS.COMPLETED]: 'Completed',
  [CLIENT_STATUS.DROPPED]: 'Dropped',
};

/**
 * Normalizes raw form input into a clean client record shape.
 * Does not persist anything — pure transform only.
 */
export function normalizeClientInput(input) {
  return {
    fullName: (input.fullName || '').trim(),
    phone: (input.phone || '').trim(),
    email: (input.email || '').trim(),
    gender: input.gender || '',
    dob: input.dob || '',
    height_cm:
      input.height_cm === '' || input.height_cm === undefined || input.height_cm === null
        ? null
        : Number(input.height_cm),
    goals: (input.goals || '').trim(),
    medicalNotes: (input.medicalNotes || '').trim(),
    status: CLIENT_STATUS_ORDER.includes(input.status) ? input.status : CLIENT_STATUS.LEAD,
  };
}

/**
 * Validates a normalized client record.
 * @returns {{ isValid: boolean, errors: Record<string,string> }}
 */
export function validateClient(client) {
  const errors = {};

  if (!client.fullName) {
    errors.fullName = 'Full name is required.';
  }

  if (!CLIENT_STATUS_ORDER.includes(client.status)) {
    errors.status = 'Invalid status.';
  }

  if (client.email && !/^\S+@\S+\.\S+$/.test(client.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (client.phone && !/^[0-9+\-\s()]{6,20}$/.test(client.phone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (client.height_cm !== null) {
    if (Number.isNaN(client.height_cm) || client.height_cm <= 0) {
      errors.height_cm = 'Height must be a positive number.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
