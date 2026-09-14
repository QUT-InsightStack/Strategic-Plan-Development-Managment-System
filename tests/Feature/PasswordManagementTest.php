<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_change_password_requires_authentication(): void
    {
        $this->putJson('/api/change-password', [
            'current_password' => 'password',
            'new_password' => 'NewPassword123!!',
            'new_password_confirmation' => 'NewPassword123!!',
        ])->assertUnauthorized();
    }

    public function test_authenticated_user_can_change_password(): void
    {
       $user = $this->createUser();
        $user->refresh();
        $originalVersion = (int) $user->auth_version;

        $this->actingAs($user, 'api');
        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/change-password', [
                'current_password' => 'password',
                'new_password' => 'NewPassword123!!',
                'new_password_confirmation' => 'NewPassword123!!',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('reauthentication_required', true);

        $user->refresh();

        $this->assertTrue(Hash::check('NewPassword123!!', $user->password));
        $this->assertSame($originalVersion + 1, (int) $user->auth_version);
        $this->assertStringContainsString(
            'auth.password_changed',
            (string) Log::latest('log_id')->value('operation')
        );
        $this->assertEmpty($response->headers->getCookies()[0]->getValue());
    }
    public function test_change_password_rejects_password_shorter_than_sixteen_characters(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/change-password', [
                'current_password' => 'password',
                'new_password' => 'ShortPassword1!',
                'new_password_confirmation' => 'ShortPassword1!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('new_password');

        $user->refresh();

        $this->assertTrue(Hash::check('password', $user->password));
    }
    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/change-password', [
                'current_password' => 'wrong-password',
                'new_password' => 'NewPassword123!!',
                'new_password_confirmation' => 'NewPassword123!!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $user->refresh();
        $this->assertTrue(Hash::check('password', $user->password));
    }

    public function test_forgot_password_creates_reset_token_for_active_user(): void
    {
        Notification::fake();
        $user = $this->createUser(['email' => 'user@example.com']);

        $this->postJson('/api/forgot-password', [
            'email' => $user->email,
        ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => $user->email,
        ]);

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_forgot_password_does_not_reveal_unknown_email(): void
    {
        $this->postJson('/api/forgot-password', [
            'email' => 'missing@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath(
                'message',
                'If an account exists for this email address, password reset instructions will be sent.'
            );

        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => 'missing@example.com',
        ]);
    }

    public function test_reset_password_accepts_valid_token(): void
    {
       $user = $this->createUser(['email' => 'reset@example.com']);
        $user->refresh();
        $originalVersion = (int) $user->auth_version;
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'ResetPassword123!',
            'password_confirmation' => 'ResetPassword123!',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('reauthentication_required', true);

        $user->refresh();

        $this->assertTrue(Hash::check('ResetPassword123!', $user->password));
        $this->assertSame($originalVersion + 1, (int) $user->auth_version);
        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => $user->email,
        ]);
        $this->assertStringContainsString(
            'auth.password_reset',
            (string) Log::latest('log_id')->value('operation')
        );
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        $user = $this->createUser(['email' => 'reset@example.com']);

        $this->postJson('/api/reset-password', [
            'token' => 'invalid-token',
            'email' => $user->email,
            'password' => 'ResetPassword123!',
            'password_confirmation' => 'ResetPassword123!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('token');

        $user->refresh();
        $this->assertTrue(Hash::check('password', $user->password));
    }

    private function createUser(array $attributes = []): User
    {
        return User::create(array_merge([
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
        ], $attributes));
    }
}
