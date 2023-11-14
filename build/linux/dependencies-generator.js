/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDependencies = void 0;
const child_process_1 = require("child_process");
const path = require("path");
const calculate_deps_1 = require("./debian/calculate-deps");
const calculate_deps_2 = require("./rpm/calculate-deps");
// import { referenceGeneratedDepsByArch as debianGeneratedDeps } from './debian/dep-lists';  // {{SQL CARBON EDIT}} remove unused import
// import { referenceGeneratedDepsByArch as rpmGeneratedDeps } from './rpm/dep-lists';
const types_1 = require("./debian/types");
const types_2 = require("./rpm/types"); // {{SQL CARBON EDIT}} remove unused import
// A flag that can easily be toggled.
// Make sure to compile the build directory after toggling the value.
// If false, we warn about new dependencies if they show up
// while running the prepare package tasks for a release.
// If true, we fail the build if there are new dependencies found during that task.
// The reference dependencies, which one has to update when the new dependencies
// are valid, are in dep-lists.ts
// const FAIL_BUILD_FOR_NEW_DEPENDENCIES: boolean = false; // {{SQL CARBON EDIT}} Not needed
// Based on https://source.chromium.org/chromium/chromium/src/+/refs/tags/114.0.5735.199:chrome/installer/linux/BUILD.gn;l=64-80
// and the Linux Archive build
// Shared library dependencies that we already bundle.
const bundledDeps = [
    'libEGL.so',
    'libGLESv2.so',
    'libvulkan.so.1',
    'libvk_swiftshader.so',
    'libffmpeg.so'
];
function getDependencies(packageType, buildDir, applicationName, arch, sysroot) {
    if (packageType === 'deb') {
        if (!(0, types_1.isDebianArchString)(arch)) {
            throw new Error('Invalid Debian arch string ' + arch);
        }
        if (!sysroot) {
            throw new Error('Missing sysroot parameter');
        }
    }
    if (packageType === 'rpm' && !(0, types_2.isRpmArchString)(arch)) {
        throw new Error('Invalid RPM arch string ' + arch);
    }
    // Get the files for which we want to find dependencies.
    const nativeModulesPath = path.join(buildDir, 'resources', 'app', 'node_modules.asar.unpacked');
    const findResult = (0, child_process_1.spawnSync)('find', [nativeModulesPath, '-name', '*.node']);
    if (findResult.status) {
        console.error('Error finding files:');
        console.error(findResult.stderr.toString());
        return [];
    }
    const files = findResult.stdout.toString().trimEnd().split('\n');
    const appPath = path.join(buildDir, applicationName);
    files.push(appPath);
    // Add chrome sandbox and crashpad handler.
    files.push(path.join(buildDir, 'chrome-sandbox'));
    files.push(path.join(buildDir, 'chrome_crashpad_handler'));
    // Generate the dependencies.
    const dependencies = packageType === 'deb' ?
        (0, calculate_deps_1.generatePackageDeps)(files, arch, sysroot) :
        (0, calculate_deps_2.generatePackageDeps)(files);
    // Merge all the dependencies.
    const mergedDependencies = mergePackageDeps(dependencies);
    // Exclude bundled dependencies and sort
    const sortedDependencies = Array.from(mergedDependencies).filter(dependency => {
        return !bundledDeps.some(bundledDep => dependency.startsWith(bundledDep));
    }).sort();
    /* {{SQL CARBON EDIT}} Not needed
    const referenceGeneratedDeps = referenceGeneratedDepsByArch[arch];
    if (JSON.stringify(sortedDependencies) !== JSON.stringify(referenceGeneratedDeps)) {
        const failMessage = 'The dependencies list has changed. '
            + 'Printing newer dependencies list that one can use to compare against referenceGeneratedDeps:\n'
            + sortedDependencies.join('\n');
        if (FAIL_BUILD_FOR_NEW_DEPENDENCIES) {
            throw new Error(failMessage);
        } else {
            console.warn(failMessage);
        }
    }
    */
    return sortedDependencies;
}
exports.getDependencies = getDependencies;
// Based on https://source.chromium.org/chromium/chromium/src/+/main:chrome/installer/linux/rpm/merge_package_deps.py.
function mergePackageDeps(inputDeps) {
    const requires = new Set();
    for (const depSet of inputDeps) {
        for (const dep of depSet) {
            const trimmedDependency = dep.trim();
            if (trimmedDependency.length && !trimmedDependency.startsWith('#')) {
                requires.add(trimmedDependency);
            }
        }
    }
    return requires;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwZW5kZW5jaWVzLWdlbmVyYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGVuZGVuY2llcy1nZW5lcmF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsWUFBWSxDQUFDOzs7QUFDYixpREFBMEM7QUFDMUMsNkJBQThCO0FBQzlCLDREQUEyRjtBQUMzRix5REFBcUY7QUFDckYseUlBQXlJO0FBQ3pJLHNGQUFzRjtBQUN0RiwwQ0FBc0U7QUFDdEUsdUNBQWlFLENBQUMsMkNBQTJDO0FBRTdHLHFDQUFxQztBQUNyQyxxRUFBcUU7QUFDckUsMkRBQTJEO0FBQzNELHlEQUF5RDtBQUN6RCxtRkFBbUY7QUFDbkYsZ0ZBQWdGO0FBQ2hGLGlDQUFpQztBQUNqQyw0RkFBNEY7QUFFNUYsZ0lBQWdJO0FBQ2hJLDhCQUE4QjtBQUM5QixzREFBc0Q7QUFDdEQsTUFBTSxXQUFXLEdBQUc7SUFDbkIsV0FBVztJQUNYLGNBQWM7SUFDZCxnQkFBZ0I7SUFDaEIsc0JBQXNCO0lBQ3RCLGNBQWM7Q0FDZCxDQUFDO0FBRUYsU0FBZ0IsZUFBZSxDQUFDLFdBQTBCLEVBQUUsUUFBZ0IsRUFBRSxlQUF1QixFQUFFLElBQVksRUFBRSxPQUFnQjtJQUNwSSxJQUFJLFdBQVcsS0FBSyxLQUFLLEVBQUU7UUFDMUIsSUFBSSxDQUFDLElBQUEsMEJBQWtCLEVBQUMsSUFBSSxDQUFDLEVBQUU7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsR0FBRyxJQUFJLENBQUMsQ0FBQztTQUN0RDtRQUNELElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7U0FDN0M7S0FDRDtJQUNELElBQUksV0FBVyxLQUFLLEtBQUssSUFBSSxDQUFDLElBQUEsdUJBQWUsRUFBQyxJQUFJLENBQUMsRUFBRTtRQUNwRCxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixHQUFHLElBQUks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