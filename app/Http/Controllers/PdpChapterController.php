<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Http\Requests\StorePdpChapterRequest;
use App\Http\Requests\UpdatePdpChapterRequest;
use App\Http\Requests\UpdatePdpChapterStatusRequest;
use App\Models\PdpChapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PdpChapterController extends Controller
{
    public function __construct(
        private readonly StrategicLogWriter $auditWriter
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(['active', 'archived', 'all'])],
        ]);

        $status = $filters['status'] ?? 'active';

        $chapters = PdpChapter::query()
            ->notDeleted()
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
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

            return PdpChapter::create($data);
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

    public function updateStatus(UpdatePdpChapterStatusRequest $request, PdpChapter $chapter): JsonResponse
    {
        $status = $request->validated('status');

        $chapter = DB::transaction(function () use ($status, $chapter): PdpChapter {
            $locked = PdpChapter::query()
                ->lockForUpdate()
                ->findOrFail($chapter->chapter_id);

            if ($status === 'archived') {
                if ($locked->status === 'archived') {
                    throw ValidationException::withMessages([
                        'status' => ['This chapter is already archived.'],
                    ]);
                }

                $locked->status = 'archived';
                $locked->archived_at = now();
                $locked->archived_by = Auth::guard('api')->id();
            } else {
                if ($locked->status !== 'archived') {
                    throw ValidationException::withMessages([
                        'status' => ['Only archived chapters can be restored.'],
                    ]);
                }

                $locked->status = 'active';
                $locked->archived_at = null;
                $locked->archived_by = null;
            }

            $locked->updated_by = Auth::guard('api')->id();
            $locked->save();

            $this->auditWriter->write(
                $status === 'archived' ? 'pdp_chapter.archived' : 'pdp_chapter.restored',
                [
                    'actor_user_id' => Auth::guard('api')->id(),
                    'resource_type' => 'pdp_chapter',
                    'resource_id' => $locked->chapter_id,
                ]
            );

            return $locked->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => $status === 'archived'
                ? 'PDP Chapter archived successfully.'
                : 'PDP Chapter restored successfully.',
            'data' => $chapter,
        ]);
    }

    public function destroy(PdpChapter $chapter): JsonResponse
    {
        $chapter = DB::transaction(function () use ($chapter): PdpChapter {
            $locked = PdpChapter::query()
                ->lockForUpdate()
                ->findOrFail($chapter->chapter_id);

            if ($locked->status === 'deleted') {
                throw ValidationException::withMessages([
                    'status' => ['This chapter has already been deleted.'],
                ]);
            }

            if ($locked->status !== 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['Only archived chapters can be permanently deleted.'],
                ]);
            }

            $locked->status = 'deleted';
            $locked->deleted_at = now();
            $locked->deleted_by = Auth::guard('api')->id();
            $locked->save();

            $this->auditWriter->write('pdp_chapter.deleted', [
                'actor_user_id' => Auth::guard('api')->id(),
                'resource_type' => 'pdp_chapter',
                'resource_id' => $locked->chapter_id,
            ]);

            return $locked->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'PDP Chapter deleted successfully.',
            'data' => $chapter,
        ]);
    }
}