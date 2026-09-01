<?php

namespace Tests\Feature;

use Tests\TestCase;

class UserManagementTest extends TestCase
{
    public function test_user_management_page_is_available(): void
    {
        $this->get('/user-management')
            ->assertOk()
            ->assertSee('User Management');
    }

    public function test_user_management_apis_require_authentication(): void
    {
        $this->getJson('/api/users/search')->assertUnauthorized();
        $this->getJson('/api/roles')->assertUnauthorized();
        $this->postJson('/api/users', [])->assertUnauthorized();
        $this->putJson('/api/users/1', ['status' => 'inactive'])
            ->assertUnauthorized();
        $this->patchJson('/api/users/1/status', ['status' => 'inactive'])
            ->assertUnauthorized();
    }
}
