<?php

namespace App\Http\Requests;

class UploadProfilePhotoRequest extends ApiFormRequest
{
    /**
     * Anyone signed in may change their own photo. The account is taken from
     * the token in the controller, so there is nothing here to authorise
     * beyond being authenticated, which ApiFormRequest already checks.
     */
    protected function requiredPermissions(): array
    {
        return [];
    }

    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                // `image` reads the file with getimagesize(), so a script
                // renamed to .jpg is rejected regardless of what the client
                // claims the type is.
                'image',
                'mimes:jpeg,jpg,png,webp',
                'max:2048',
                'dimensions:min_width=32,min_height=32,max_width=4000,max_height=4000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.required' => 'Choose an image to upload.',
            'photo.image' => 'That file is not an image.',
            'photo.mimes' => 'Use a JPG, PNG or WebP image.',
            'photo.max' => 'The image must be 2 MB or smaller.',
            'photo.dimensions' => 'The image must be between 32 and 4000 pixels on each side.',
        ];
    }

    public function attributes(): array
    {
        return ['photo' => 'photo'];
    }
}
