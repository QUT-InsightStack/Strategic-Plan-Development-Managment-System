<?php

return [
    'mysqldump_path' => env('BACKUP_MYSQLDUMP_PATH') ?: \App\Support\MySqlClientPath::find('mysqldump'),
    'mysql_path' => env('BACKUP_MYSQL_PATH') ?: \App\Support\MySqlClientPath::find('mysql'),
];
