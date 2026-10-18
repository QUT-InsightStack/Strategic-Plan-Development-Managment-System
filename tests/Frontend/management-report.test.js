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

test('Reports opens inside the Dashboard rather than from a separate link', () => {
    for (const role of ['Management', 'Planning Officer', 'Office', 'Administrative Admin']) {
        const items = flattenNavigation(navigationFor(role));
        assert.ok(items.every(item => !/tab=reports/.test(item.href)), role);
    }
    const office = flattenNavigation(navigationFor('Office')).find(item => item.id === 'monitoring-dashboard');
    assert.equal(canOpenPage(office, { permissions: ['reports.view'] }), true, 'a reports-only account can still open its Dashboard');
});
