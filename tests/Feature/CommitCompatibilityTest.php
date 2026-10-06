<?php

namespace Tests\Feature;

use App\Models\PdpChapter;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\AuthenticationLoginService;
use App\Services\PlanCreationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CommitCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
    }

    public function test_canonical_and_legacy_settings_share_runtime_values_and_authorization(): void
    {
        $this->authenticateApiUser($this->user('Technical Administrator'));
        $this->patchJson('/api/settings', [
            'session_idle_timeout_minutes' => 45, 'login_attempt_limit' => 3, 'login_lockout_minutes' => 22,
        ])->assertOk();
        $this->getJson('/api/security-settings')->assertOk()
            ->assertJsonPath('data.session_timeout_minutes', 45)
            ->assertJsonPath('data.lockout_duration_minutes', 22);
        $this->putJson('/api/security-settings', ['session_timeout_minutes' => 50])->assertOk();
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('data.session_idle_timeout_minutes', 50);
        $this->putJson('/api/security-settings', ['max_failed_login_attempts' => 0])->assertUnprocessable();

        $office = $this->user('Office');
        $this->authenticateApiUser($office);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.session_idle_timeout_minutes', 50);
        $this->getJson('/api/settings')->assertForbidden();
        $this->putJson('/api/security-settings', ['session_timeout_minutes' => 30])->assertForbidden();
        $login = app(AuthenticationLoginService::class);
        $request = Request::create('/api/auth/login', 'POST');
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $result = $login->login($office->email, 'incorrect', $request);
        }
        $this->assertSame('locked', $result['status']);
        $this->assertSame(22 * 60, $result['retry_after']);
    }

    public function test_management_plan_review_page_and_its_read_apis_are_available(): void
    {
        $manager = $this->user('Management');
        $plan = $this->plan($manager);
        $this->withoutVite();
        $this->get('/management-plan-review')->assertOk()->assertSee('Plan Review');
        $this->authenticateApiUser($manager);
        $this->getJson('/api/strategic-plans')->assertOk();
        $this->getJson('/api/strategic-plans/'.$plan->record_id)->assertOk();
        $this->getJson('/api/strategic-plans/'.$plan->record_id.'/objectives')->assertOk();
    }

    public function test_mapping_lifecycle_and_references_persist_and_locked_plans_cannot_change(): void
    {
        $planner = $this->user('Planning Officer');
        $plan = $this->plan($planner);
        $objective = $this->objective($plan, $planner);
        $chapter = PdpChapter::create(['chapter_title' => 'Research', 'chapter_description' => 'Research priorities', 'created_by' => $planner->user_id]);
        $base = '/api/strategic-objectives/'.$objective->objective_id.'/alignments';
        $pair = $base.'/pdp-chapter/'.$chapter->chapter_id;
        $list = '/api/strategic-plans/'.$plan->record_id.'/alignments';
        $this->authenticateApiUser($planner);
        $this->postJson($base, ['pdp_chapter_ids' => [$chapter->chapter_id]])->assertSuccessful();
        $this->patchJson($pair.'/reference', ['section' => 'Page 4', 'note' => 'Verified source'])->assertOk();
        $this->getJson($list)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_details.note', 'Verified source');
        $this->patchJson($pair.'/archive')->assertOk();
        $this->getJson($list)->assertJsonPath('data.0.status', 'archived');
        $this->patchJson($pair.'/reference', ['note' => 'Must not save'])->assertUnprocessable();
        $chapter->forceFill(['status' => 'archived'])->save();
        $this->patchJson($pair.'/restore')->assertUnprocessable();
        $chapter->forceFill(['status' => 'active'])->save();
        $this->patchJson($pair.'/restore')->assertOk();
        $this->getJson($list)->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.reference_details.note', 'Verified source');

        $plan->forceFill(['status' => 'finished', 'approval_status' => 'rejected'])->save();
        $this->putJson($base, ['pdp_chapter_ids' => []])->assertOk();
        $this->putJson($base, ['pdp_chapter_ids' => [$chapter->chapter_id]])->assertOk();
        foreach (['under_approval', 'approved'] as $state) {
            $plan->forceFill(['approval_status' => $state])->save();
            $this->patchJson($pair.'/archive')->assertUnprocessable();
            $this->putJson($base, ['pdp_chapter_ids' => []])->assertUnprocessable();
            $this->patchJson($pair.'/reference', ['note' => 'Must not save'])->assertUnprocessable();
        }
        $this->assertDatabaseHas('tblobjective_pdp_chapter', ['objective_id' => $objective->objective_id, 'status' => 'active']);
        $this->getJson($list)->assertJsonPath('meta.capabilities.archive', false);

        // Permanent deletion is tested on a separate, never-submitted draft.
        // Finished plans cannot transition back to draft.
        $plan = $this->plan($planner);
        $objective = $this->objective($plan, $planner);
        $objective->pdpChapters()->attach($chapter->chapter_id);
        $pair = '/api/strategic-objectives/'.$objective->objective_id.'/alignments/pdp-chapter/'.$chapter->chapter_id;
        $list = '/api/strategic-plans/'.$plan->record_id.'/alignments';
        $this->authenticateApiUser($this->user('Management'));
        $this->getJson($list)->assertOk()->assertJsonPath('meta.capabilities.delete', false);
        $this->patchJson($pair.'/archive')->assertForbidden();
        $this->patchJson($pair.'/restore')->assertForbidden();
        $this->deleteJson($pair, ['reason' => 'No rights'])->assertForbidden();
        $this->authenticateApiUser($this->user('Technical Administrator'));
        $this->getJson($list)->assertOk()->assertJsonPath('meta.capabilities.delete', true);
        $this->deleteJson($pair)->assertUnprocessable();
        $this->deleteJson($pair, ['reason' => 'Duplicate entry'])->assertOk();
        $this->getJson($list)->assertJsonCount(0, 'data');
        $this->assertNotNull($chapter->fresh());
        $this->assertNotNull($objective->fresh());
    }

    public function test_old_uploads_get_defaults_but_invalid_metadata_and_out_of_scope_targets_are_rejected(): void
    {
        Storage::fake('local');
        $office = $this->user('Office');
        $plan = $this->plan($office);
        $this->authenticateApiUser($office);
        $upload = fn () => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf');
        $this->post('/api/strategic-plans/'.$plan->record_id.'/documents', ['document' => $upload()], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.reference_level', 'Agency')
            ->assertJsonPath('data.content_category', 'Supporting Evidence');
        $this->post('/api/strategic-plans/'.$plan->record_id.'/documents', ['document' => $upload(), 'reference_level' => 'Invalid'], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('reference_level');
        $other = $this->user('Planning Officer');
        $otherPlan = $this->plan($other);
        $objective = $this->objective($otherPlan, $other);
        foreach (['strategic-plans/'.$otherPlan->record_id, 'strategic-objectives/'.$objective->objective_id] as $target) {
            $this->post('/api/'.$target.'/documents', ['document' => $upload()], ['Accept' => 'application/json'])->assertForbidden();
        }
        $this->assertDatabaseCount('tblstrategic_documents', 1);
    }

    public function test_upgrade_preserves_existing_users_passwords_and_plan_data(): void
    {
        $user = $this->user('Planning Officer');
        $plan = $this->plan($user);
        $before = $user->getRawOriginal('password');
        $count = User::count();
        $this->artisan('spdms:upgrade', ['--force' => true])->assertSuccessful();
        $this->artisan('spdms:upgrade', ['--force' => true])->assertSuccessful();
        $this->assertSame($count, User::count());
        $this->assertSame($before, $user->fresh()->getRawOriginal('password'));
        $this->assertSame($plan->title, $plan->fresh()->title);
        $this->assertSame($user->user_id, $plan->fresh()->created_by);
    }

    public function test_put_cannot_bypass_archive_permission_and_reference_documents_must_belong_to_the_plan(): void
    {
        Storage::fake('local');
        $planner = $this->user('Planning Officer');
        $plan = $this->plan($planner);
        $objective = $this->objective($plan, $planner);
        $chapter = PdpChapter::create(['chapter_title' => 'Research', 'chapter_description' => 'Research priorities', 'created_by' => $planner->user_id]);
        $objective->pdpChapters()->attach($chapter->chapter_id);
        $base = '/api/strategic-objectives/'.$objective->objective_id.'/alignments';
        $permission = $planner->role->permissions()->where('code', 'strategic_alignments.archive')->sole();
        $planner->role->permissions()->detach($permission->permission_id);
        $this->authenticateApiUser($planner);
        $this->putJson($base, ['pdp_chapter_ids' => []])->assertForbidden();
        $this->assertDatabaseHas('tblobjective_pdp_chapter', ['objective_id' => $objective->objective_id, 'status' => 'active']);

        $otherPlan = $this->plan($planner);
        $document = $this->post('/api/strategic-plans/'.$otherPlan->record_id.'/documents', [
            'document' => UploadedFile::fake()->create('other.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.document_id');
        $this->patchJson($base.'/pdp-chapter/'.$chapter->chapter_id.'/reference', ['document_id' => $document])
            ->assertUnprocessable()->assertJsonValidationErrors('document_id');
        $this->assertNull(DB::table('tblobjective_pdp_chapter')->where('objective_id', $objective->objective_id)->value('reference_details'));
    }

    private function user(string $role): User
    {
        return User::create(['first_name' => 'Compatibility', 'email' => fake()->unique()->safeEmail(),
            'password' => 'ExistingPassword123!', 'status' => 'active',
            'role_id' => Role::where('role_name', $role)->sole()->role_id]);
    }

    private function plan(User $owner): Strategic
    {
        return app(PlanCreationService::class)->create(['title' => 'Compatibility plan', 'level' => 'strategic_plan',
            'mission' => 'Research', 'vision' => 'Services', 'core_values' => ['Integrity'], 'status' => 'draft'], $owner);
    }

    private function objective(Strategic $plan, User $owner): StrategicObjective
    {
        return StrategicObjective::create(['strategic_plan_id' => $plan->record_id, 'created_by' => $owner->user_id,
            'objective_title' => 'Research', 'status' => 'draft']);
    }
}
