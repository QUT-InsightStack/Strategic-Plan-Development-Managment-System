<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePresidentialAgendaItemRequest;
use App\Http\Requests\UpdatePresidentialAgendaItemRequest;
use App\Repositories\PresidentialAgendaItemRepository;
use App\Services\PresidentialAgendaItemService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PresidentialAgendaItemController extends Controller
{
    public function __construct(
        private readonly PresidentialAgendaItemRepository $items,
        private readonly PresidentialAgendaItemService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => [
                'nullable',
                'string',
                Rule::in(['active', 'inactive', 'archived', 'all']),
            ],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $page = $this->items->paginate($filters);

        return response()->json([
            'success' => true,
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function store(StorePresidentialAgendaItemRequest $request): JsonResponse
    {
        $item = $this->service->create(
            $request->validated(),
            (int) Auth::guard('api')->id()
        );

        return response()->json([
            'success' => true,
            'message' => 'Presidential Agenda item created successfully.',
            'data' => $item,
        ], 201);
    }

    public function show(int $agendaItem): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->items->findVisibleOrFail($agendaItem),
        ]);
    }

    public function update(
        UpdatePresidentialAgendaItemRequest $request,
        int $agendaItem
    ): JsonResponse {
        $item = $this->service->update(
            $agendaItem,
            $request->validated(),
            (int) Auth::guard('api')->id()
        );

        return response()->json([
            'success' => true,
            'message' => 'Presidential Agenda item updated successfully.',
            'data' => $item,
        ]);
    }

    public function archive(int $agendaItem): JsonResponse
    {
        $item = $this->service->archive(
            $agendaItem,
            (int) Auth::guard('api')->id()
        );

        return response()->json([
            'success' => true,
            'message' => 'Presidential Agenda item archived successfully.',
            'data' => $item,
        ]);
    }

    public function delete(int $agendaItem): JsonResponse
    {
        $item = $this->service->delete(
            $agendaItem,
            (int) Auth::guard('api')->id()
        );

        return response()->json([
            'success' => true,
            'message' => 'Presidential Agenda item deleted successfully.',
            'data' => $item,
        ]);
    }
}