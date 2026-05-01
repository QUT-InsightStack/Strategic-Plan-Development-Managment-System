<?php

namespace App\Http\Controllers;

use App\Services\RoleService;

class RoleController extends BaseCrudController
{
    protected $roleService;

    public function __construct(RoleService $roleService)
    {
        $this->roleService = $roleService;
    }

    protected function getService()
    {
        return $this->roleService;
    }
}