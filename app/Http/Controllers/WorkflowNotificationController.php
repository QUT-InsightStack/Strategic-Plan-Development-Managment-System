<?php

namespace App\Http\Controllers;

use App\Models\WorkflowNotification;
use Illuminate\Http\Request;

class WorkflowNotificationController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $query = WorkflowNotification::where('recipient_id', $request->user('api')->user_id)->where('status', 'sent');
        $unread = (clone $query)->whereNull('read_at')->count();
        $page = $query->orderByDesc('event_id')->orderByDesc('id')->paginate($data['per_page'] ?? 20);

        return response()->json([...$page->toArray(), 'unread_count' => $unread]);
    }

    public function read(Request $request, int $notification)
    {
        $query = WorkflowNotification::whereKey($notification)
            ->where('recipient_id', $request->user('api')->user_id)->where('status', 'sent');
        abort_unless((clone $query)->exists(), 404);
        (clone $query)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['data' => $query->firstOrFail()]);
    }
}
