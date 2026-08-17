<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblusers', function (Blueprint $table): void {
            $table->unsignedBigInteger('auth_version')
                ->default(1)
                ->after('role_id');
        });
    }

    public function down(): void
    {
        Schema::table('tblusers', function (Blueprint $table): void {
            $table->dropColumn('auth_version');
        });
    }
};