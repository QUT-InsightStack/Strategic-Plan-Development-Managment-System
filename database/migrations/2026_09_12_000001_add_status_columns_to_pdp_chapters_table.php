<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->enum('status', ['active', 'archived'])
                ->default('active')
                ->after('chapter_description');
            $table->timestamp('archived_at')->nullable()->after('status');
            $table->unsignedBigInteger('archived_by')->nullable()->after('archived_at');

            $table->foreign('archived_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('tblpdp_chapters', function (Blueprint $table): void {
            $table->dropForeign(['archived_by']);
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'archived_at', 'archived_by']);
        });
    }
};