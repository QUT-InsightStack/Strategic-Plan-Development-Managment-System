<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblsystem_requests', function (Blueprint $table): void {
            $table->id('id');
            $table->uuid('request_id')->unique();
            // Route templates only: never URLs, query strings, headers, or bodies.
            $table->string('route', 255);
            $table->string('method', 16);
            $table->unsignedSmallInteger('status_code');
            $table->double('duration_ms');
            $table->double('db_duration_ms');
            $table->unsignedInteger('db_query_count');
            $table->string('exception_type', 255)->nullable();
            $table->timestamp('occurred_at');
            $table->index(['occurred_at', 'id'], 'system_requests_time_idx');
            $table->index(['status_code', 'occurred_at'], 'system_requests_status_time_idx');
            $table->index(['route', 'occurred_at'], 'system_requests_route_time_idx');
        });

        Schema::create('tblsystem_checks', function (Blueprint $table): void {
            $table->id();
            $table->string('status', 20);
            $table->json('health');
            $table->json('metrics')->nullable();
            $table->json('issues');
            $table->timestamp('checked_at');
            $table->index(['checked_at', 'id'], 'system_checks_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblsystem_checks');
        Schema::dropIfExists('tblsystem_requests');
    }
};
