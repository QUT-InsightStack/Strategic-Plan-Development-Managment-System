import { PERMISSIONS as P } from './access-policy.js';
export const isOfficeRole = role => ['Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export const officeItems = [
 { label: 'Planning Module', icon: 'bi-clipboard2-check', permission: P.PLANS_VIEW, children: [
  { label: 'View Plans', href: '/office?view=comments', permission: P.PLANS_VIEW },
  { label: 'Submit Input / Objective', href: '/office?view=inputs', permission: P.OBJECTIVES_CREATE },
  { label: 'Edit Assigned Draft Objectives', href: '/office?view=edit', permission: P.OBJECTIVES_UPDATE },
  { label: 'Progress Monitoring', href: '/office?view=progress', permission: P.OBJECTIVES_VIEW_PROGRESS }
 ] },
 { label: 'Mapping Module', icon: 'bi-map', permission: P.PLANS_VIEW, children: [
  { label: 'View / Add Mapping', href: '/mappings', permission: 'relations.create' },
  { label: 'View Mapping', href: '/mappings?mode=view', permission: 'relations.view' }
 ] }
];
