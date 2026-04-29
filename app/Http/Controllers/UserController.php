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

    protected function getStoreRules(): array
    {
        return [
            'name'       => ['required', 'string', 'max:255'],
            'email'      => ['required', 'email', 'max:255', 'unique:tblusers,email'],
            'password'   => ['required', 'string', 'min:8'],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'    => ['sometimes', 'nullable', 'integer', 'exists:tblroles,role_id'],
            'status'     => ['sometimes', 'in:active,inactive,suspended'],
        ];
    }


    protected function getUpdateRules(int $id): array
    {
        return [
            'name'       => ['sometimes', 'string', 'max:255'],
            'email'      => ['sometimes', 'email', 'max:255', "unique:tblusers,email,{$id},user_id"],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'    => ['sometimes', 'nullable', 'integer', 'exists:tblroles,role_id'],
            'status'     => ['sometimes', 'in:active,inactive,suspended'],
            'password'   => ['sometimes', 'string', 'min:8'],
        ];
    }



}
