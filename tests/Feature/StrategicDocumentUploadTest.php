<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Models\User;
use App\Services\PlanCreationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StrategicDocumentUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_office_can_upload_reference_files_with_their_category_metadata(): void
    {
        Storage::fake('local');
        $role = Role::firstOrCreate(['role_name' => 'Office/Agency']);
        $user = User::create([
            'first_name' => 'Office', 'last_name' => 'Uploader', 'email' => fake()->unique()->safeEmail(),
            'password' => 'password', 'role_id' => $role->role_id, 'status' => 'active', 'office' => 'Research Office',
        ]);
        $permissionIds = collect(['strategic_documents.upload', 'strategic_records.view'])->map(function (string $code): int {
            return Permission::firstOrCreate(['code' => $code], [
                'permission_name' => $code, 'module' => 'strategic_documents',
            ])->permission_id;
        });
        $role->permissions()->syncWithoutDetaching($permissionIds);
        $plan = app(PlanCreationService::class)->create([
            'title' => 'Office Plan', 'level' => 'strategic_plan', 'mission' => 'Research',
            'vision' => 'Better services', 'core_values' => ['Integrity'], 'status' => 'draft',
        ], $user);
        $this->authenticateApiUser($user);

        $response = $this->post('/api/strategic-plans/'.$plan->record_id.'/documents', [
            'document' => UploadedFile::fake()->create('reference.mp4', 100, 'video/mp4'),
            'reference_level' => 'PDP',
            'content_category' => 'Supporting Evidence',
        ], ['Accept' => 'application/json']);

        $response->assertCreated()->assertJsonPath('data.reference_level', 'PDP')
            ->assertJsonPath('data.content_category', 'Supporting Evidence');
        $document = StrategicDocument::query()->firstOrFail();
        Storage::disk('local')->assertExists($document->stored_path);
    }
}
