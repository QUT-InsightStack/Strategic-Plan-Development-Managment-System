<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TRIGGER = 'trg_strategic_record_before_update';

    private const DRAFT_CONDITION =
        "IF OLD.status = 'finished' OR (OLD.status = 'archived' AND COALESCE(OLD.status_before_archive, 'finished') <> 'draft') THEN";

    private const ARCHIVE_CONDITION =
        "IF OLD.status NOT IN ('draft', 'finished', 'archived') THEN";

    private function lifecycleRules(): string
    {
        return <<<'SQL'
    /* draft_archive_rules_start */
    IF NEW.status = 'archived' THEN
        IF OLD.status IN ('draft', 'finished') THEN
            IF OLD.approval_status = 'under_approval' THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Plans under approval cannot be archived.';
            END IF;
            SET NEW.status_before_archive = OLD.status;
        ELSEIF OLD.status = 'archived' THEN
            IF NOT (NEW.status_before_archive <=> OLD.status_before_archive) THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|The original archive status cannot be changed.';
            END IF;
        END IF;
    ELSEIF OLD.status = 'archived' AND NEW.status IN ('draft', 'finished') THEN
        IF NEW.status <> COALESCE(OLD.status_before_archive, 'finished') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Restore the plan to its status before archival.';
        END IF;
        SET NEW.status_before_archive = NULL;
    ELSE
        SET NEW.status_before_archive = NULL;
    END IF;
    /* draft_archive_rules_end */

SQL;
    }

    public function up(): void
    {
        $this->replaceTrigger(function (string $body): string {
            $body = $this->replaceOnce(
                "/IF\s+OLD\.status\s+IN\s*\(\s*'finished'\s*,\s*'archived'\s*\)\s+THEN/i",
                self::DRAFT_CONDITION,
                $body
            );

            $body = $this->replaceOnce(
                "/IF\s+OLD\.status\s+NOT\s+IN\s*\(\s*'finished'\s*,\s*'archived'\s*\)\s+THEN/i",
                self::ARCHIVE_CONDITION,
                $body
            );

            return $this->replaceOnce(
                '/\ABEGIN\s*/i',
                "BEGIN\n".$this->lifecycleRules(),
                $body
            );
        });
    }

    public function down(): void
    {
        if (DB::table('tblstrategic_record')
            ->where('status', 'archived')
            ->where('status_before_archive', 'draft')
            ->exists()) {
            throw new RuntimeException(
                'Restore archived draft plans before rolling back this migration.'
            );
        }

        $this->replaceTrigger(function (string $body): string {
            $body = $this->replaceOnce(
                '/'.preg_quote(self::DRAFT_CONDITION, '/').'/',
                "IF OLD.status IN ('finished', 'archived') THEN",
                $body
            );

            $body = $this->replaceOnce(
                '/'.preg_quote(self::ARCHIVE_CONDITION, '/').'/',
                "IF OLD.status NOT IN ('finished', 'archived') THEN",
                $body
            );

            return $this->replaceOnce(
                '~/\* draft_archive_rules_start \*/.*?/\* draft_archive_rules_end \*/~s',
                '',
                $body
            );
        });
    }

    private function replaceOnce(
        string $pattern,
        string $replacement,
        string $body
    ): string {
        if (preg_match_all($pattern, $body) !== 1) {
            throw new RuntimeException(
                'The strategic plan update trigger has an unexpected definition.'
            );
        }

        return preg_replace_callback(
            $pattern,
            static fn () => $replacement,
            $body,
            1
        );
    }

    private function replaceTrigger(callable $transform): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        $trigger = DB::selectOne(
            'SELECT ACTION_STATEMENT AS trigger_body '
            .'FROM information_schema.TRIGGERS '
            .'WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?',
            [self::TRIGGER]
        );

        if (! $trigger) {
            throw new RuntimeException(
                'The strategic plan update trigger is missing.'
            );
        }

        $original = (string) $trigger->trigger_body;
        $updated = $transform($original);

        DB::unprepared('DROP TRIGGER `'.self::TRIGGER.'`');

        try {
            DB::unprepared(
                'CREATE TRIGGER `'.self::TRIGGER.'` '
                .'BEFORE UPDATE ON `tblstrategic_record` '
                .'FOR EACH ROW '.$updated
            );
        } catch (Throwable $exception) {
            DB::unprepared(
                'CREATE TRIGGER `'.self::TRIGGER.'` '
                .'BEFORE UPDATE ON `tblstrategic_record` '
                .'FOR EACH ROW '.$original
            );

            throw $exception;
        }
    }
};