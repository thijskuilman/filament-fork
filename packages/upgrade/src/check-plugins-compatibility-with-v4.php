<?php

use function Termwind\{render};

$composer = json_decode(file_get_contents("composer.json"), true);
$deps = $composer["require"] ?? [];
$allPackages = array_keys($deps);
// Filter packages to only those that require filament/filament
$filamentPlugins = array_filter($allPackages, function ($package) {
    // Skip filament/filament itself
    if ($package === "filament/filament") {
        return false;
    }

    // Skip filament/* packages as they are part of the Filament ecosystem
    if (str_starts_with($package, "filament/")) {
        return false;
    }

    try {
        // Read the local composer.json file from vendor directory
        $composerPath = "vendor/{$package}/composer.json";

        if (!file_exists($composerPath)) {
            return false;
        }

        $composerContent = file_get_contents($composerPath);
        $composer = json_decode($composerContent, true);

        if (!$composer || !is_array($composer)) {
            return false;
        }

        // Check if the package requires filament/filament
        $requires = $composer["require"] ?? [];

        return isset($requires["filament/filament"]);

    } catch (Exception $e) {
        render("<div class='text-red'>Error checking if {$package} requires filament/filament: " . $e->getMessage() . "</div>");
    }

    return false;
});
render("<div class='text-blue font-bold'>📦 Checking plugin compatibility with v4...</div>");
render("<div class='mt-1'>Found " . count($filamentPlugins) . " packages that require filament/filament</div>");

// Collect incompatible plugins
$incompatiblePlugins = [];
foreach ($filamentPlugins as $pkg) {
    $version = $deps[$pkg];
    $compatibility = null;

    // First check regular releases
    $url = "https://repo.packagist.org/p2/{$pkg}.json";
    try {
        $json = @file_get_contents($url);
        if ($json) {
            $data = json_decode($json, true);
            $versions = $data["packages"][$pkg] ?? [];

            foreach ($versions as $v) {
                $requires = $v["require"] ?? [];

                if (isset($requires["filament/filament"])) {
                    $constraint = $requires["filament/filament"];

                    // Match common constraint patterns for v4
                    if (preg_match("/\^4\.|~4\.|>=4\./", $constraint)) {
                        $compatibility = [
                            "version" => $v["version"],
                            "isPrerelease" => false
                        ];
                        break;
                    }
                }
            }
        }

        // If no compatible version found, check dev versions
        if ($compatibility === null) {
            $devUrl = "https://repo.packagist.org/p2/{$pkg}~dev.json";
            $devJson = @file_get_contents($devUrl);

            if ($devJson) {
                $devData = json_decode($devJson, true);
                $devVersions = $devData["packages"][$pkg] ?? [];

                foreach ($devVersions as $v) {
                    $requires = $v["require"] ?? [];

                    if (isset($requires["filament/filament"])) {
                        $constraint = $requires["filament/filament"];

                        // Match common constraint patterns for v4
                        if (preg_match("/\^4\.|~4\.|>=4\./", $constraint)) {
                            $compatibility = [
                                "version" => $v["version"],
                                "isPrerelease" => true
                            ];
                            break;
                        }
                    }
                }
            }
        }

        // Only collect incompatible plugins
        if ($compatibility === null) {
            $incompatiblePlugins[] = $pkg;
        }
    } catch (Exception $e) {
        // Treat errors as incompatible
        $incompatiblePlugins[] = $pkg;
    }
}

// Check if there are any incompatible plugins
if (!empty($incompatiblePlugins)) {
    $pluginList = implode(', ', $incompatiblePlugins);
    render("<div class='text-red font-bold mt-1'>❌ &nbsp;Incompatible plugins found!</div>");
    render("<div class='mt-1'>The following plugins are incompatible with Filament v4 and need to be removed before upgrading:</div>");
    render("<div class='mt-1 text-red'>{$pluginList}</div>");
    render(<<<HTML
        <div class="max-w-2xl mt-1">
            <p><strong>Some plugins you’re using are not available in v4 just yet.</strong></p>
            <p>You could temporarily remove them from your composer.json file until they’ve been upgraded,
            replace them with a similar plugin that is v4-compatible,
            wait for the plugins to be upgraded before upgrading your app,
            or even write PRs to help the authors upgrade them.</p>
        </div>
    HTML);
    render(<<<HTML
        <div class="py-1 px-3 bg-red-600 text-red-50  mt-2">
            <strong>Upgrade aborted</strong>
        </div>
    HTML);
    exit(1);
}

render("<div class='text-green font-bold mt-1'>✅ &nbsp;All plugins are compatible with Filament v4!</div>");
