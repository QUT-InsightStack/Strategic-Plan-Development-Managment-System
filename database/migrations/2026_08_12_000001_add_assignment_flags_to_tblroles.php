<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblroles', function (Blueprint $table): void {
            // Unknown roles start unavailable for assignment and protected.
            $table->boolean('is_assignable')
                ->default(false)
                ->after('description');

            $table->boolean('is_protected')
                ->default(true)
                ->after('is_assignable');
        });

        // Classify the currently seeded roles explicitly.
        DB::table('tblroles')
            ->whereIn('role_name', [
                'Planning Officer',
                'Division Head',
                'Viewer',
            ])
            ->update([
                'is_assignable' => true,
                'is_protected' => false,
            ]);

        DB::table('tblroles')
            ->where('role_name', 'Administrator')
            ->update([
                'is_assignable' => true,
                'is_protected' => true,
            ]);
    }

    public function down(): void
    {
        Schema::table('tblroles', function (Blueprint $table): void {
            $table->dropColumn([
                'is_assignable',
                'is_protected',
            ]);
        });
    }
};