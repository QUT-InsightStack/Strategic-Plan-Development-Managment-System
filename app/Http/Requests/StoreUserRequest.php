<?php

namespace App\Http\Requests;

use App\Validation\ValidationAttributes;
use App\Validation\UserValidationRules;

class StoreUserRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name'      => UserValidationRules::firstNameRequired(),
            'last_name'       => UserValidationRules::lastNameOptional(),
            'email'           => UserValidationRules::emailForCreate(),
            'password'        => UserValidationRules::passwordRequired(),
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
