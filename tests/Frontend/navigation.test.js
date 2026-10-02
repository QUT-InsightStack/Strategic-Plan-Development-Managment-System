import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalOfficeUrl, navigationFor, flattenNavigation, canOpenPage, isCurrentPage, pageForUrl } from '../../resources/js/access/navigation.js';
import { listUploadPlans } from '../../resources/js/api/strategic-plans-api.js';
import { officePlanHref, officeViewShowsAllPlans } from '../../resources/js/pages/office/office-plan-navigation.js';

test('Office plan actions keep their own destination and all-plan read scope', () => {
    for (const view of ['review', 'comments', 'proposal']) {
        const url = new URL(officePlanHref(17, view), 'http://localhost');
        assert.equal(url.searchParams.get('plan'), '17');
        assert.equal(url.searchParams.get('view') || 'review', view);
        assert.equal(url.searchParams.get('include_all_office_plans'), '1');
        assert.equal(officeViewShowsAllPlans(view), true);
        assert.equal(pageForUrl(url.href, 'Office').id, view === 'review' ? 'office-review' : view === 'comments' ? 'comments' : 'proposals');
    }
    assert.equal(officeViewShowsAllPlans('inputs'), false);
    assert.equal(new URL(officePlanHref(17, 'inputs'), 'http://localhost').searchParams.has('include_all_office_plans'), false);
});

test('legacy agency upload links resolve to the same page without losing plan selection', () => {
    assert.equal(canonicalOfficeUrl('/office?view=agency-input&plan=17#files'), '/office?view=inputs&plan=17#files');
    const upload = pageForUrl('/office?view=agency-input&plan=17', 'Office');
    assert.equal(upload.id, 'office-upload');
    assert.equal(isCurrentPage(upload, '/office?view=inputs&plan=19'), true);
    assert.equal(isCurrentPage(upload, '/office?view=comments'), false);
});

test('each role has unique sidebar destinations and explicit placeholder destinations', () => {
    for (const role of ['Technical Admin', 'Administrative Admin', 'Planning Officer', 'Office', 'Management']) {
        const items = flattenNavigation(navigationFor(role)).filter(item => !item.dashboardOnly);
        assert.equal(new Set(items.map(item => item.href)).size, items.length, role);
        for (const item of items.filter(item => item.placeholder)) {
            assert.equal(new URL(item.href, 'http://localhost').searchParams.get('feature'), item.id);
        }
    }
});

test('Office progress accepts view, update or correction permission but still requires plan access', () => {
    const progress = pageForUrl('/office?view=progress', 'Office');
    assert.equal(canOpenPage(progress, { permissions: ['strategic_records.view', 'strategic_objectives.update_progress'] }), true);
    assert.equal(canOpenPage(progress, { permissions: ['strategic_objectives.update_progress'] }), false);
    assert.equal(canOpenPage(progress, { permissions: [] }), false);
    assert.equal(canOpenPage(progress, { permissions: ['*'] }), true);
});

test('role administration uses real account pages, not generic demo resource destinations', () => {
    assert.equal(pageForUrl('/role-management', 'Technical Admin').id, 'roles');
    assert.equal(pageForUrl('/role-management?section=permissions', 'Technical Admin').id, 'permissions');
    assert.equal(pageForUrl('/role-management', 'Office'), undefined);
});

test('draft upload selector loads all result pages and never asks for broader Office scope', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
        const query = new URL(url, 'http://localhost').searchParams;
        calls.push(query);
        return { ok: true, status: 200, json: async () => ({ data: [{ record_id: Number(query.get('page')) }], meta: { last_page: 2 } }) };
    });
    const result = await listUploadPlans();
    assert.deepEqual(result.data.map(plan => plan.record_id), [1, 2]);
    assert.equal(calls.length, 2);
    calls.forEach(query => {
        assert.equal(query.get('status'), 'draft');
        assert.equal(query.has('include_all_office_plans'), false);
    });
});

test('read-only mapping resolves independently from the mapping editor', () => {
    assert.equal(pageForUrl('/mappings?mode=view', 'Office').id, 'alignment');
    assert.equal(pageForUrl('/mappings', 'Office').id, 'mapping');
});
