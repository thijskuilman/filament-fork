<?php

use function Termwind\render;

$composer = json_decode(file_get_contents('composer.json'), true);
$deps = $composer['require'] ?? [];
$allPackages = array_keys($deps);

$plugins = array_filter($allPackages, function ($plugin) {
    if (str_starts_with($plugin, 'filament/')) {
        return false;
    }

    try {
        $composerPath = "vendor/{$plugin}/composer.json";

        if (! file_exists($composerPath)) {
            return false;
        }

        $composerContent = file_get_contents($composerPath);
        $composer = json_decode($composerContent, true);

        if (! $composer || ! is_array($composer)) {
            return false;
        }

        $requires = $composer['require'] ?? [];

        foreach ($requires as $key => $value) {
            if (str_starts_with($key, 'filament/')) {
                return true;
            }
        }

        return false;
    } catch (Exception $exception) {
        render("<p class=\"text-red\">Error checking if {$plugin} requires filament/filament: " . $exception->getMessage() . '</p>');
    }

    return false;
});

render('<p class="text-blue font-bold">📦 Checking plugin compatibility with v4...</p>');

$incompatiblePlugins = [];

foreach ($plugins as $plugin) {
    $version = $deps[$plugin];
    $compatibility = null;

    $url = "https://repo.packagist.org/p2/{$plugin}.json";

    try {
        $json = @file_get_contents($url);

        if ($json) {
            $data = json_decode($json, true);
            $versions = $data['packages'][$plugin] ?? [];

            foreach ($versions as $checkingVersion) {
                $requires = $checkingVersion['require'] ?? [];

                if (isset($requires['filament/filament'])) {
                    $constraint = $requires['filament/filament'];

                    if (preg_match("/\^4\.|~4\.|>=4\./", $constraint)) {
                        $compatibility = [
                            'version' => $checkingVersion['version'],
                            'isPrerelease' => false,
                        ];

                        break;
                    }
                }
            }
        }

        if ($compatibility === null) {
            $devUrl = "https://repo.packagist.org/p2/{$plugin}~dev.json";
            $devJson = @file_get_contents($devUrl);

            if ($devJson) {
                $devData = json_decode($devJson, true);
                $devVersions = $devData['packages'][$plugin] ?? [];

                foreach ($devVersions as $checkingVersion) {
                    $requires = $checkingVersion['require'] ?? [];

                    if (isset($requires['filament/filament'])) {
                        $constraint = $requires['filament/filament'];

                        if (preg_match("/\^4\.|~4\.|>=4\./", $constraint)) {
                            $compatibility = [
                                'version' => $checkingVersion['version'],
                                'isPrerelease' => true,
                            ];

                            break;
                        }
                    }
                }
            }
        }

        if ($compatibility === null) {
            $incompatiblePlugins[] = $plugin;
        }
    } catch (Exception $exception) {
        $incompatiblePlugins[] = $plugin;
    }
}

if (! empty($incompatiblePlugins)) {
    $pluginList = implode(', ', $incompatiblePlugins);

    render('<p class="text-red font-bold mt-1">❌ &nbsp;Incompatible plugins found!</p>');
    render('<p>The following plugins are incompatible with Filament v4 and need to be removed before upgrading:</p>');
    render("<p class=\"text-red\">{$pluginList}</p>");
    render('<p>You could temporarily remove them from your composer.json file until they\'ve been upgraded, replace them with a similar plugin that is compatible with v4, wait for the plugins to be upgraded before upgrading your app, or even write PRs to help the authors upgrade them.</p>');

    render(<<<'HTML'
        <p class="bg-red-600 text-red-50 mt-1">
            <strong>Upgrade aborted because of incompatible plugins</strong>
        </p>
    HTML);

    exit(1);
}

render('<p class="text-green font-bold mt-1">✅ &nbsp;All plugins are compatible with Filament v4!</p>');
