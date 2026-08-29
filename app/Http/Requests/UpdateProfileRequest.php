<?php

namespace App\Http\Requests;

use App\Validation\UserValidationRules;
use App\Validation\ValidationAttributes;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * Self-service profile update.
 *
 * Any authenticated user may update their own profile, so no permission is
 * required beyond authentication. The user is always taken from the token
 * rather than from request input, which is what prevents one user editing
 * another's profile through this endpoint.
 *
 * Fields fall into two groups:
 *
 *  - Self-service: name, contact details and designation.
 *  - Restricted: role, status, password and organisational placement
 *    (department, unit, office, position). These are administrator-controlled
 *    and are rejected outright rather than silently ignored, so a caller
 *    attempting to change them receives a 422 instead of a false success.
 */
class UpdateProfileRequest extends ApiFormRequest
{
    /**
     * Fields an administrator controls, which must never be settable here.
     */
    public const RESTRICTED_FIELDS = [
        'role_id',
        'status',
        'password',
        'user_id',
        'auth_version',
        'department',
        'unit',
        'office',
        'position',
        'email_verified_at',
        // The photo is a file, not a string. It has its own endpoint that
        // stores it on disk and writes back a path; sending an image here
        // never worked, because the column is far too small to hold one.
        'profile_picture',
    ];

    public function rules(): array
    {
        $userId = Auth::guard('api')->id();

        $rules = [
            'first_name'      => ['sometimes', 'string', 'max:255'],
            'last_name'       => ['sometimes', 'nullable', 'string', 'max:255'],
            'email'           => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('tblusers', 'email')->ignore($userId, 'user_id'),
            ],
            'mobile'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'address'         => ['sometimes', 'nullable', 'string', 'max:255'],
            'gender'          => UserValidationRules::genderOptional(),
            'date_of_birth'   => ['sometimes', 'nullable', 'date', 'before:today'],
            'designation'     => ['sometimes', 'nullable', 'string', 'max:255'],
        ];

        // 'missing' fails validation when the key is present at all, which is
        // what makes an attempt to change a restricted field an explicit error.
        foreach (self::RESTRICTED_FIELDS as $field) {
            $rules[$field] = ['missing'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'role_id.missing'    => 'Roles cannot be changed from your profile.',
            'status.missing'     => 'Account status cannot be changed from your profile.',
            'password.missing'   => 'Use the change password page to update your password.',
            'department.missing' => 'Department is maintained by an administrator.',
            'unit.missing'       => 'Unit is maintained by an administrator.',
            'office.missing'     => 'Office is maintained by an administrator.',
            'position.missing'   => 'Position is maintained by an administrator.',
            'profile_picture.missing' => 'Use the photo upload to change your picture.',
            'user_id.missing'    => 'You can only update your own profile.',
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all() + ['designation' => 'designation'];
    }
}
