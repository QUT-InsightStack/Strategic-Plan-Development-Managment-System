import { apiRequest } from './api-client.js';

const base = mapping => `/api/strategic-objectives/${mapping.objective_id}/alignments/${mapping.type}/${mapping.reference_id}`;
export const listPlanAlignments = planId => apiRequest(`/api/strategic-plans/${planId}/alignments`);
export const addAlignments = (objectiveId, data) => apiRequest(`/api/strategic-objectives/${objectiveId}/alignments`, { method: 'POST', body: JSON.stringify(data) });
export const replaceAlignments = (objectiveId, data) => apiRequest(`/api/strategic-objectives/${objectiveId}/alignments`, { method: 'PUT', body: JSON.stringify(data) });
export const archiveAlignment = mapping => apiRequest(`${base(mapping)}/archive`, { method: 'PATCH' });
export const restoreAlignment = mapping => apiRequest(`${base(mapping)}/restore`, { method: 'PATCH' });
export const deleteAlignment = (mapping, reason) => apiRequest(base(mapping), { method: 'DELETE', body: JSON.stringify({ reason }) });
export const updateAlignmentReference = (mapping, data) => apiRequest(`${base(mapping)}/reference`, { method: 'PATCH', body: JSON.stringify(data) });

// Used by summaries: count persisted links, including links saved by other users.
export function mappingsFromObjectives(objectives) {
    return objectives.flatMap(objective => [
        ...(objective.pdp_chapters || []).map(reference => ({ type: 'pdp-chapter', reference_id: reference.chapter_id, reference_title: reference.chapter_title })),
        ...(objective.presidential_agenda_items || []).map(reference => ({ type: 'presidential-agenda', reference_id: reference.agenda_id, reference_title: reference.title })),
    ].map(mapping => ({ ...mapping, id: `${objective.objective_id}:${mapping.type}:${mapping.reference_id}`,
        objective_id: objective.objective_id, dost_objective_id: objective.objective_id,
        objective_title: objective.objective_title, plan_id: objective.strategic_plan_id, status: 'active' })));
}
