<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->enum('status', ['active', 'archived', 'deleted'])
                ->default('active')
                ->after('chapter_description');
        });

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->unsignedBigInteger('archived_by')->nullable()->after('archived_at');
        });

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->timestamp('deleted_at')->nullable()->after('archived_by');
        });

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->unsignedBigInteger('deleted_by')->nullable()->after('deleted_at');
        });

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->foreign('archived_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->foreign('deleted_by')->references('user_id')->on('tblusers')->nullOnDelete();
            $table->index('status');
            $table->index('deleted_at');
        });

        DB::table('tblpdp_chapters')
            ->whereNotNull('archived_at')
            ->update(['status' => 'archived']);
    }

    public function down(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->dropForeign(['archived_by']);
            $table->dropForeign(['deleted_by']);
        });

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->dropIndex(['status']);
            $table->dropIndex(['deleted_at']);
            $table->dropColumn(['status', 'archived_by', 'deleted_at', 'deleted_by']);
        });
    }
};