<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProfilePhotoController extends Controller
{
    public function show(string $filename): BinaryFileResponse
    {
        // Only server-generated public avatars; works without a Windows symlink.
        abort_unless(preg_match('/\A[a-z0-9]{40}\.(?:jpe?g|png|webp)\z/', $filename), 404);
        $path = Storage::disk('public')->path('avatars/'.$filename);
        abort_unless(is_file($path), 404);

        return response()->file($path, ['X-Content-Type-Options' => 'nosniff']);
    }
}
