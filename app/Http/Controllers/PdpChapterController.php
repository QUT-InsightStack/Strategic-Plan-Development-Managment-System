<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePdpChapterRequest;
use App\Http\Requests\UpdatePdpChapterRequest;
use App\Models\PdpChapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PdpChapterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $chapters = PdpChapter::query()
            ->when($filters['search'] ?? null, function ($query, string $search): void {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('chapter_title', 'like', "%{$search}%")
                        ->orWhere('chapter_description', 'like', "%{$search}%");
                });
            })
            ->orderBy('chapter_title')
            ->get();

        return response()->json(['success' => true, 'data' => $chapters]);
    }

    public function store(StorePdpChapterRequest $request): JsonResponse
    {
        $chapter = DB::transaction(function () use ($request): PdpChapter {
            $data = $request->validated();
            $data['created_by'] = Auth::guard('api')->id();

            $chapter = PdpChapter::create($data);
            return $chapter;
        });

        return response()->json([
            'success' => true,
            'message' => 'PDP Chapter created successfully.',
            'data' => $chapter,
        ], 201);
    }

    public function show(PdpChapter $chapter): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $chapter]);
    }

    public function update(UpdatePdpChapterRequest $request, PdpChapter $chapter): JsonResponse
    {
        $chapter = DB::transaction(function () use ($request, $chapter): PdpChapter {
            $data = $request->validated();
            $data['updated_by'] = Auth::guard('api')->id();

            $chapter->update($data);
            return $chapter->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'PDP Chapter updated successfully.',
            'data' => $chapter,
        ]);
    }
}
