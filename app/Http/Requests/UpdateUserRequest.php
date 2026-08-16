<?php

namespace App\Http\Requests;

use App\Validation\ValidationAttributes;
use App\Validation\UserValidationRules;

class UpdateUserRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['users.manage'];
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'first_name'      => UserValidationRules::firstNameOptional(),
            'last_name'       => UserValidationRules::lastNameOptional(),
            'email'           => UserValidationRules::emailForUpdate($userId),
            'password'        => UserValidationRules::passwordOptional(),
            'mobile'          => UserValidationRules::mobileOptional(),
            'address'         => UserValidationRules::addressOptional(),
            'gender'          => UserValidationRules::genderOptional(),
            'date_of_birth'   => UserValidationRules::dateOfBirthOptional(),
            'profile_picture' => UserValidationRules::profilePictureOptional(),
            'department'      => UserValidationRules::departmentOptional(),
            'unit'            => UserValidationRules::unitOptional(),
            'office'          => UserValidationRules::officeOptional(),
            'position'        => UserValidationRules::positionOptional(),
            'role_id'         => UserValidationRules::roleIdOptional(),
            'status'          => UserValidationRules::statusOptional(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
