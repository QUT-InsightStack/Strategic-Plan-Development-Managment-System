<?php

namespace App\Http\Controllers;

use App\Services\UserService;

class UserController extends BaseCrudController
{
    protected $userService;

    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }

    protected function getService()
    {
        return $this->userService;
    }
}
