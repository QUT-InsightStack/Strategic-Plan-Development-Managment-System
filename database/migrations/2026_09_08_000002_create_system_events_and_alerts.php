<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblsystem_events', function (Blueprint $table) {
            $table->id();
            $table->string('event', 100);
            $table->string('source', 40);
            $table->string('severity', 16);
            $table->string('outcome', 16);
            $table->uuid('request_id')->nullable()->index();
            $table->json('context')->nullable();
            $table->timestamp('occurred_at');
            $table->index(['occurred_at', 'id'], 'system_events_time');
            $table->index(['severity', 'occurred_at', 'id'], 'system_events_severity_time');
            $table->index(['source', 'occurred_at', 'id'], 'system_events_source_time');
            $table->index(['event', 'occurred_at'], 'system_events_event_time');
        });
        Schema::create('tblsystem_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('condition', 100);
            // NULL on resolution permits a new episode while preserving history.
            $table->string('active_key', 100)->nullable()->unique();
            $table->string('severity', 16);
            $table->string('status', 16);
            $table->unsignedInteger('occurrences')->default(1);
            $table->timestamp('opened_at');
            $table->timestamp('last_seen_at');
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('opening_notified_at')->nullable();
            $table->timestamp('recovery_notified_at')->nullable();
            $table->index(['status', 'opened_at']);
        });
        Schema::create('tblsystem_metrics', function (Blueprint $table) {
            $table->id();
            $table->timestamp('bucket_at')->unique();
            $table->boolean('finalized')->default(false);
            $table->unsignedBigInteger('requests');
            $table->unsignedBigInteger('server_errors');
            $table->unsignedBigInteger('client_errors');
            $table->double('duration_ms');
            $table->double('max_duration_ms');
            $table->double('db_duration_ms');
            $table->unsignedBigInteger('db_queries');
        });
        Schema::create('tblaudit_archives', function (Blueprint $table) {
            $table->id();
            $table->string('source', 40);
            $table->unsignedBigInteger('original_id');
            $table->json('record');
            $table->timestamp('occurred_at');
            $table->timestamp('archived_at');
            $table->unique(['source', 'original_id']);
            $table->index(['source', 'occurred_at']);
        });
    }

    public function down(): void
    {
        // Archived audits cannot be recreated reliably after users have been deleted.
        if (DB::table('tblaudit_archives')->exists()) {
            throw new RuntimeException('Export and restore archived audits before rolling back monitoring storage.');
        }
        Schema::dropIfExists('tblaudit_archives');
        Schema::dropIfExists('tblsystem_metrics');
        Schema::dropIfExists('tblsystem_alerts');
        Schema::dropIfExists('tblsystem_events');
    }
};
