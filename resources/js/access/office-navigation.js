import { PERMISSIONS as P } from './access-policy.js';
export const isOfficeRole = role => ['Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export const officeItems = [
 { label: 'Planning Module', icon: 'bi-clipboard2-check', permission: P.PLANS_VIEW, children: [
  { label: 'Plan Comments', href: '/office', permission: P.OBJECTIVES_UPDATE },
  { label: 'Submit Input / Objective', href: '/office?view=inputs', permission: P.OBJECTIVES_CREATE },
  { label: 'Edit Assigned Draft Objectives', href: '/office?view=edit', permission: P.OBJECTIVES_UPDATE },
  { label: 'Update Assigned Progress', href: '/office?view=progress', permission: P.OBJECTIVES_UPDATE_PROGRESS }
 ] },
 { label: 'Mapping Module', icon: 'bi-map', permission: P.PLANS_VIEW, children: [
  { label: 'Map Agency Inputs', href: '/mappings', permission: 'relations.create' },
  { label: 'View Alignment', href: '/mappings?mode=view', permission: 'relations.view' }
 ] }
];
