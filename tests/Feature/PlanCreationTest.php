<?php

namespace Tests\Feature;

use Tests\TestCase;

class PlanCreationTest extends TestCase
{
    public function test_plan_interface_routes_are_available(): void
    {
        $this->get('/strategic-plans')->assertOk();
        $this->get('/strategic-plans/create')->assertOk();
        $this->get('/strategic-plans/1/edit')->assertOk();
        $this->get('/strategic-plans/1/objectives')->assertOk();
        $this->get('/strategic-objectives')->assertOk();
    }

    public function test_plan_creation_requires_authentication(): void
    {
        $response = $this->postJson('/api/strategic-plans', [
            'title' => 'Sample strategic plan',
            'level' => 'strategic_plan',
            'mission' => 'Sample mission',
            'vision' => 'Sample vision',
            'core_values' => ['Integrity'],
        ]);

        $response->assertUnauthorized();
    }

    public function test_plan_listing_requires_authentication(): void
    {
        $this->getJson('/api/strategic-plans')->assertUnauthorized();
    }

    public function test_plan_details_require_authentication(): void
    {
        $this->getJson('/api/strategic-plans/1')->assertUnauthorized();
    }

    public function test_plan_update_requires_authentication(): void
    {
        $this->putJson('/api/strategic-plans/1', [])->assertUnauthorized();
    }

    public function test_plan_deletion_requires_authentication(): void
    {
        $this->deleteJson('/api/strategic-plans/1')->assertUnauthorized();
    }

    public function test_plan_copy_requires_authentication(): void
    {
        $this->postJson('/api/strategic-plans/1/copy')->assertUnauthorized();
    }

    public function test_plan_status_update_requires_authentication(): void
    {
        $this->patchJson('/api/strategic-plans/1/status', ['status' => 'archived'])->assertUnauthorized();
    }

    public function test_objective_routes_require_authentication(): void
    {
        $this->getJson('/api/strategic-objectives')->assertUnauthorized();
        $this->getJson('/api/strategic-plans/1/objectives')->assertUnauthorized();
        $this->postJson('/api/strategic-objectives', [])->assertUnauthorized();
        $this->putJson('/api/strategic-objectives/1', [])->assertUnauthorized();
        $this->deleteJson('/api/strategic-objectives/1')->assertUnauthorized();
    }
}
