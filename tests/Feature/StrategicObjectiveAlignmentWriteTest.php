<?php

namespace Tests\Feature;

use App\Contracts\StrategicLogWriter;
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
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class StrategicObjectiveAlignmentWriteTest extends TestCase
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

        config(['jwt.secret' => str_repeat('alignment-write-test-secret', 4)]);
        $this->seed([PermissionSeeder::class, RolesSeeder::class, RolePermissionSeeder::class]);
        $this->officer = User::create([
            'first_name' => 'Planning',
            'last_name' => 'Officer',
            'email' => 'alignment-writer@example.com',
            'password' => Hash::make('password'),
            'status' => 'active',
            'role_id' => Role::where('role_name', 'Planning Officer')->firstOrFail()->role_id,
        ])->refresh();
        $this->plan = app(PlanCreationService::class)->create([
            'level' => 'strategic_plan',
            'title' => 'National planning alignment',
            'mission' => 'Improve services',
            'vision' => 'Accessible services',
            'core_values' => ['Integrity'],
            'status' => 'finished',
        ], $this->officer);
        $this->objective = StrategicObjective::create([
            'strategic_plan_id' => $this->plan->record_id,
            'created_by' => $this->officer->user_id,
            'objective_title' => 'Improve service delivery',
            'status' => 'draft',
        ]);
        $this->chapter = $this->createChapter();
        $this->agenda = $this->createAgenda();
    }

    public function test_officer_can_add_multiple_mappings_preserving_existing_links_and_other_objectives(): void
    {
        $existingChapter = $this->createChapter();
        $existingAgenda = $this->createAgenda();
        $this->objective->pdpChapters()->attach($existingChapter->chapter_id);
        $this->objective->presidentialAgendaItems()->attach($existingAgenda->agenda_id);
        $otherObjective = $this->objective->replicate();
        $otherObjective->save();
        $otherObjective->pdpChapters()->attach($this->chapter->chapter_id);
        $otherObjective->presidentialAgendaItems()->attach($this->agenda->agenda_id);
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $payload = [
            'pdp_chapter_ids' => [$chapter->chapter_id, $this->chapter->chapter_id],
            'presidential_agenda_item_ids' => [$agenda->agenda_id, $this->agenda->agenda_id],
        ];
        $this->authenticateOfficer();

        $response = $this->postJson($this->endpoint(), $payload)->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.objective_id', $this->objective->objective_id)
            ->assertJsonPath('data.updated_by', $this->officer->user_id)
            ->assertJsonPath('data.created_by', $this->officer->user_id)
            ->assertJsonPath('data.objective_title', $this->objective->objective_title)
            ->assertJsonCount(3, 'data.pdp_chapters')
            ->assertJsonCount(3, 'data.presidential_agenda_items');

        foreach ([
            ['tblobjective_pdp_chapter', 'chapter_id', $payload['pdp_chapter_ids']],
            ['tblobjective_presidential_agenda', 'agenda_id', $payload['presidential_agenda_item_ids']],
        ] as [$table, $key, $ids]) {
            foreach ($ids as $id) {
                $this->assertDatabaseHas($table, ['objective_id' => $this->objective->objective_id, $key => $id]);
            }
            $this->assertDatabaseCount($table, 4);
            $this->assertSame(0, DB::table($table)->whereNull('created_at')->orWhereNull('updated_at')->count());
        }
        $this->getJson('/api/strategic-objectives/'.$this->objective->objective_id)->assertOk()
            ->assertJsonPath('data.pdp_chapters', $response->json('data.pdp_chapters'))
            ->assertJsonPath('data.presidential_agenda_items', $response->json('data.presidential_agenda_items'));
        $log = Log::where('operation', 'strategic_objective.alignments_created')->sole();
        $this->assertSame($this->officer->user_id, $log->user_id);
        $this->assertSame('strategic_objective', $log->resource_type);
        $this->assertSame($this->objective->objective_id, $log->resource_id);
        $this->assertSame($payload['pdp_chapter_ids'], $log->metadata['pdp_chapter_ids']);
        $this->assertSame($payload['presidential_agenda_item_ids'], $log->metadata['presidential_agenda_item_ids']);
    }

    public static function independentMappings(): array
    {
        return [
            'one chapter' => ['pdp_chapter_ids', 1, false],
            'multiple chapters' => ['pdp_chapter_ids', 2, false],
            'chapter with empty agenda list' => ['pdp_chapter_ids', 1, true],
            'one agenda' => ['presidential_agenda_item_ids', 1, false],
            'multiple agendas' => ['presidential_agenda_item_ids', 2, false],
            'agenda with empty chapter list' => ['presidential_agenda_item_ids', 1, true],
        ];
    }

    #[DataProvider('independentMappings')]
    public function test_either_framework_can_be_mapped_independently(string $field, int $count, bool $emptyOther): void
    {
        $payload = $this->payload();
        $otherField = $field === 'pdp_chapter_ids' ? 'presidential_agenda_item_ids' : 'pdp_chapter_ids';
        unset($payload[$otherField]);
        if ($emptyOther) {
            $payload[$otherField] = [];
        }
        if ($count === 2) {
            $payload[$field][] = $field === 'pdp_chapter_ids'
                ? $this->createChapter()->chapter_id : $this->createAgenda()->agenda_id;
        }
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $payload)->assertCreated();
        $this->assertDatabaseCount('tblobjective_pdp_chapter', $field === 'pdp_chapter_ids' ? $count : 0);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', $field === 'presidential_agenda_item_ids' ? $count : 0);
    }

    public static function mappingFields(): array
    {
        return [['pdp_chapter_ids'], ['presidential_agenda_item_ids']];
    }

    #[DataProvider('mappingFields')]
    public function test_repeated_ids_in_one_request_are_rejected(string $field): void
    {
        $payload = $this->payload();
        $payload[$field][] = $payload[$field][0];
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $payload)->assertUnprocessable()
            ->assertJsonValidationErrors(["{$field}.0", "{$field}.1"]);
        $this->assertNoMappings();
    }

    #[DataProvider('mappingFields')]
    public function test_existing_mapping_rejects_entire_batch_without_changing_saved_mappings(string $field): void
    {
        $this->authenticateOfficer();
        $payload = $this->payload();
        $this->postJson($this->endpoint(), [$field => $payload[$field]])->assertCreated();
        $before = $this->objective->fresh()->getAttributes();
        $table = $field === 'pdp_chapter_ids' ? 'tblobjective_pdp_chapter' : 'tblobjective_presidential_agenda';
        $pivotBefore = DB::table($table)->first();

        $this->postJson($this->endpoint(), $payload)->assertUnprocessable()
            ->assertJsonPath('success', false)->assertJsonValidationErrors(["{$field}.0"]);

        $this->assertDatabaseCount('tblobjective_pdp_chapter', $field === 'pdp_chapter_ids' ? 1 : 0);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', $field === 'presidential_agenda_item_ids' ? 1 : 0);
        $this->assertEquals($pivotBefore, DB::table($table)->first());
        $this->assertSame($before, $this->objective->fresh()->getAttributes());
        $this->assertSame(1, Log::where('operation', 'strategic_objective.alignments_created')->count());
    }

    public static function invalidPayloads(): array
    {
        $cases = [
            'missing lists' => [[], 'pdp_chapter_ids'],
            'empty lists' => [['pdp_chapter_ids' => [], 'presidential_agenda_item_ids' => []], 'pdp_chapter_ids'],
        ];
        foreach (['pdp_chapter_ids', 'presidential_agenda_item_ids'] as $field) {
            foreach ([null, '1', ['named' => 1], range(1, 101), (object) [], (object) ['0' => 1]] as $index => $value) {
                $cases["{$field} invalid list {$index}"] = [[$field => $value], $field];
            }
            foreach ([0, -1, 1.5, true, null, 'invalid', '1', [1]] as $index => $value) {
                $cases["{$field} invalid ID {$index}"] = [[$field => [$value]], "{$field}.0"];
            }
        }

        return $cases;
    }

    #[DataProvider('invalidPayloads')]
    public function test_malformed_mapping_requests_are_rejected(array $payload, string $error): void
    {
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $payload)->assertUnprocessable()->assertJsonValidationErrors($error);
        $this->assertNoMappings();
    }

    #[DataProvider('mappingFields')]
    public function test_missing_references_reject_the_entire_batch(string $field): void
    {
        $payload = $this->payload();
        $payload[$field][] = 999999;
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $payload)->assertUnprocessable()->assertJsonValidationErrors("{$field}.1");
        $this->assertNoMappings();
    }

    public function test_inactive_agenda_rejects_the_entire_batch(): void
    {
        $this->agenda->update(['status' => 'inactive']);
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $this->payload())->assertUnprocessable()
            ->assertJsonValidationErrors('presidential_agenda_item_ids.0');
        $this->assertNoMappings();
    }

    public function test_client_cannot_override_target_or_audit_fields(): void
    {
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), array_merge($this->payload(), [
            'objective_id' => 999999,
            'strategic_plan_id' => 999999,
            'created_by' => 999999,
            'updated_by' => 999999,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['objective_id', 'strategic_plan_id', 'created_by', 'updated_by']);
        $this->assertNoMappings();
    }

    public static function unauthorizedActors(): array
    {
        return [['guest', 401], ['viewer', 403], ['no-role', 403], ['no-update-permission', 403], ['inactive', 401], ['revoked-session', 401]];
    }

    #[DataProvider('unauthorizedActors')]
    public function test_mapping_creation_requires_authentication_and_update_permission(string $actor, int $status): void
    {
        if ($actor === 'viewer') {
            $this->officer->update(['role_id' => Role::where('role_name', 'Office')->firstOrFail()->role_id]);
        } elseif ($actor === 'no-role') {
            $this->officer->update(['role_id' => null]);
        } elseif ($actor === 'no-update-permission') {
            $permission = $this->officer->role->permissions()->where('code', 'strategic_objectives.update')->firstOrFail();
            $this->officer->role->permissions()->detach($permission->permission_id);
        }
        if ($actor !== 'guest') {
            $this->authenticateOfficer();
        }
        if ($actor === 'inactive') {
            $this->officer->update(['status' => 'inactive']);
        } elseif ($actor === 'revoked-session') {
            $this->officer->increment('auth_version');
        }

        $this->postJson($this->endpoint(), $this->payload())->assertStatus($status);
        $this->assertNoMappings();
    }

    public function test_mapping_creation_applies_plan_scope_authorization(): void
    {
        $this->mock(StrategicPlanAuthorizationService::class, function ($mock): void {
            $mock->shouldReceive('ensurePlanIsWithinAuthorizedScope')->once()
                ->withArgs(fn (Strategic $plan, User $user, string $message) => $plan->is($this->plan) && $user->is($this->officer))
                ->andThrow(new AuthorizationException('Outside authorized plan scope.'));
        });
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $this->payload())->assertForbidden();
        $this->assertNoMappings();
    }

    public static function unavailableObjectives(): array
    {
        return [['missing', 404], ['deleted-objective', 404], ['deleted-plan', 404], ['archived-objective', 422], ['archived-plan', 422]];
    }

    #[DataProvider('unavailableObjectives')]
    public function test_mapping_creation_rejects_unavailable_objectives_and_plans(string $case, int $status): void
    {
        if (str_starts_with($case, 'deleted-')) {
            $model = $case === 'deleted-plan' ? $this->plan : $this->objective;
            $model->update(['status' => 'deleted', 'deleted_at' => now()]);
        } elseif (str_starts_with($case, 'archived-')) {
            $model = $case === 'archived-plan' ? $this->plan : $this->objective;
            $metadata = $case === 'archived-objective' ? ['status_before_archive' => $model->status] : [];
            $model->update([...$metadata, 'status' => 'archived', 'archived_at' => now(), 'archived_by' => $this->officer->user_id]);
        }
        $this->authenticateOfficer();
        $url = $case === 'missing' ? '/api/strategic-objectives/999999/alignments' : $this->endpoint();
        $this->postJson($url, $this->payload())->assertStatus($status);
        $this->assertNoMappings();
    }

    public function test_database_duplicate_conflict_returns_validation_error_and_rolls_back(): void
    {
        // Insert a conflicting pair after the duplicate check to exercise the database guard.
        $injected = false;
        $insertPrefix = 'insert into '.DB::connection()->getQueryGrammar()->wrapTable('tblobjective_presidential_agenda');
        DB::connection()->beforeExecuting(function (string $query) use (&$injected, $insertPrefix): void {
            if (! $injected && str_starts_with($query, $insertPrefix)) {
                $injected = true;
                $this->objective->presidentialAgendaItems()->attach($this->agenda->agenda_id);
            }
        });
        $this->authenticateOfficer();
        $this->postJson($this->endpoint(), $this->payload())->assertUnprocessable()
            ->assertJsonValidationErrors('presidential_agenda_item_ids');
        $this->assertTrue($injected);
        $this->assertNoMappings();
    }

    public function test_failure_after_mapping_inserts_rolls_back_mappings_and_objective_metadata(): void
    {
        $before = $this->objective->fresh()->getAttributes();
        $this->mock(StrategicLogWriter::class, function ($mock): void {
            $mock->shouldReceive('write')->once()->andThrow(new RuntimeException('Audit storage unavailable.'));
        });
        $this->authenticateOfficer();
        $this->withoutExceptionHandling();

        try {
            $this->postJson($this->endpoint(), $this->payload());
            $this->fail('The simulated storage failure should propagate.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Audit storage unavailable.', $exception->getMessage());
        }

        $this->assertNoMappings();
        $this->assertSame($before, $this->objective->fresh()->getAttributes());
    }

    private function authenticateOfficer(): void
    {
        $this->authenticateApiUser($this->officer);
    }

    private function endpoint(): string
    {
        return '/api/strategic-objectives/'.$this->objective->objective_id.'/alignments';
    }

    private function payload(): array
    {
        return [
            'pdp_chapter_ids' => [$this->chapter->chapter_id],
            'presidential_agenda_item_ids' => [$this->agenda->agenda_id],
        ];
    }

    private function assertNoMappings(): void
    {
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 0);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 0);
        $this->assertSame(0, Log::where('operation', 'strategic_objective.alignments_created')->count());
    }

    private function createChapter(): PdpChapter
    {
        return PdpChapter::create([
            'chapter_title' => fake()->unique()->sentence(),
            'chapter_description' => 'PDP Chapter description',
            'created_by' => $this->officer->user_id,
        ]);
    }

    private function createAgenda(): PresidentialAgendaItem
    {
        return PresidentialAgendaItem::create([
            'code' => fake()->unique()->bothify('PA-####'),
            'title' => 'Presidential Agenda item',
            'description' => 'Agenda description',
            'status' => 'active',
            'created_by' => $this->officer->user_id,
        ]);
    }
}
