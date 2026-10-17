<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\StrategicDocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StrategicDocumentAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    public function test_planner_default_list_contains_only_own_plan_documents(): void
    {
        $owner = $this->account('Planning Officer');
        $other = $this->account('Planning Officer');

        $plan = $this->plan($owner);
        $ownDocument = $this->document($plan, $owner);
        $otherDocument = $this->document($this->plan($other), $other);

        $this->authenticateApiUser($owner);

        $response = $this->getJson('/api/strategic-documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.document_id', $ownDocument->document_id)
            ->assertJsonPath('data.0.strategic_plan_id', $plan->record_id)
            ->assertJsonPath('data.0.plan.title', $plan->title)
            ->assertJsonPath('data.0.uploader.name', 'Document Tester');

        $this->assertNotContains(
            $otherDocument->document_id,
            array_column($response->json('data'), 'document_id'),
        );
    }

    public function test_plan_filter_and_pagination_preserve_planner_scope(): void
    {
        $owner = $this->account('Planning Officer');
        $other = $this->account('Planning Officer');

        $first = $this->plan($owner);
        $second = $this->plan($owner);
        $outside = $this->plan($other);

        $firstDocument = $this->document($first, $owner);
        $this->document($second, $owner);
        $this->document($outside, $other);

        $this->authenticateApiUser($owner);

        $this->getJson('/api/strategic-documents?plan_id='.$first->record_id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.document_id', $firstDocument->document_id);

        $this->getJson('/api/strategic-documents?per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.last_page', 2);

        $this->getJson('/api/strategic-documents?plan_id='.$outside->record_id)
            ->assertForbidden();
    }

    public function test_another_planner_cannot_list_or_download_plan_documents(): void
    {
        $owner = $this->account('Planning Officer');
        $other = $this->account('Planning Officer');

        $plan = $this->plan($owner);
        $document = $this->document($plan, $owner);

        $this->authenticateApiUser($other);

        $this->getJson('/api/strategic-plans/'.$plan->record_id.'/documents')
            ->assertForbidden();

        $this->getJson('/api/strategic-documents/'.$document->document_id.'/download')
            ->assertForbidden();
    }

    public function test_administrative_admin_can_list_and_download_across_creators(): void
    {
        $first = $this->account('Planning Officer');
        $second = $this->account('Planning Officer');
        $admin = $this->account('Administrative Admin');

        $document = $this->document($this->plan($first), $first);
        $this->document($this->plan($second), $second);

        $this->authenticateApiUser($admin);

        $this->getJson('/api/strategic-documents')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);

        $this->get('/api/strategic-documents/'.$document->document_id.'/download')
            ->assertOk()
            ->assertDownload('reference.pdf');
    }

    public function test_download_permission_is_required_even_for_the_plan_owner(): void
    {
        $owner = $this->account('Planning Officer');
        $document = $this->document($this->plan($owner), $owner);

        $permission = Permission::where('code', 'strategic_documents.download')
            ->firstOrFail();

        $owner->role->permissions()->detach($permission->permission_id);

        $this->authenticateApiUser($owner->fresh());

        $this->getJson('/api/strategic-documents')
            ->assertOk();

        $this->getJson('/api/strategic-documents/'.$document->document_id.'/download')
            ->assertForbidden();
    }

    public function test_document_listing_requires_authentication(): void
    {
        $this->getJson('/api/strategic-documents')
            ->assertUnauthorized();
    }

    private function account(string $roleName): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName]);

        foreach ([
            'strategic_records.view',
            'strategic_documents.view',
            'strategic_documents.download',
        ] as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], [
                'permission_name' => $code,
                'module' => explode('.', $code)[0],
            ]);

            $role->permissions()->syncWithoutDetaching([
                $permission->permission_id,
            ]);
        }

        return User::create([
            'first_name' => 'Document',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => 'DocumentTestPassword123!',
            'role_id' => $role->role_id,
            'status' => 'active',
            'office' => 'Research Office',
        ])->fresh();
    }

    private function plan(User $creator): Strategic
    {
        return app(PlanCreationService::class)->create([
            'title' => 'Document access plan',
            'level' => 'strategic_plan',
            'mission' => 'Research',
            'vision' => 'Better services',
            'core_values' => ['Integrity'],
            'status' => 'draft',
        ], $creator);
    }

    private function document(Strategic $plan, User $uploader): StrategicDocument
    {
        return app(StrategicDocumentService::class)->store(
            UploadedFile::fake()->create('reference.pdf', 10, 'application/pdf'),
            $uploader,
            'strategic_plan_id',
            $plan->record_id,
            'PDP',
            'Supporting Evidence',
        );
    }
}