<?php

namespace App\Validation;

class ValidationAttributes
{
    public static function all(): array
    {
        return [
            'first_name' => 'first name',
            'last_name' => 'last name',
            'email' => 'email address',
            'password' => 'password',
            'current_password' => 'current password',
            'new_password' => 'new password',
            'new_password_confirmation' => 'new password confirmation',
            'token' => 'reset token',
            'mobile' => 'mobile number',
            'address' => 'address',
            'gender' => 'gender',
            'date_of_birth' => 'date of birth',
            'profile_picture' => 'profile picture',
            'department' => 'department',
            'unit' => 'unit',
            'office' => 'office',
            'position' => 'position',
            'role_id' => 'role',
            'status' => 'status',
            'permission_name' => 'permission name',
            'code' => 'permission code',
            'user_id' => 'user',
            'strategic_plan_id' => 'strategic plan',
            'objective_title' => 'objective title',
            'objective_description' => 'objective description',
            'expected_outcome' => 'expected outcome/objective',
            'responsible_office_agency' => 'responsible office/agency',
            'mission_id' => 'mission',
            'vision_id' => 'vision',
            'file_path' => 'file',
        ];
    }
}
