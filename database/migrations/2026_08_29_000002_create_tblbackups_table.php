<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record of manually triggered database backups.
 *
 * The dump files themselves live in storage/app/backups, outside the
 * document root. This table holds only the metadata needed to list them and
 * to attribute each one to the administrator who asked for it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tblbackups', function (Blueprint $table): void {
            $table->id('backup_id');

            // Generated server-side; never taken from user input.
            $table->string('filename', 255)->unique();

            $table->unsignedBigInteger('size_bytes')->nullable();

            // The database driver the dump was taken from, so a restore is
            // not attempted with the wrong tool.
            $table->string('driver', 32);

            $table->enum('status', ['completed', 'failed'])->default('completed');

            // Truncated, credential-stripped failure reason. Null on success.
            $table->text('error_message')->nullable();

            // Kept even if the account is later removed, so the audit trail
            // does not lose the backup itself.
            $table->unsignedBigInteger('created_by')->nullable();

            $table->timestamps();

            $table->foreign('created_by')
                ->references('user_id')
                ->on('tblusers')
                ->nullOnDelete();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tblbackups');
    }
};
