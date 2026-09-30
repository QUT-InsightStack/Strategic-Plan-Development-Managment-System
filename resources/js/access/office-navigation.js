import { PERMISSIONS as P } from './access-policy.js';
export const isOfficeRole = role => ['Office', 'Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export const officeItems = [
 { label: 'Planning Module', icon: 'bi-clipboard2-check', permission: P.PLANS_VIEW, children: [
  { label: 'Review and Provide Planning Inputs', href: '/office', permission: P.PLANS_VIEW },
  { label: 'Propose Objective', href: '/office?view=proposal', permission: P.OBJECTIVES_CREATE },
  { label: 'Submit Planning Inputs', href: '/office?view=inputs', permission: P.DOCUMENTS_UPLOAD },
  { label: 'Submit Agency Input', href: '/office?view=agency-input', permission: P.INPUTS_CREATE },
  { label: 'Edit Assigned Draft Objectives', href: '/office?view=edit', permission: P.OBJECTIVES_UPDATE },
  { label: 'Update and Monitor Progress', href: '/office?view=progress', permission: P.OBJECTIVES_UPDATE_PROGRESS }
 ] },
 { label: 'Mapping Module', icon: 'bi-map', permission: P.PLANS_VIEW, children: [
  { label: 'Add Agency to Mapping', href: '/mappings', permission: 'relations.create' },
  { label: 'View Alignment', href: '/mappings?mode=view', permission: 'relations.view' }
 ] }
];
