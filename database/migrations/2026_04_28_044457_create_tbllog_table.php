<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tbllog', function (Blueprint $table) {
            $table->id('log_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('actor_name', 511)->nullable();
            $table->text('operation');
            $table->string('resource_type', 100)->nullable();
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->string('outcome', 30)->default('success');
            $table->string('states')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('user_id', 'tbllog_user_id_audit_foreign')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->index(['created_at', 'log_id'], 'tbllog_created_log_idx');
            $table->index(['user_id', 'created_at'], 'tbllog_user_created_idx');
            // MySQL requires a prefix when indexing a TEXT column.
            $operation = in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)
                ? DB::raw('`operation`(100)') : 'operation';
            $table->index([$operation, 'created_at'], 'tbllog_operation_created_idx');
            $table->index(['resource_type', 'resource_id'], 'tbllog_resource_idx');
            $table->index(['outcome', 'created_at'], 'tbllog_outcome_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tbllog');
    }
};
