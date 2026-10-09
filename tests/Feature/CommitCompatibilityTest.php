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

    public function test_security_settings_keep_their_original_storage_validation_and_role_rules(): void
    {
        $this->authenticateApiUser($this->user('Technical Administrator'));
        $this->patchJson('/api/settings', [
            'session_idle_timeout_minutes' => 45, 'login_attempt_limit' => 3,
        ])->assertOk();
        $values = ['session_timeout_minutes' => 150, 'max_failed_login_attempts' => 1, 'lockout_duration_minutes' => 1500];
        $this->putJson('/api/security-settings', $values)->assertOk();
        $this->getJson('/api/security-settings')->assertOk()
            ->assertJsonPath('data.session_timeout_minutes', 150)
            ->assertJsonPath('data.lockout_duration_minutes', 1500);
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('data.session_idle_timeout_minutes', 45);
        $this->putJson('/api/security-settings', ['session_timeout_minutes' => 50])->assertUnprocessable();
        $this->putJson('/api/security-settings', [...$values, 'max_failed_login_attempts' => 0])->assertUnprocessable();

        $office = $this->user('Office');
        $this->authenticateApiUser($office);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.session_idle_timeout_minutes', 45);
        $this->getJson('/api/settings')->assertForbidden();
        $this->getJson('/api/security-settings')->assertForbidden();
        $this->putJson('/api/security-settings', $values)->assertForbidden();
        config(['security.login_lockout_minutes' => 17]);
        $login = app(AuthenticationLoginService::class);
        $request = Request::create('/api/auth/login', 'POST');
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $result = $login->login($office->email, 'incorrect', $request);
        }
        $this->assertSame('locked', $result['status']);
        $this->assertSame(17 * 60, $result['retry_after']);
    }

    public function test_office_ownership_does_not_bypass_assigned_unit_scope(): void
    {
        $office = $this->user('Office');
        $plan = $this->plan($office);
        $this->authenticateApiUser($office);
        $this->getJson('/api/strategic-plans/'.$plan->record_id)->assertForbidden();
        $this->getJson('/api/strategic-plans')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_office_mapping_lists_remain_scoped_to_their_unit(): void
    {
        $planner = $this->user('Planning Officer');
        $office = $this->user('Office');
        $office->update(['office' => 'Research Office']);
        $plan = $this->plan($planner);
        $assigned = $this->objective($plan, $planner);
        $other = $this->objective($plan, $planner);
        $unit = \App\Models\ResponsibleUnit::create([
            'responsible_office_agency' => 'Research Office',
            'name_key' => \App\Models\ResponsibleUnit::nameKey('Research Office'), 'is_active' => true,
        ]);
        $assigned->responsibleUnitAssignment()->create(['responsible_unit_id' => $unit->responsible_unit_id, 'assigned_by' => $planner->user_id]);
        $chapter = PdpChapter::create(['chapter_title' => 'Research', 'chapter_description' => 'Research priorities', 'created_by' => $planner->user_id]);
        foreach ([$assigned, $other] as $objective) {
            $objective->pdpChapters()->attach($chapter->chapter_id);
        }
        $url = '/api/strategic-plans/'.$plan->record_id.'/alignments';
        $this->authenticateApiUser($office);
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.objective_id', $assigned->objective_id)->assertJsonCount(1, 'meta.objectives');
        $this->authenticateApiUser($planner);
        $this->getJson($url)->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_mapping_lifecycle_and_references_persist_and_locked_plans_cannot_change(): void
    {
        Storage::fake('local');
        $planner = $this->user('Planning Officer');
        $plan = $this->plan($planner);
        $objective = $this->objective($plan, $planner);
        $chapter = PdpChapter::create(['chapter_title' => 'Research', 'chapter_description' => 'Research priorities', 'created_by' => $planner->user_id]);
        $base = '/api/strategic-objectives/'.$objective->objective_id.'/alignments';
        $pair = $base.'/pdp-chapter/'.$chapter->chapter_id;
        $list = '/api/strategic-plans/'.$plan->record_id.'/alignments';
        $this->authenticateApiUser($planner);
        $this->postJson($base, ['pdp_chapter_ids' => [$chapter->chapter_id]])->assertSuccessful();
        $document = $this->uploadDocument('strategic-plans/'.$plan->record_id);
        $reference = ['document_id' => $document, 'reference_section' => 'Chapter 2', 'page_paragraph' => 'Page 4', 'note' => 'Verified source'];
        $this->patchJson($pair.'/reference', $reference)->assertOk();
        $this->getJson($list)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_details.note', 'Verified source');
        $this->patchJson($pair.'/archive')->assertOk();
        $this->getJson($list)->assertJsonPath('data.0.status', 'archived')
            ->assertJsonPath('data.0.archived_by_name', 'Compatibility');
        $this->patchJson($pair.'/reference', [...$reference, 'note' => 'Must not save'])->assertUnprocessable();
        $chapter->forceFill(['status' => 'archived'])->save();
        $this->patchJson($pair.'/restore')->assertOk();
        $chapter->forceFill(['status' => 'active'])->save();
        $this->getJson($list)->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.reference_details.note', 'Verified source');

        foreach ([['draft', 'rejected'], ['finished', 'not_submitted'], ['finished', 'rejected'], ['finished', 'under_approval'], ['finished', 'approved']] as [$status, $state]) {
            $plan->forceFill(['status' => $status, 'approval_status' => $state])->save();
            $this->getJson($list)->assertOk()
                ->assertJsonPath('meta.capabilities.create', false)->assertJsonPath('meta.capabilities.archive', false)
                ->assertJsonPath('meta.capabilities.restore', false)->assertJsonPath('meta.capabilities.reference', false);
            $this->postJson($base, ['pdp_chapter_ids' => [$chapter->chapter_id]])->assertUnprocessable()->assertJsonValidationErrors('strategic_plan_id');
            $this->putJson($base, ['pdp_chapter_ids' => [$chapter->chapter_id]])->assertUnprocessable()->assertJsonValidationErrors('strategic_plan_id');
            $this->patchJson($pair.'/restore')->assertUnprocessable()->assertJsonValidationErrors('strategic_plan_id');
            $this->patchJson($pair.'/archive')->assertUnprocessable();
            $this->putJson($base, ['pdp_chapter_ids' => []])->assertUnprocessable();
            $this->patchJson($pair.'/reference', [...$reference, 'note' => 'Must not save'])->assertUnprocessable();
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

    public function test_document_uploads_still_require_explicit_metadata(): void
    {
        Storage::fake('local');
        $planner = $this->user('Planning Officer');
        $plan = $this->plan($planner);
        $this->authenticateApiUser($planner);
        $upload = fn () => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf');
        $this->post('/api/strategic-plans/'.$plan->record_id.'/documents', ['document' => $upload()], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reference_level', 'content_category']);
        $this->uploadDocument('strategic-plans/'.$plan->record_id);
        $this->assertDatabaseCount('tblstrategic_documents', 1);
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
        $this->putJson($base, ['pdp_chapter_ids' => []])->assertUnprocessable()->assertJsonValidationErrors('pdp_chapter_ids');
        $this->assertDatabaseHas('tblobjective_pdp_chapter', ['objective_id' => $objective->objective_id, 'status' => 'active']);

        $otherPlan = $this->plan($planner);
        $document = $this->uploadDocument('strategic-plans/'.$otherPlan->record_id);
        $reference = ['document_id' => $document, 'reference_section' => 'Chapter 1', 'page_paragraph' => 'Page 3'];
        $referenceUrl = $base.'/pdp-chapter/'.$chapter->chapter_id.'/reference';
        $this->patchJson($referenceUrl, $reference)
            ->assertUnprocessable()->assertJsonValidationErrors('document_id');
        $this->assertNull(DB::table('tblobjective_pdp_chapter')->where('objective_id', $objective->objective_id)->value('reference_details'));

        $reference['document_id'] = $this->uploadDocument('strategic-plans/'.$plan->record_id);
        $this->patchJson($referenceUrl, $reference)->assertOk();
        $otherObjective = $this->objective($plan, $planner);
        $reference['document_id'] = $this->uploadDocument('strategic-objectives/'.$otherObjective->objective_id);
        $this->patchJson($referenceUrl, $reference)->assertUnprocessable()->assertJsonValidationErrors('document_id');
        $reference['document_id'] = $this->uploadDocument('strategic-objectives/'.$objective->objective_id);
        $this->patchJson($referenceUrl, $reference)->assertOk();
        $this->patchJson($referenceUrl, ['document_id' => $reference['document_id']])->assertUnprocessable();
        $this->patchJson($referenceUrl, ['reference_section' => 'Chapter 1'])->assertUnprocessable();
        $permission = $planner->role->permissions()->where('code', 'strategic_documents.view')->sole();
        $planner->role->permissions()->detach($permission->permission_id);
        $this->authenticateApiUser($planner);
        $this->patchJson($referenceUrl, $reference)->assertForbidden();
    }

    private function uploadDocument(string $target): int
    {
        return $this->post('/api/'.$target.'/documents', [
            'document' => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf'),
            'reference_level' => 'Agency', 'content_category' => 'Supporting Evidence',
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.document_id');
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
