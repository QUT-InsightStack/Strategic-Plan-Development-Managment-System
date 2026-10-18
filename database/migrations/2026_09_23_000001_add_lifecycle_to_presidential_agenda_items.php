<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;


return new class extends Migration
{
    public function up(): void
    {
        // Preserve the existing "inactive" state used by agenda alignments.
        DB::statement(
            "ALTER TABLE `tblpresidential_agenda_items`
             MODIFY `status` ENUM('active', 'inactive', 'archived', 'deleted')
             NOT NULL DEFAULT 'active'"
        );

        Schema::table('tblpresidential_agenda_items', function (Blueprint $table): void {
            $table->timestamp('archived_at')->nullable()->index();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('deleted_at')->nullable()->index();
            $table->unsignedBigInteger('deleted_by')->nullable();

            $table->foreign('archived_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->foreign('deleted_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->index('status');
        });
    }

    public function down(): void
    {
        if (DB::table('tblpresidential_agenda_items')
            ->whereIn('status', ['archived', 'deleted'])
            ->exists()) {
            throw new RuntimeException(
                'Cannot roll back Presidential Agenda lifecycle columns while archived or deleted items exist.'
            );
        }

        Schema::table('tblpresidential_agenda_items', function (Blueprint $table): void {
            $table->dropForeign(['archived_by']);
            $table->dropForeign(['deleted_by']);

            $table->dropIndex(['archived_at']);
            $table->dropIndex(['deleted_at']);
            $table->dropIndex(['status']);

            $table->dropColumn([
                'archived_at',
                'archived_by',
                'deleted_at',
                'deleted_by',
            ]);
        });

        DB::statement(
            "ALTER TABLE `tblpresidential_agenda_items`
             MODIFY `status` ENUM('active', 'inactive')
             NOT NULL DEFAULT 'active'"
        );
    }
};