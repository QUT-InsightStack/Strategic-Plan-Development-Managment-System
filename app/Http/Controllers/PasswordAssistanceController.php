<?php

namespace App\Http\Controllers;

use App\Http\Requests\ForgotPasswordRequest;
use App\Models\PasswordAssistanceRequest;
use App\Services\PasswordAssistanceService;
use App\Services\PasswordPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PasswordAssistanceController extends Controller
{
    public function __construct(
        private readonly PasswordAssistanceService $service,
    ) {}

    public function store(ForgotPasswordRequest $request): JsonResponse
    {
        $this->service->submit($request->validated('email'));

        return response()->json([
            'success' => true,
            'message' => 'If an active account matches this email address, a password assistance request has been submitted to the Technical Administrator.',
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->service->ensureAdministrator(Auth::guard('api')->user());

        $filters = $request->validate([
            'status' => [
                'nullable',
                Rule::in(['pending', 'accepted', 'acted_on', 'ignored']),
            ],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $page = PasswordAssistanceRequest::query()
            ->with(['user', 'acceptedBy', 'handledBy'])
            ->where('status', $filters['status'] ?? 'pending')
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);

        return response()->json([
            'success' => true,
            'data' => collect($page->items())
                ->map(fn ($item) => $this->present($item))
                ->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'pending_count' => PasswordAssistanceRequest::query()
                    ->where('status', 'pending')->count(),
            ],
        ]);
    }
public function show(int $assistanceRequest): JsonResponse
{
    $this->service->ensureAdministrator(Auth::guard('api')->user());

    $item = PasswordAssistanceRequest::query()
        ->findOrFail($assistanceRequest);

    return response()->json([
        'success' => true,
        'data' => $this->present($item),
    ]);
}
    public function accept(int $assistanceRequest): JsonResponse
    {
        $item = $this->service->accept(
            $assistanceRequest,
            Auth::guard('api')->user()
        );

        return response()->json([
            'success' => true,
            'message' => 'Request accepted. Reset the password in User Accounts.',
            'data' => $this->present($item),
        ]);
    }

    public function ignore(int $assistanceRequest): JsonResponse
    {
        $item = $this->service->ignore(
            $assistanceRequest,
            Auth::guard('api')->user()
        );

        return response()->json([
            'success' => true,
            'message' => 'Request ignored.',
            'data' => $this->present($item),
        ]);
    }

    public function reset(
        Request $request,
        int $assistanceRequest
    ): JsonResponse {
        $this->service->ensureAdministrator(Auth::guard('api')->user());

        $data = $request->validate([
            'password' => [
                ...app(PasswordPolicyService::class)->rules(),
                'confirmed',
            ],
            'password_confirmation' => ['required', 'string'],
        ]);

        $item = $this->service->reset(
            $assistanceRequest,
            $data['password'],
            Auth::guard('api')->user()
        );

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. The request is marked as Acted on.',
            'data' => $this->present($item),
        ]);
    }

    private function present(PasswordAssistanceRequest $item): array
    {
        $item->loadMissing(['user', 'acceptedBy', 'handledBy']);

        $name = static fn ($user) => $user
            ? trim($user->first_name.' '.$user->last_name)
            : 'Deleted account';

        return [
            'id' => $item->id,
            'user_id' => $item->user_id,
            'user_name' => $name($item->user),
            'email' => $item->user?->email,
            'status' => $item->status,
            'requested_at' => $item->created_at?->toIso8601String(),
            'accepted_by' => $item->accepted_by,
            'accepted_by_name' => $item->acceptedBy
                ? $name($item->acceptedBy) : null,
            'accepted_at' => $item->accepted_at?->toIso8601String(),
            'handled_by_name' => $item->handledBy
                ? $name($item->handledBy) : null,
            'handled_at' => $item->handled_at?->toIso8601String(),
        ];
    }
}