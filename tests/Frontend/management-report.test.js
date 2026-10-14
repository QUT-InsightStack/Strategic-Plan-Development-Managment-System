import assert from 'node:assert/strict';
import test from 'node:test';
import { exportUrl, groupRows, reportQueryString } from '../../resources/js/pages/management/management-report.js';
import { navigationFor, flattenNavigation, canOpenPage } from '../../resources/js/access/navigation.js';

test('report requests send the shared dashboard filters', () => {
    assert.equal(reportQueryString({ planId: '3', period: '2023-2028', office: 'ICT Office', status: 'objective:overdue', approvalStatus: 'approved' }),
        'plan_id=3&period=2023-2028&office=ICT+Office&status=objective%3Aoverdue&approval_status=approved');
    assert.equal(reportQueryString({ planId: '', period: '', office: '', status: '', approvalStatus: '' }), '');
});

test('exports name one section table and keep the filters', () => {
    assert.equal(exportUrl({ period: '2023-2028' }, 'inputs', 'consolidation'),
        '/api/management/reports/master/export?period=2023-2028&format=csv&section=inputs&table=consolidation');
    assert.equal(exportUrl({}, 'overdue'), '/api/management/reports/master/export?format=csv&section=overdue');
});

test('grouped report tables start a group whenever the grouping value changes', () => {
    const rows = [{ plan: 'A', objective: 1 }, { plan: 'A', objective: 2 }, { plan: 'B', objective: 3 }];
    assert.deepEqual(groupRows(rows, 'plan').map(group => [group.group, group.rows.length]), [['A', 2], ['B', 1]]);
    assert.deepEqual(groupRows(rows), [{ group: null, rows }]);
});

test('the Reports & Summary link requires reports.view', () => {
    const reports = flattenNavigation(navigationFor('Management')).find(item => item.id === 'reports');
    assert.equal(canOpenPage(reports, { permissions: ['strategic_records.view'] }), false);
    assert.equal(canOpenPage(reports, { permissions: ['reports.view'] }), true);
});
