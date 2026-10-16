<?php

namespace Tests\Feature;

use App\Models\LoginHistory;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TechnicalActivityReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_requires_authentication_and_a_technical_permission(): void
    {
        $this->getJson('/api/technical/reports/activity')->assertUnauthorized();
        $this->authenticateApiUser($this->user('Report Reader', ['reports.view', 'strategic_records.view']));
        $this->getJson('/api/technical/reports/activity')->assertForbidden();
    }

    public function test_sections_follow_permissions_and_omitted_sections_are_listed(): void
    {
        $this->authenticateApiUser($this->user('Account Auditor', ['users.view', 'login_history.view']));
        $response = $this->getJson('/api/technical/reports/activity?days=7')->assertOk();

        $this->assertSame(['cover', 'summary', 'accounts', 'signins', 'annex'], collect($response->json('data.sections'))->pluck('id')->all());
        $this->assertSame(['audit', 'assistance', 'health', 'backups', 'workflow'], collect($response->json('data.omitted_sections'))->pluck('id')->all());
        $this->assertSame(7, $response->json('data.meta.days'));
        $kpis = collect($response->json('data.sections.1.kpis'))->keyBy('key');
        $this->assertTrue($kpis['accounts']['available']);
        $this->assertFalse($kpis['alerts']['available']);
        $this->assertSame(['locked', 'failed_signins'], collect($response->json('data.sections.1.attention'))->pluck('key')->all());
    }

    public function test_sign_in_figures_count_the_selected_period(): void
    {
        $user = $this->user('Sign-in Auditor', ['login_history.view']);
        foreach ([['success', now()->subDay()], ['failed', now()->subDays(2)], ['failed', now()->subDays(40)]] as [$status, $at]) {
            LoginHistory::create(['user_id' => $user->user_id, 'user_name' => 'Auditor', 'email' => $user->email, 'ip_address' => '127.0.0.1',
                'user_agent' => 'test', 'status' => $status, 'failure_reason' => $status === 'failed' ? 'invalid_password' : null, 'attempted_at' => $at]);
        }
        $this->authenticateApiUser($user);

        $kpi = collect($this->getJson('/api/technical/reports/activity?days=30')->assertOk()->json('data.sections.1.kpis'))->firstWhere('key', 'signins');
        $this->assertSame(1, $kpi['value']);
        $this->assertStringStartsWith('1 failed sign-ins', $kpi['detail']);
        $this->getJson('/api/technical/reports/activity?days=14')->assertUnprocessable();
    }

    public function test_export_is_limited_to_allowed_sections(): void
    {
        $this->authenticateApiUser($this->user('Account Exporter', ['users.view']));
        $this->get('/api/technical/reports/activity/export?format=csv&section=accounts&table=roles')->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->getJson('/api/technical/reports/activity/export?format=csv&section=backups')->assertForbidden();
    }

    private function user(string $roleName, array $codes): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['is_assignable' => true, 'is_protected' => false]);
        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => explode('.', $code)[0]]);
            $role->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }

        return User::create(['first_name' => 'Technical', 'last_name' => $roleName, 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id]);
    }
}
