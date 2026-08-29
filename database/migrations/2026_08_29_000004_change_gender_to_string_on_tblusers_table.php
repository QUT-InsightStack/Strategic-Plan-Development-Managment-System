<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Change `gender` from a boolean to a short code.
 *
 * A boolean cannot represent gender, and nothing in the application ever
 * defined which value meant what: no mapping constant, no seeder, no screen
 * that read or wrote it. The column was accepted by the API but was not
 * reachable from any interface, so in practice it holds nothing.
 *
 * IMPORTANT: any value that does exist is set to NULL rather than guessed at.
 * Its meaning is genuinely unknown, and inventing one would write incorrect
 * personal data about a real person. Check before running this:
 *
 *     SELECT COUNT(*) FROM tblusers WHERE gender IS NOT NULL;
 *
 * If that returns anything other than zero, decide what those values meant
 * before migrating — this cannot be undone by `down()`.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Cleared while the column is still a boolean, so nothing is left
        // holding a meaningless '0' or '1' that would fail the new rule.
        DB::table('tblusers')->whereNotNull('gender')->update(['gender' => null]);

        Schema::table('tblusers', function (Blueprint $table): void {
            $table->string('gender', 32)->nullable()->change();
        });
    }

    public function down(): void
    {
        // The codes have no boolean equivalent, so anything set since this
        // migration ran is cleared rather than mangled into true/false.
        DB::table('tblusers')->whereNotNull('gender')->update(['gender' => null]);

        Schema::table('tblusers', function (Blueprint $table): void {
            $table->boolean('gender')->nullable()->change();
        });
    }
};
