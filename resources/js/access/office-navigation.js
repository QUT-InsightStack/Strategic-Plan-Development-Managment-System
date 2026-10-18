export { isOfficeRole } from './navigation.js';
import { flattenNavigation, roleNavigation } from './navigation.js';
export const officeItems = roleNavigation.office;

// The Office workspace mixes top-level links (Dashboard) and stage groups, so search the flattened
// list rather than each group's children. Alternate names (alias) never stand in for the page itself.
export function officeEntryFor(href) {
    return flattenNavigation(officeItems).find(item => item.href === href && !item.alias);
}
