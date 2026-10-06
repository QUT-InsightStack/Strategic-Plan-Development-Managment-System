<?php

namespace Tests\Feature;

use App\Models\PdpChapter;
use App\Models\PresidentialAgendaItem;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StrategicObjectiveAlignmentTest extends TestCase
{
    use RefreshDatabase;

    private User $officer;

    private Strategic $plan;

    private StrategicObjective $objective;

    protected function setUp(): void
    {
        parent::setUp();

        config(['jwt.secret' => str_repeat('alignment-test-secret', 4)]);
        $this->seed([PermissionSeeder::class, RolesSeeder::class, RolePermissionSeeder::class]);

        $this->officer = User::create([
            'first_name' => 'Planning',
            'last_name' => 'Officer',
            'email' => 'alignment-officer@example.com',
            'password' => Hash::make('password'),
            'status' => 'active',
            'role_id' => Role::where('role_name', 'Planning Officer')->firstOrFail()->role_id,
        ])->refresh();
        $this->plan = $this->createPlan();
        $this->objective = $this->createObjective($this->plan);
    }

    public static function readEndpoints(): array
    {
        return [['index'], ['by-plan'], ['show']];
    }

    #[DataProvider('readEndpoints')]
    public function test_planning_officer_receives_exact_mappings_from_both_tables(string $endpoint): void
    {
        $chapters = [$this->createChapter(), $this->createChapter()];
        $agendas = [$this->createAgenda(), $this->createAgenda(['status' => 'inactive'])];
        // Insert in reverse order to check stable ordering independently of insertion order.
        foreach ([1, 0] as $index) {
            $this->link($this->objective, $chapters[$index], $agendas[$index]);
        }

        $otherObjective = $this->createObjective($this->createPlan());
        $this->link($otherObjective, $this->createChapter(), $this->createAgenda());
        $this->authenticateOfficer();

        $response = $this->getJson($this->endpoint($endpoint))->assertOk()->assertJsonPath('success', true);
        $path = $endpoint === 'show' ? 'data' : 'data.0';
        $response->assertJsonPath("{$path}.objective_id", $this->objective->objective_id)
            ->assertJsonPath("{$path}.strategic_plan.record_id", $this->plan->record_id)
            ->assertJsonCount(2, "{$path}.pdp_chapters")
            ->assertJsonCount(2, "{$path}.presidential_agenda_items");

        foreach ([0, 1] as $index) {
            $chapter = $chapters[$index];
            $agenda = $agendas[$index];
            $response->assertJsonPath("{$path}.pdp_chapters.{$index}.chapter_id", $chapter->chapter_id)
                ->assertJsonPath("{$path}.pdp_chapters.{$index}.chapter_title", $chapter->chapter_title)
                ->assertJsonPath("{$path}.pdp_chapters.{$index}.chapter_description", $chapter->chapter_description)
                ->assertJsonPath("{$path}.pdp_chapters.{$index}.pivot.objective_id", $this->objective->objective_id)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.agenda_id", $agenda->agenda_id)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.code", $agenda->code)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.title", $agenda->title)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.description", $agenda->description)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.status", $agenda->status)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.effective_date", '2026-01-01')
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.note", $agenda->note)
                ->assertJsonPath("{$path}.presidential_agenda_items.{$index}.pivot.objective_id", $this->objective->objective_id);
        }

        $this->assertDatabaseCount('tblobjective_pdp_chapter', 3);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 3);
    }

    #[DataProvider('readEndpoints')]
    public function test_objectives_without_mappings_return_empty_arrays(string $endpoint): void
    {
        $this->authenticateOfficer();
        $path = $endpoint === 'show' ? 'data' : 'data.0';

        $this->getJson($this->endpoint($endpoint))->assertOk()
            ->assertJsonPath("{$path}.pdp_chapters", [])
            ->assertJsonPath("{$path}.presidential_agenda_items", []);
    }

    public function test_independent_and_shared_mappings_survive_objective_pagination(): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $chapterOnly = $this->createObjective($this->plan);
        $chapterOnly->pdpChapters()->attach($chapter->chapter_id);
        $agendaOnly = $this->createObjective($this->plan);
        $agendaOnly->presidentialAgendaItems()->attach($agenda->agenda_id);
        $unmapped = $this->createObjective($this->plan);
        StrategicObjective::query()->update(['updated_at' => '2026-01-01 00:00:00']);
        $this->authenticateOfficer();

        $expected = [
            [$unmapped, [], []],
            [$agendaOnly, [], [$agenda->agenda_id]],
            [$chapterOnly, [$chapter->chapter_id], []],
            [$this->objective, [$chapter->chapter_id], [$agenda->agenda_id]],
        ];
        foreach ($expected as $index => [$objective, $chapterIds, $agendaIds]) {
            $page = $index + 1;
            $response = $this->getJson("/api/strategic-objectives?per_page=1&page={$page}")->assertOk()
                ->assertJsonPath('meta.total', 4)
                ->assertJsonPath('meta.last_page', 4)
                ->assertJsonPath('data.0.objective_id', $objective->objective_id);
            $this->assertSame($chapterIds, array_column($response->json('data.0.pdp_chapters'), 'chapter_id'));
            $this->assertSame($agendaIds, array_column($response->json('data.0.presidential_agenda_items'), 'agenda_id'));
        }

        $this->assertEqualsCanonicalizing(
            [$this->objective->objective_id, $chapterOnly->objective_id],
            $chapter->strategicObjectives()->pluck('tblstrategic_objectives.objective_id')->all()
        );
        $this->assertEqualsCanonicalizing(
            [$this->objective->objective_id, $agendaOnly->objective_id],
            $agenda->strategicObjectives()->pluck('tblstrategic_objectives.objective_id')->all()
        );
    }

    public function test_reads_reflect_reference_updates_and_mapping_removals(): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $this->authenticateOfficer();
        $this->getJson($this->endpoint('show'))->assertOk()->assertJsonCount(1, 'data.pdp_chapters');

        $chapter->update(['chapter_title' => 'Revised chapter', 'chapter_description' => 'Revised chapter details']);
        $agenda->update(['title' => 'Revised agenda', 'description' => 'Revised agenda details']);
        $this->getJson($this->endpoint('show'))->assertOk()
            ->assertJsonPath('data.pdp_chapters.0.chapter_title', 'Revised chapter')
            ->assertJsonPath('data.pdp_chapters.0.chapter_description', 'Revised chapter details')
            ->assertJsonPath('data.presidential_agenda_items.0.title', 'Revised agenda')
            ->assertJsonPath('data.presidential_agenda_items.0.description', 'Revised agenda details');

        DB::table('tblobjective_pdp_chapter')->where('objective_id', $this->objective->objective_id)->delete();
        DB::table('tblobjective_presidential_agenda')->where('objective_id', $this->objective->objective_id)->delete();
        $this->getJson($this->endpoint('show'))->assertOk()
            ->assertJsonPath('data.pdp_chapters', [])
            ->assertJsonPath('data.presidential_agenda_items', []);
    }

    public function test_archived_mappings_remain_visible_but_deleted_objectives_and_plans_do_not(): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $this->authenticateOfficer();

        // Objective archiving is independent of the parent plan's lifecycle.
        $this->objective->update(['status' => 'archived', 'status_before_archive' => 'draft',
            'archived_at' => now(), 'archived_by' => $this->officer->user_id]);
        $this->patchJson("/api/strategic-plans/{$this->plan->record_id}/status", ['status' => 'archived'])->assertOk();
        foreach (['index', 'by-plan', 'show'] as $endpoint) {
            $path = $endpoint === 'show' ? 'data' : 'data.0';
            $this->getJson($this->endpoint($endpoint))->assertOk()
                ->assertJsonPath("{$path}.status", 'archived')
                ->assertJsonCount(1, "{$path}.pdp_chapters")
                ->assertJsonCount(1, "{$path}.presidential_agenda_items");
        }

        $this->objective->update(['status' => 'deleted', 'deleted_at' => now(), 'archived_at' => null, 'archived_by' => null, 'status_before_archive' => null]);
        $this->getJson($this->endpoint('show'))->assertNotFound();
        $this->getJson($this->endpoint('index'))->assertOk()->assertJsonPath('data', []);
        $this->getJson($this->endpoint('by-plan'))->assertOk()->assertJsonPath('data', []);

        $otherPlan = $this->createPlan();
        $otherObjective = $this->createObjective($otherPlan);
        $this->link($otherObjective, $chapter, $agenda);
        $otherPlan->update(['status' => 'deleted', 'deleted_at' => now()]);
        $this->getJson("/api/strategic-objectives/{$otherObjective->objective_id}")->assertNotFound();
        $this->getJson("/api/strategic-plans/{$otherPlan->record_id}/objectives")->assertNotFound();
        $this->getJson('/api/strategic-objectives')->assertOk()->assertJsonPath('data', []);
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 2);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 2);
    }

    #[DataProvider('readEndpoints')]
    public function test_mapping_reads_require_authentication_and_view_permission(string $endpoint): void
    {
        $this->getJson($this->endpoint($endpoint))->assertUnauthorized();
        $this->officer->update(['role_id' => null]);
        $this->authenticateOfficer();
        $this->getJson($this->endpoint($endpoint))->assertForbidden();
    }

    public function test_missing_objective_and_plan_return_not_found(): void
    {
        $this->authenticateOfficer();
        $this->getJson('/api/strategic-objectives/999999')->assertNotFound();
        $this->getJson('/api/strategic-plans/999999/objectives')->assertNotFound();
    }

    public function test_listing_loads_each_mapping_table_once_for_multiple_objectives(): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $this->link($this->createObjective($this->plan), $chapter, $agenda);
        $this->authenticateOfficer();

        DB::enableQueryLog();
        try {
            $this->getJson($this->endpoint('by-plan'))->assertOk()->assertJsonCount(2, 'data');
            $queries = collect(DB::getQueryLog())->pluck('query');
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }

        foreach (['tblobjective_pdp_chapter', 'tblobjective_presidential_agenda'] as $table) {
            $this->assertCount(1, $queries->filter(fn (string $sql) => str_contains($sql, $table)));
        }
    }

    public static function invalidMappings(): array
    {
        return [
            ['tblobjective_pdp_chapter', 'chapter_id', 'duplicate'],
            ['tblobjective_presidential_agenda', 'agenda_id', 'duplicate'],
            ['tblobjective_pdp_chapter', 'chapter_id', 'missing-objective'],
            ['tblobjective_presidential_agenda', 'agenda_id', 'missing-objective'],
            ['tblobjective_pdp_chapter', 'chapter_id', 'missing-reference'],
            ['tblobjective_presidential_agenda', 'agenda_id', 'missing-reference'],
        ];
    }

    #[DataProvider('invalidMappings')]
    public function test_database_rejects_duplicate_and_orphaned_mappings(string $table, string $referenceKey, string $case): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $referenceId = $referenceKey === 'chapter_id' ? $chapter->chapter_id : $agenda->agenda_id;

        $this->expectException(QueryException::class);
        DB::table($table)->insert([
            'objective_id' => $case === 'missing-objective' ? 999999 : $this->objective->objective_id,
            $referenceKey => $case === 'missing-reference' ? 999999 : $referenceId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_hard_deletion_cleans_up_mappings_without_deleting_other_records(): void
    {
        $chapter = $this->createChapter();
        $agenda = $this->createAgenda();
        $this->link($this->objective, $chapter, $agenda);
        $other = $this->createObjective($this->plan);
        $this->link($other, $chapter, $agenda);

        $this->objective->delete();
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 1);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 1);
        $this->assertNotNull($chapter->fresh());
        $this->assertNotNull($agenda->fresh());

        $chapter->delete();
        $agenda->delete();
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 0);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 0);
        $this->assertNotNull($other->fresh());
    }

    public function test_alignment_migration_can_be_rolled_back_and_reapplied(): void
    {
        // MySQL DDL commits implicitly; use committed fixtures and rebuild afterwards.
        DB::commit();
        RefreshDatabaseState::$migrated = false;
        $migration = require database_path('migrations/2026_09_08_000001_create_strategic_objective_alignment_tables.php');
        $migration->down();
        foreach (['tblobjective_pdp_chapter', 'tblobjective_presidential_agenda', 'tblpresidential_agenda_items'] as $table) {
            $this->assertFalse(Schema::hasTable($table));
        }
        $this->assertTrue(Schema::hasTable('tblpdp_chapters'));
        $this->assertNotNull($this->objective->fresh());

        $migration->up();
        $this->link($this->objective, $this->createChapter(), $this->createAgenda());
        $this->assertDatabaseCount('tblobjective_pdp_chapter', 1);
        $this->assertDatabaseCount('tblobjective_presidential_agenda', 1);
    }

    private function authenticateOfficer(): void
    {
        $this->authenticateApiUser($this->officer);
    }

    private function endpoint(string $endpoint): string
    {
        return match ($endpoint) {
            'index' => "/api/strategic-objectives?plan_id={$this->plan->record_id}",
            'by-plan' => "/api/strategic-plans/{$this->plan->record_id}/objectives",
            'show' => "/api/strategic-objectives/{$this->objective->objective_id}",
        };
    }

    private function createPlan(): Strategic
    {
        return app(PlanCreationService::class)->create([
            'level' => 'strategic_plan',
            'title' => 'Alignment plan',
            'description' => 'Verify national planning alignment',
            'mission' => 'Improve services',
            'vision' => 'Accessible services',
            'core_values' => ['Integrity'],
            'status' => 'finished',
        ], $this->officer);
    }

    private function createObjective(Strategic $plan): StrategicObjective
    {
        return StrategicObjective::create([
            'strategic_plan_id' => $plan->record_id,
            'created_by' => $this->officer->user_id,
            'objective_title' => 'Improve service delivery',
            'status' => 'draft',
        ]);
    }

    private function createChapter(): PdpChapter
    {
        return PdpChapter::create([
            'chapter_title' => fake()->unique()->sentence(),
            'chapter_description' => str_repeat('Chapter description. ', 100),
            'created_by' => $this->officer->user_id,
        ]);
    }

    private function createAgenda(array $overrides = []): PresidentialAgendaItem
    {
        $agenda = (new PresidentialAgendaItem)->forceFill(array_merge([
            'code' => fake()->unique()->bothify('PA-####'),
            'title' => fake()->unique()->sentence(),
            'description' => 'Agenda description',
            'status' => 'active',
            'effective_date' => '2026-01-01',
            'note' => 'Reference note',
            'created_by' => $this->officer->user_id,
        ], $overrides));
        $agenda->save();
        return $agenda->refresh();
    }

    private function link(StrategicObjective $objective, PdpChapter $chapter, PresidentialAgendaItem $agenda): void
    {
        DB::table('tblobjective_pdp_chapter')->insert([
            'objective_id' => $objective->objective_id,
            'chapter_id' => $chapter->chapter_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('tblobjective_presidential_agenda')->insert([
            'objective_id' => $objective->objective_id,
            'agenda_id' => $agenda->agenda_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
