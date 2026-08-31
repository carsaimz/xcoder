#!/bin/bash
# XCoder build script
# Usage: ./utils/scripts/build.sh [p|prod|d|dev] [apk|bundle]
set -e

mode="d"
webpackmode="development"
cordovamode=""
packageType="apk"

for arg in "$@"; do
    case "$arg" in
        "p"|"prod"|"d"|"dev")
            mode="$arg"
            ;;
        "apk"|"bundle")
            packageType="$arg"
            ;;
        *)
            echo "Warning: Unknown argument '$arg' ignored"
            ;;
    esac
done

if [ "$mode" = "p" ] || [ "$mode" = "prod" ]; then
    mode="p"
    webpackmode="production"
    cordovamode="--release"
fi

root=$(npm prefix)

script1="node ./utils/config.js $mode"
script2="rspack --mode $webpackmode"
script4="cordova build android $cordovamode -- --packageType=$packageType"

echo "$script1";
$script1;
echo "$script2";
$script2;
echo "$script4";
$script4;
