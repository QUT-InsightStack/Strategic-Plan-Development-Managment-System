<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->unsignedBigInteger('responsible_unit_id')
                ->nullable()
                ->change();
        });
    }

    public function down(): void
    {
        if (DB::table('tblimplementation_inputs')
            ->whereNull('responsible_unit_id')
            ->exists()) {
            throw new RuntimeException(
                'Cannot roll back while inputs without Office membership exist.'
            );
        }

        Schema::table('tblimplementation_inputs', function (Blueprint $table) {
            $table->unsignedBigInteger('responsible_unit_id')
                ->nullable(false)
                ->change();
        });
    }
};