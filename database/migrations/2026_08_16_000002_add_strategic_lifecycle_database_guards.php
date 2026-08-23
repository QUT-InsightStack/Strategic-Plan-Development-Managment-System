<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        $this->dropTriggers();

        foreach ($this->triggerStatements() as $statement) {
            DB::unprepared($statement);
        }
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        $this->dropTriggers();
    }

    private function isMySql(): bool
    {
        return Schema::getConnection()->getDriverName() === 'mysql';
    }

    private function dropTriggers(): void
    {
        foreach ($this->triggerNames() as $triggerName) {
            DB::unprepared("DROP TRIGGER IF EXISTS `{$triggerName}`");
        }
    }

    private function triggerNames(): array
    {
        return [
            'trg_strategic_record_before_insert',
            'trg_strategic_record_before_update',
            'trg_strategic_objective_before_insert',
            'trg_strategic_objective_before_update',
            'trg_plan_core_value_before_insert',
            'trg_plan_core_value_before_update',
            'trg_relation_map_before_insert',
            'trg_relation_map_before_update',
            'trg_strategic_foundations_before_insert',
            'trg_strategic_foundations_before_update',
        ];
    }

    private function triggerStatements(): array
    {
        return [
            <<<'SQL'
CREATE TRIGGER `trg_strategic_record_before_insert`
BEFORE INSERT ON `tblstrategic_record`
FOR EACH ROW
BEGIN
    IF NEW.status <> 'draft' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Plans must be inserted in draft status.';
    END IF;

    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Draft plans cannot carry archive or delete timestamps.';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.mission_id
          AND `type` = 'MISSION'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|mission_id|Plans require a non-deleted mission foundation.';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.vision_id
          AND `type` = 'VISION'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|vision_id|Plans require a non-deleted vision foundation.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_strategic_record_before_update`
BEFORE UPDATE ON `tblstrategic_record`
FOR EACH ROW
BEGIN
    IF OLD.status = 'deleted' AND NEW.status <> 'deleted' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted plans cannot be restored.';
    END IF;

    IF NEW.status = 'draft' THEN
        IF OLD.status IN ('finished', 'archived') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Finished or archived plans cannot move back to draft.';
        END IF;

        IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Draft plans cannot carry archive or delete timestamps.';
        END IF;
    ELSEIF NEW.status = 'finished' THEN
        IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Finished plans cannot carry archive or delete timestamps.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_foundations`
            WHERE `foundation_id` = NEW.mission_id
              AND `type` = 'MISSION'
              AND `status` <> 'deleted'
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|mission_id|Plans require a non-deleted mission foundation.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_foundations`
            WHERE `foundation_id` = NEW.vision_id
              AND `type` = 'VISION'
              AND `status` <> 'deleted'
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|vision_id|Plans require a non-deleted vision foundation.';
        END IF;

        IF TRIM(COALESCE(NEW.title, '')) = '' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|title|Finished plans require a title.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_foundations`
            WHERE `foundation_id` = NEW.mission_id
              AND `status` <> 'deleted'
              AND TRIM(COALESCE(`content`, '')) <> ''
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|mission|Finished plans require a mission with content.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_foundations`
            WHERE `foundation_id` = NEW.vision_id
              AND `status` <> 'deleted'
              AND TRIM(COALESCE(`content`, '')) <> ''
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|vision|Finished plans require a vision with content.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblplan_core_value`
            WHERE `plan_id` = NEW.record_id
              AND `status` = 'active'
        ) = 0 AND NOT (
            OLD.status = 'archived'
            AND (
                SELECT COUNT(*)
                FROM `tblplan_core_value`
                WHERE `plan_id` = NEW.record_id
                  AND `status` IN ('active', 'archived')
            ) > 0
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|core_values|Finished plans require at least one core value.';
        END IF;
    ELSEIF NEW.status = 'archived' THEN
        IF OLD.status <> 'finished' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Only finished plans can be archived.';
        END IF;

        IF NEW.archived_at IS NULL OR NEW.archived_by IS NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived plans require archived_at and archived_by only.';
        END IF;
    ELSEIF NEW.status = 'deleted' THEN
        IF NEW.deleted_at IS NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted plans require deleted_at only.';
        END IF;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.mission_id
          AND `type` = 'MISSION'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|mission_id|Plans require a non-deleted mission foundation.';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.vision_id
          AND `type` = 'VISION'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|vision_id|Plans require a non-deleted vision foundation.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_strategic_objective_before_insert`
BEFORE INSERT ON `tblstrategic_objectives`
FOR EACH ROW
BEGIN
    IF NEW.status NOT IN ('draft', 'published') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Objectives must be inserted as draft or published.';
    END IF;

    IF NEW.status_before_archive IS NOT NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|New objectives cannot carry archive or delete metadata.';
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
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_strategic_objective_before_update`
BEFORE UPDATE ON `tblstrategic_objectives`
FOR EACH ROW
BEGIN
    IF OLD.status = 'deleted' AND NEW.status <> 'deleted' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted objectives cannot be restored.';
    END IF;

    IF NEW.status IN ('draft', 'published') THEN
        IF NEW.status_before_archive IS NOT NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
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
        ) <> 'archived' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|strategic_plan_id|Archived objectives require an archived plan.';
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
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_plan_core_value_before_insert`
BEFORE INSERT ON `tblplan_core_value`
FOR EACH ROW
BEGIN
    IF NEW.status <> 'active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Core value links must be inserted as active.';
    END IF;

    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active core value links cannot carry archive or delete metadata.';
    END IF;

    IF (
        SELECT `status`
        FROM `tblstrategic_record`
        WHERE `record_id` = NEW.plan_id
    ) NOT IN ('draft', 'finished') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|plan_id|Active core value links require a draft or finished plan.';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.core_value_id
          AND `type` = 'CORE_VALUE'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|core_value_id|Core value links require a non-deleted core value foundation.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_plan_core_value_before_update`
BEFORE UPDATE ON `tblplan_core_value`
FOR EACH ROW
BEGIN
    IF NEW.status = 'active' THEN
        IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active core value links cannot carry archive or delete metadata.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.plan_id
        ) NOT IN ('draft', 'finished') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|plan_id|Active core value links require a draft or finished plan.';
        END IF;
    ELSEIF NEW.status = 'archived' THEN
        IF NEW.archived_at IS NULL OR NEW.archived_by IS NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived core value links require archived_at and archived_by.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.plan_id
        ) <> 'archived' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|plan_id|Archived core value links require an archived plan.';
        END IF;
    ELSEIF NEW.status = 'deleted' THEN
        IF NEW.deleted_at IS NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted core value links require deleted_at only.';
        END IF;
    END IF;

    IF (
        SELECT COUNT(*)
        FROM `tblstrategic_foundations`
        WHERE `foundation_id` = NEW.core_value_id
          AND `type` = 'CORE_VALUE'
          AND `status` <> 'deleted'
    ) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|core_value_id|Core value links require a non-deleted core value foundation.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_relation_map_before_insert`
BEFORE INSERT ON `tblrelation_map`
FOR EACH ROW
BEGIN
    IF NEW.record_id = NEW.parent_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|parent_id|A strategic plan cannot relate to itself.';
    END IF;

    IF NEW.status <> 'active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Relations must be inserted as active.';
    END IF;

    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active relations cannot carry archive or delete metadata.';
    END IF;

    IF (
        SELECT `status`
        FROM `tblstrategic_record`
        WHERE `record_id` = NEW.record_id
    ) NOT IN ('draft', 'finished') OR (
        SELECT `status`
        FROM `tblstrategic_record`
        WHERE `record_id` = NEW.parent_id
    ) NOT IN ('draft', 'finished') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|record_id|Active relations require draft or finished plans on both sides.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_relation_map_before_update`
BEFORE UPDATE ON `tblrelation_map`
FOR EACH ROW
BEGIN
    IF NEW.record_id = NEW.parent_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|parent_id|A strategic plan cannot relate to itself.';
    END IF;

    IF NEW.status = 'active' THEN
        IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active relations cannot carry archive or delete metadata.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.record_id
        ) NOT IN ('draft', 'finished') OR (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.parent_id
        ) NOT IN ('draft', 'finished') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|record_id|Active relations require draft or finished plans on both sides.';
        END IF;
    ELSEIF NEW.status = 'archived' THEN
        IF NEW.archived_at IS NULL OR NEW.archived_by IS NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived relations require archived_at and archived_by.';
        END IF;

        IF (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.record_id
        ) = 'deleted' OR (
            SELECT `status`
            FROM `tblstrategic_record`
            WHERE `record_id` = NEW.parent_id
        ) = 'deleted' OR (
            SELECT COUNT(*)
            FROM `tblstrategic_record`
            WHERE `record_id` IN (NEW.record_id, NEW.parent_id)
              AND `status` = 'archived'
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|record_id|Archived relations require at least one archived plan and no deleted plan.';
        END IF;
    ELSEIF NEW.status = 'deleted' THEN
        IF NEW.deleted_at IS NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted relations require deleted_at only.';
        END IF;
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_strategic_foundations_before_insert`
BEFORE INSERT ON `tblstrategic_foundations`
FOR EACH ROW
BEGIN
    IF NEW.status <> 'active' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Foundations must be inserted as active.';
    END IF;

    IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active foundations cannot carry archive or delete metadata.';
    END IF;
END
SQL,
            <<<'SQL'
CREATE TRIGGER `trg_strategic_foundations_before_update`
BEFORE UPDATE ON `tblstrategic_foundations`
FOR EACH ROW
BEGIN
    IF OLD.status = 'deleted' AND NEW.status <> 'deleted' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted foundations cannot be restored.';
    END IF;

    IF NEW.status = 'active' THEN
        IF NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Active foundations cannot carry archive or delete metadata.';
        END IF;
    ELSEIF NEW.status = 'archived' THEN
        IF NEW.archived_at IS NULL OR NEW.archived_by IS NULL OR NEW.deleted_at IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived foundations require archived_at and archived_by.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_record`
            WHERE (`mission_id` = NEW.foundation_id OR `vision_id` = NEW.foundation_id)
              AND `status` IN ('draft', 'finished')
        ) > 0 OR (
            SELECT COUNT(*)
            FROM `tblplan_core_value`
            WHERE `core_value_id` = NEW.foundation_id
              AND `status` = 'active'
        ) > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived foundations cannot keep active references.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_record`
            WHERE (`mission_id` = NEW.foundation_id OR `vision_id` = NEW.foundation_id)
              AND `status` = 'archived'
        ) = 0 AND (
            SELECT COUNT(*)
            FROM `tblplan_core_value`
            WHERE `core_value_id` = NEW.foundation_id
              AND `status` = 'archived'
        ) = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Archived foundations require archived references.';
        END IF;
    ELSEIF NEW.status = 'deleted' THEN
        IF NEW.deleted_at IS NULL OR NEW.archived_at IS NOT NULL OR NEW.archived_by IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted foundations require deleted_at only.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM `tblstrategic_record`
            WHERE (`mission_id` = NEW.foundation_id OR `vision_id` = NEW.foundation_id)
              AND `status` <> 'deleted'
        ) > 0 OR (
            SELECT COUNT(*)
            FROM `tblplan_core_value`
            WHERE `core_value_id` = NEW.foundation_id
              AND `status` <> 'deleted'
        ) > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'SPDMS_VALIDATION|status|Deleted foundations cannot keep active or archived references.';
        END IF;
    END IF;
END
SQL,
        ];
    }
};
