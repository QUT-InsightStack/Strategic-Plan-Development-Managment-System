<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TRIGGER = 'trg_strategic_record_before_update';

    public function up(): void
    {
        $this->replaceCondition(
            "/IF\\s+OLD\\.status\\s*<>\\s*'finished'\\s+THEN/i",
            "IF OLD.status NOT IN ('finished', 'archived') THEN"
        );
    }

    public function down(): void
    {
        $this->replaceCondition(
            "/IF\\s+OLD\\.status\\s+NOT\\s+IN\\s*\\(\\s*'finished'\\s*,\\s*'archived'\\s*\\)\\s+THEN/i",
            "IF OLD.status <> 'finished' THEN"
        );
    }

    private function replaceCondition(string $pattern, string $replacement): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        $trigger = DB::selectOne(
            'SELECT ACTION_STATEMENT AS trigger_body FROM information_schema.TRIGGERS '
            .'WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?',
            [self::TRIGGER]
        );
        if (! $trigger) {
            throw new RuntimeException('The strategic plan update trigger is missing.');
        }

        $original = (string) $trigger->trigger_body;
        if (preg_match_all($pattern, $original) !== 1) {
            throw new RuntimeException('The strategic plan update trigger has an unexpected definition.');
        }

        $updated = preg_replace($pattern, $replacement, $original, 1);
        DB::unprepared('DROP TRIGGER `'.self::TRIGGER.'`');
        try {
            DB::unprepared('CREATE TRIGGER `'.self::TRIGGER.'` BEFORE UPDATE ON `tblstrategic_record` FOR EACH ROW '.$updated);
        } catch (Throwable $exception) {
            DB::unprepared('CREATE TRIGGER `'.self::TRIGGER.'` BEFORE UPDATE ON `tblstrategic_record` FOR EACH ROW '.$original);
            throw $exception;
        }
    }
};
