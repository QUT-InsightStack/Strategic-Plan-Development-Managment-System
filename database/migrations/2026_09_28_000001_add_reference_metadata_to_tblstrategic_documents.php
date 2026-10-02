<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblstrategic_documents', function (Blueprint $table): void {
            $table->string('reference_level', 32)->nullable()->after('sha256');
            $table->string('content_category', 64)->nullable()->after('reference_level');
        });
    }

    public function down(): void
    {
        Schema::table('tblstrategic_documents', function (Blueprint $table): void {
            $table->dropColumn(['reference_level', 'content_category']);
        });
    }
};
