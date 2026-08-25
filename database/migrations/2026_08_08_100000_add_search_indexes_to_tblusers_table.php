<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes supporting user search.
 *
 * Search filters on first_name, last_name and status, and sorts on those
 * plus created_at.
 *
 * Deliberately not indexed here:
 *  - email   already covered by its unique constraint
 *  - role_id MySQL creates an index automatically for the foreign key, so
 *            adding one would be redundant
 *
 * Note: a leading-wildcard LIKE ('%term%') cannot use a B-tree index, so
 * these principally benefit the status filter and sorting. If the table
 * grows large enough for name matching to become the bottleneck, a FULLTEXT
 * index is the next step.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblusers', function (Blueprint $table) {
            $table->index('first_name', 'tblusers_first_name_index');
            $table->index('last_name', 'tblusers_last_name_index');
            $table->index('status', 'tblusers_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('tblusers', function (Blueprint $table) {
            $table->dropIndex('tblusers_first_name_index');
            $table->dropIndex('tblusers_last_name_index');
            $table->dropIndex('tblusers_status_index');
        });
    }
};
