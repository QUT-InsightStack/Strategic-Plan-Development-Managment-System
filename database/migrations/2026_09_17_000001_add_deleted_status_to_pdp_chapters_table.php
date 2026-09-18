<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE tblpdp_chapters MODIFY status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active'"
        );

        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->timestamp('deleted_at')->nullable()->after('archived_by');
            $table->unsignedBigInteger('deleted_by')->nullable()->after('deleted_at');

            $table->foreign('deleted_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->dropForeign(['deleted_by']);
            $table->dropColumn(['deleted_at', 'deleted_by']);
        });

        DB::statement(
            "ALTER TABLE tblpdp_chapters MODIFY status ENUM('active', 'archived') NOT NULL DEFAULT 'active'"
        );
    }
};