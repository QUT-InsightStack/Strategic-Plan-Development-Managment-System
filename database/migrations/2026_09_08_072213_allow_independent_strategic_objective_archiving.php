<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TRIGGER_NAME = 'trg_strategic_objective_before_update';

    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        $this->replaceTrigger(true);
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        $this->replaceTrigger(false);
    }

    private function isMySql(): bool
    {
        return Schema::getConnection()->getDriverName() === 'mysql';
    }

    private function replaceTrigger(bool $allowIndependentArchive): void
    {
        DB::unprepared(
            'DROP TRIGGER IF EXISTS `' . self::TRIGGER_NAME . '`'
        );

        $archivePlanCondition = $allowIndependentArchive
            ? "NOT IN ('draft', 'finished')"
            : "<> 'archived'";

        $archivePlanMessage = $allowIndependentArchive
            ? 'Objectives can only be archived while their parent plan is active.'
            : 'Archived objectives require an archived plan.';

        DB::unprepared(<<<SQL
CREATE TRIGGER `trg_strategic_objective_before_update`
BEFORE UPDATE ON `tblstrategic_objectives`
FOR EACH ROW
BEGIN
    IF OLD.status = 'deleted' AND NEW.status <> 'deleted' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted objectives cannot be restored.';
    END IF;

    IF NEW.status IN ('draft', 'published') THEN
        IF NEW.status_before_archive IS NOT NULL
            OR NEW.archived_at IS NOT NULL
            OR NEW.archived_by IS NOT NULL
            OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active objectives cannot carry archive or delete metadata.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.strategic_plan_id
        ) NOT IN ('draft', 'finished') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|strategic_plan_id|Objectives require a draft or finished plan.';
        END IF;

        IF NEW.status = 'published' AND (
            TRIM(COALESCE(NEW.objective_title, '')) = ''
            OR TRIM(COALESCE(NEW.objective_description, '')) = ''
            OR TRIM(COALESCE(NEW.expected_outcome, '')) = ''
            OR TRIM(COALESCE(NEW.target, '')) = ''
            OR TRIM(COALESCE(NEW.responsible_office_agency, '')) = ''
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Published objectives require all mandatory fields.';
        END IF;

    ELSEIF NEW.status = 'archived' THEN
        IF NEW.status_before_archive IS NULL
            OR NEW.status_before_archive NOT IN ('draft', 'published')
            OR NEW.archived_at IS NULL
            OR NEW.archived_by IS NULL
            OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived objectives require prior status and archived metadata.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.strategic_plan_id
        ) {$archivePlanCondition} THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|strategic_plan_id|{$archivePlanMessage}';
        END IF;

    ELSEIF NEW.status = 'deleted' THEN
        IF NEW.deleted_at IS NULL
            OR NEW.status_before_archive IS NOT NULL
            OR NEW.archived_at IS NOT NULL
            OR NEW.archived_by IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted objectives require deleted_at only.';
        END IF;
    END IF;
END
SQL);
    }
};