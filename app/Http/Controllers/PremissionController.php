<?php

namespace App\Http\Controllers;

use App\Services\PermissionService;

class PermissionController extends BaseCrudController
{
    protected $permissionService;

    public function __construct(PermissionService $permissionService)
    {
        $this->permissionService = $permissionService;
    }

    protected function getService()
    {
        return $this->permissionService;
    }
}