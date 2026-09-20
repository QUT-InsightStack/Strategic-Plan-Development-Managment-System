import { listLocalOfficeUpdates, saveLocalOfficeUpdate } from '../data/office-demo-storage.js';
export const listOfficeUpdates = (planId, page = 1) => Promise.resolve(listLocalOfficeUpdates(planId, page));
export const saveOfficeUpdate = (plan, data, session) => Promise.resolve(saveLocalOfficeUpdate(plan, data, session));
