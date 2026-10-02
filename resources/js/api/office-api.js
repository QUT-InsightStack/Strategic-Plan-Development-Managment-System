// Legacy demo adapter, retained for explicitly labelled compatibility UI only.
import { listLocalOfficeUpdates, saveLocalOfficeUpdate } from '../data/legacy-office-updates.js';
export const listOfficeUpdates = (planId, page = 1) => Promise.resolve(listLocalOfficeUpdates(planId, page));
export const saveOfficeUpdate = (plan, data, session) => Promise.resolve(saveLocalOfficeUpdate(plan, data, session));
