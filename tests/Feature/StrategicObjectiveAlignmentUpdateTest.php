<?php

namespace Tests\Feature;

use App\Contracts\StrategicLogWriter;
use App\Models\AuthSession;
use App\Models\Log;
use App\Models\PdpChapter;
use App\Models\PresidentialAgendaItem;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\StrategicPlanAuthorizationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StrategicObjectiveAlignmentUpdateTest extends TestCase
{
    use RefreshDatabase;

    private User $officer;

    private Strategic $plan;

    private StrategicObjective $objective;

    private PdpChapter $chapter;

    private PresidentialAgendaItem $agenda;

    protected function setUp(): void
    {
        parent::setUp();
        config(['jwt.secret' => str_repeat('alignment-update-test-', 4)]);
        $this->seed([PermissionSeeder::class, RolesSeeder::class, RolePermissionSeeder::class]);
        $this->officer = User::create([
            'first_name' => 'Planning', 'last_name' => 'Officer',
            'email' => 'alignment-update@example.com', 'password' => 'Password123!',
            'status' => 'active', 'role_id' => Role::where('role_name', 'Planning Officer')->sole()->role_id,
        ])->refresh();
        $this->plan = $this->createPlan();
        $this->objective = StrategicObjective::create([
            'strategic_plan_id' => $this->plan->record_id, 'created_by' => $this->officer->user_id,
            'objective_title' => 'Improve services', 'status' => 'draft',
        ]);
        $this->chapter = $this->createChapter();
        $this->agenda = $this->createAgenda();
        $this->objective->pdpChapters()->attach($this->chapter->chapter_id);
        $this->objective->presidentialAgendaItems()->attach($this->agenda->agenda_id);
    }

    public function test_officer_can_add_remove_and_retain_mappings_without_changing_other_objectives(): void
    {
        $retainedChapter = $this->createChapter();
        $retainedAgenda = $this->createAgenda();
        $addedChapter = $this->createChapter();
        $addedAgenda = $this->createAgenda();
        $this->objective->pdpChapters()->attach($retainedChapter->chapter_id);
        $this->objective->presidentialAgendaItems()->attach($retainedAgenda->agenda_id);

        // Shared references on objectives both within this plan and in another plan.
        foreach ([$this->plan, $this->createPlan()] as $plan) {
            $other = $this->objective->replicate();
            $other->strategic_plan_id = $plan->record_id;
            $other->save();
            $other->pdpChapters()->attach([$this->chapter->chapter_id, $retainedChapter->chapter_id]);
            $other->presidentialAgendaItems()->attach([$this->agenda->agenda_id, $retainedAgenda->agenda_id]);
        }
        $before = $this->snapshot();
        $otherObjectives = DB::table('tblstrategic_objectives')->where('objective_id', '!=', $this->objective->objective_id)->get()->all();
        $payload = [
            'pdp_chapter_ids' => [$addedChapter->chapter_id, $retainedChapter->chapter_id],
            'presidential_agenda_item_ids' => [$addedAgenda->agenda_id, $retainedAgenda->agenda_id],
        ];
        $this->travel(1)->minutes();
        $this->authenticateApiUser($this->officer);
        $response = $this->putJson($this->endpoint(), $payload)->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.objective_id', $this->objective->objective_id)
            ->assertJsonPath('data.updated_by', $this->officer->user_id)
            ->assertJsonCount(2, 'data.pdp_chapters')
            ->assertJsonCount(2, 'data.presidential_agenda_items');

        foreach ([
            ['tblobjective_pdp_chapter', 'chapter_id', $this->chapter->chapter_id, $addedChapter->chapter_id],
            ['tblobjective_presidential_agenda', 'agenda_id', $this->agenda->agenda_id, $addedAgenda->agenda_id],
        ] as [$table, $key, $removed, $added]) {
            $this->assertDatabaseMissing($table, ['objective_id' => $this->objective->objective_id, $key => $removed]);
            $this->assertDatabaseHas($table, ['objective_id' => $this->objective->objective_id, $key => $added, 'created_at' => now()->toDateTimeString()]);
            foreach ($before[$table] as $row) {
                if ($row->objective_id !== $this->objective->objective_id || $row->{$key} !== $removed) {
                    $this->assertDatabaseHas($table, (array) $row);
                }
            }
            $this->assertDatabaseCount($table, 6);
        }
        $this->assertEquals($otherObjectives, DB::table('tblstrategic_objectives')->where('objective_id', '!=', $this->objective->objective_id)->get()->all());
        $this->assertSame($before['objective']['created_by'], $this->objective->fresh()->created_by);
        $this->assertNotEquals($before['objective']['updated_at'], $this->objective->fresh()->getRawOriginal('updated_at'));
        $this->getJson('/api/strategic-objectives/'.$this->objective->objective_id)->assertOk()
            ->assertJsonPath('data.pdp_chapters', $response->json('data.pdp_chapters'))
            ->assertJsonPath('data.presidential_agenda_items', $response->json('data.presidential_agenda_items'));
        $log = Log::where('operation', 'strategic_objective.alignments_updated')->sole();
        $this->assertSame($this->officer->user_id, $log->user_id);
        $this->assertSame($this->objective->objective_id, $log->resource_id);
        $this->assertSame([
            'pdp_chapter_ids' => ['added' => [$addedChapter->chapter_id], 'removed' => [$this->chapter->chapter_id]],
            'presidential_agenda_item_ids' => ['added' => [$addedAgenda->agenda_id], 'removed' => [$this->agenda->agenda_id]],
        ], $log->metadata['changes']);
    }

    public function test_reordered_and_repeated_updates_preserve_all_pivot_and_objective_metadata(): void
    {
        $second = $this->createChapter();
        $this->objective->pdpChapters()->attach($second->chapter_id);
        $before = $this->snapshot();
        $this->travel(1)->minutes();
        $this->authenticateApiUser($this->officer);
        $payload = ['pdp_chapter_ids' => [$second->chapter_id, $this->chapter->chapter_id]];
        $this->putJson($this->endpoint(), $payload)->assertOk();
        $this->putJson($this->endpoint(), $payload)->assertOk();
        $this->assertUnchanged($before);
    }

    public static function mappingFields(): array
    {
        return [['pdp_chapter_ids', 'tblobjective_pdp_chapter', 'tblobjective_presidential_agenda'],
            ['presidential_agenda_item_ids', 'tblobjective_presidential_agenda', 'tblobjective_pdp_chapter']];
    }

    #[DataProvider('mappingFields')]
    public function test_empty_list_clears_only_that_framework_and_omitted_framework_is_unchanged(string $field, string $cleared, string $retained): void
    {
        $before = $this->snapshot();
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), [$field => []])->assertOk();
        $this->assertDatabaseCount($cleared, 0);
        $this->assertEquals($before[$retained], $this->snapshot()[$retained]);
        $this->assertNotNull($this->chapter->fresh());
        $this->assertNotNull($this->agenda->fresh());
    }

    public function test_both_frameworks_can_be_cleared_and_repopulated(): void
    {
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), ['pdp_chapter_ids' => [], 'presidential_agenda_item_ids' => []])
            ->assertOk()->assertJsonPath('data.pdp_chapters', [])->assertJsonPath('data.presidential_agenda_items', []);
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 0);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 0);
        $clearedAt = $this->objective->fresh()->getRawOriginal('updated_at');
        $this->travel(1)->minutes();
        $this->putJson($this->endpoint(), $this->payload())->assertOk()
            ->assertJsonCount(1, 'data.pdp_chapters')->assertJsonCount(1, 'data.presidential_agenda_items');
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 1);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 1);
        $this->assertNotEquals($clearedAt, $this->objective->fresh()->getRawOriginal('updated_at'));
    }

    public static function invalidPayloads(): array
    {
        $cases = StrategicObjectiveAlignmentWriteTest::invalidPayloads();
        unset($cases['empty lists']);
        foreach (['pdp_chapter_ids', 'presidential_agenda_item_ids'] as $field) {
            $cases[$field.' duplicates'] = [[$field => [1, 1]], $field.'.1'];
        }
        foreach (['objective_id', 'strategic_plan_id', 'created_by', 'updated_by'] as $field) {
            $cases[$field.' prohibited'] = [['pdp_chapter_ids' => [], $field => 999999], $field];
        }

        return $cases;
    }

    #[DataProvider('invalidPayloads')]
    public function test_invalid_update_does_not_change_any_mapping(array $payload, string $error): void
    {
        $before = $this->snapshot();
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), $payload)->assertUnprocessable()->assertJsonValidationErrors($error);
        $this->assertUnchanged($before);
    }

    public static function referenceFields(): array
    {
        return StrategicObjectiveAlignmentWriteTest::mappingFields();
    }

    #[DataProvider('referenceFields')]
    public function test_missing_reference_preserves_both_frameworks_and_reports_original_input_index(string $field): void
    {
        $before = $this->snapshot();
        $payload = $this->payload();
        $payload['pdp_chapter_ids'] = [$this->createChapter()->chapter_id];
        $payload[$field] = [$this->payload()[$field][0], 999999];
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), $payload)->assertUnprocessable()->assertJsonValidationErrors($field.'.1');
        $this->assertUnchanged($before);
    }

    public function test_inactive_existing_agenda_can_be_retained_or_removed_but_cannot_be_added(): void
    {
        $this->agenda->update(['status' => 'inactive']);
        $inactive = $this->createAgenda();
        $inactive->update(['status' => 'inactive']);
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), [
            'pdp_chapter_ids' => [$this->createChapter()->chapter_id],
            'presidential_agenda_item_ids' => [$this->agenda->agenda_id],
        ])->assertOk()->assertJsonPath('data.presidential_agenda_items.0.status', 'inactive');
        $before = $this->snapshot();
        $this->putJson($this->endpoint(), [
            'pdp_chapter_ids' => [],
            'presidential_agenda_item_ids' => [$this->agenda->agenda_id, $inactive->agenda_id],
        ])->assertUnprocessable()->assertJsonValidationErrors('presidential_agenda_item_ids.1');
        $this->assertEquals($before, $this->snapshot());
        $this->putJson($this->endpoint(), ['presidential_agenda_item_ids' => []])->assertOk();
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 0);
    }

    public static function unauthorizedActors(): array
    {
        return [...StrategicObjectiveAlignmentWriteTest::unauthorizedActors(), ['locked', 401], ['expired', 401], ['revoked-sid', 401]];
    }

    #[DataProvider('unauthorizedActors')]
    public function test_update_requires_permission_and_valid_authentication(string $actor, int $status): void
    {
        $before = $this->snapshot();
        if ($actor === 'viewer') {
            $this->officer->update(['role_id' => Role::where('role_name', 'Viewer')->sole()->role_id]);
        } elseif ($actor === 'no-role') {
            $this->officer->update(['role_id' => null]);
        } elseif ($actor === 'no-update-permission') {
            $permission = $this->officer->role->permissions()->where('code', 'strategic_objectives.update')->sole();
            $this->officer->role->permissions()->detach($permission->permission_id);
        }
        if ($actor !== 'guest') {
            $this->authenticateApiUser($this->officer);
        }
        if ($actor === 'inactive') {
            $this->officer->update(['status' => 'inactive']);
        } elseif ($actor === 'revoked-session') {
            $this->officer->increment('auth_version');
        } elseif ($actor === 'locked') {
            $this->officer->update(['locked_until' => now()->addHour()]);
        } elseif ($actor === 'expired') {
            AuthSession::query()->update(['expires_at' => now()->subMinute()]);
        } elseif ($actor === 'revoked-sid') {
            AuthSession::query()->update(['revoked_at' => now()]);
        }
        $this->putJson($this->endpoint(), ['pdp_chapter_ids' => []])->assertStatus($status);
        $this->assertUnchanged($before);
    }

    public function test_update_applies_plan_scope_authorization(): void
    {
        $before = $this->snapshot();
        $this->mock(StrategicPlanAuthorizationService::class, function ($mock): void {
            $mock->shouldReceive('ensurePlanIsWithinAuthorizedScope')->once()
                ->withArgs(fn (Strategic $plan, User $user) => $plan->is($this->plan) && $user->is($this->officer))
                ->andThrow(new AuthorizationException('Outside authorized plan scope.'));
        });
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), ['pdp_chapter_ids' => []])->assertForbidden();
        $this->assertUnchanged($before);
    }

    public static function unavailableObjectives(): array
    {
        return [...StrategicObjectiveAlignmentWriteTest::unavailableObjectives(), ['nonnumeric', 404]];
    }

    #[DataProvider('unavailableObjectives')]
    public function test_unavailable_targets_cannot_have_mappings_changed(string $case, int $status): void
    {
        $model = str_ends_with($case, '-plan') ? $this->plan : $this->objective;
        if (str_starts_with($case, 'deleted-')) {
            $model->update(['status' => 'deleted', 'deleted_at' => now()]);
        } elseif (str_starts_with($case, 'archived-')) {
            $metadata = $case === 'archived-objective' ? ['status_before_archive' => $model->status] : [];
            $model->update([...$metadata, 'status' => 'archived', 'archived_at' => now(), 'archived_by' => $this->officer->user_id]);
        }
        $before = $this->snapshot();
        $url = match ($case) {
            'missing' => '/api/strategic-objectives/999999/alignments',
            'nonnumeric' => '/api/strategic-objectives/invalid/alignments',
            default => $this->endpoint(),
        };
        $this->authenticateApiUser($this->officer);
        $this->putJson($url, ['pdp_chapter_ids' => []])->assertStatus($status);
        $this->assertUnchanged($before);
    }

    public function test_published_objective_accepts_mapping_changes(): void
    {
        $this->objective->update(['status' => 'published', 'objective_description' => 'Description',
            'expected_outcome' => 'Outcome', 'target' => 'Target', 'responsible_office_agency' => 'Planning Office']);
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), ['pdp_chapter_ids' => []])->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 0);
    }

    public function test_audit_failure_rolls_back_additions_removals_and_objective_metadata(): void
    {
        $before = $this->snapshot();
        $this->authenticateApiUser($this->officer);
        $this->mock(StrategicLogWriter::class, function ($mock): void {
            $mock->shouldReceive('write')->once()->andThrow(new RuntimeException('Audit unavailable.'));
        });
        $this->withoutExceptionHandling();
        try {
            $this->putJson($this->endpoint(), [
                'pdp_chapter_ids' => [$this->createChapter()->chapter_id],
                'presidential_agenda_item_ids' => [],
            ]);
            $this->fail('The audit failure should propagate.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Audit unavailable.', $exception->getMessage());
        }
        $this->assertUnchanged($before);
    }

    public function test_database_duplicate_conflict_rolls_back_changes_to_both_frameworks(): void
    {
        $before = $this->snapshot();
        $added = $this->createAgenda();
        $injected = false;
        $prefix = 'insert into '.DB::connection()->getQueryGrammar()->wrapTable('tblobjective_presidential_agenda');
        DB::connection()->beforeExecuting(function (string $query) use (&$injected, $prefix, $added): void {
            if (! $injected && str_starts_with($query, $prefix)) {
                $injected = true;
                $this->objective->presidentialAgendaItems()->attach($added->agenda_id);
            }
        });
        $this->authenticateApiUser($this->officer);
        $this->putJson($this->endpoint(), [
            'pdp_chapter_ids' => [$this->createChapter()->chapter_id],
            'presidential_agenda_item_ids' => [$added->agenda_id],
        ])->assertUnprocessable()->assertJsonValidationErrors('presidential_agenda_item_ids');
        $this->assertTrue($injected);
        $this->assertUnchanged($before);
    }

    private function snapshot(): array
    {
        return [
            'objective' => $this->objective->fresh()->getAttributes(),
            'tblobjective_pdp_chapter' => DB::table('tblobjective_pdp_chapter')->orderBy('objective_id')->orderBy('chapter_id')->get()->all(),
            'tblobjective_presidential_agenda' => DB::table('tblobjective_presidential_agenda')->orderBy('objective_id')->orderBy('agenda_id')->get()->all(),
        ];
    }

    private function assertUnchanged(array $before): void
    {
        $this->assertEquals($before, $this->snapshot());
        $this->assertSame(0, Log::where('operation', 'strategic_objective.alignments_updated')->count());
    }

    private function endpoint(): string
    {
        return '/api/strategic-objectives/'.$this->objective->objective_id.'/alignments';
    }

    private function payload(): array
    {
        return ['pdp_chapter_ids' => [$this->chapter->chapter_id], 'presidential_agenda_item_ids' => [$this->agenda->agenda_id]];
    }

    private function createPlan(): Strategic
    {
        return app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'finished'], $this->officer);
    }

    private function createChapter(): PdpChapter
    {
        return PdpChapter::create(['chapter_title' => 'Chapter', 'chapter_description' => 'Description', 'created_by' => $this->officer->user_id]);
    }

    private function createAgenda(): PresidentialAgendaItem
    {
        return PresidentialAgendaItem::create(['code' => fake()->unique()->bothify('PA-????-####'), 'title' => 'Agenda',
            'description' => 'Description', 'status' => 'active', 'created_by' => $this->officer->user_id]);
    }
}
