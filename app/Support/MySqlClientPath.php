<?php

namespace App\Support;

use Symfony\Component\Process\ExecutableFinder;

final class MySqlClientPath
{
    public static function find(string $binary): string
    {
        $found = (new ExecutableFinder)->find($binary);
        if ($found !== null) {
            return $found;
        }
        // Windows installers do not always add the client tools to PATH.
        if (PHP_OS_FAMILY === 'Windows') {
            $roots = array_unique(array_filter([getenv('ProgramFiles'), getenv('ProgramW6432')]));
            foreach ($roots as $root) {
                $candidates = glob(str_replace('\\', '/', $root).'/MySQL/MySQL Server */bin/'.$binary.'.exe') ?: [];
                rsort($candidates, SORT_NATURAL);
                foreach ($candidates as $candidate) {
                    if (is_file($candidate)) {
                        return $candidate;
                    }
                }
            }
        }

        return $binary;
    }
}
