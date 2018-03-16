/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let gulp = require('gulp');
let exec = require('child-process-promise').exec;
let color = require('gulp-color');

// CONSTANTS ///////////////////////////////////////////////////////////////
let packageVals = require('../package');

// HELPER FUNCTIONS ////////////////////////////////////////////////////////

let buildPackage = function(packageName) {
    // Make sure there are
    if (!packageVals.repository) {
        return Promise.reject("Repository field is not defined in package.json");
    }

    // Initialize the package command with program and command
    let vsceArgs = [];
    vsceArgs.push('./node_modules/vsce/out/vsce');
    vsceArgs.push('package'); // package command

    // Add the package name
    vsceArgs.push('-o');
    vsceArgs.push(packageName);

    // Put it all together and execute the command
    let command = vsceArgs.join(' ');
    console.log(command);
    return exec(command);
};


// function getServiceInstaller() {
//     let Constants = require('../out/src/models/constants').Constants;
//     let ServiceInstaller = require('../out/src/languageservice/serviceInstallerUtil').ServiceInstaller;
//     return new ServiceInstaller(new Constants())
// }
//
// function installToolsService(platform) {
//     let installer = getServiceInstaller();
//     return installer.installService(platform);
// }

// function cleanServiceInstallFolder() {
//     let installer = getServiceInstaller();
//     return new Promise(function(resolve, reject) {
//         installer.getServiceInstallDirectoryRoot().then(function (serviceInstallFolder) {
//             console.log('Deleting Service Install folder: ' + serviceInstallFolder);
//             del(serviceInstallFolder + '/*').then(function () {
//                 resolve();
//             }).catch(function (error) {
//                 reject(error)
//             });
//         });
//     });
// }

// function doOfflinePackage(runtimeId, platform, packageName) {
//     return installSqlToolsService(platform).then(function() {
//         return doPackageSync(packageName + '-' + runtimeId + '.vsix');
//     });
// }

// ORIGINAL GULP TASKS /////////////////////////////////////////////////////
// TODO: Reinstate when we have code for loading a tools service

// gulp.task('ext:install-service', function() {
//     return installSqlToolsService();
// });

// Install vsce to be able to run this task: npm install -g vsce
// gulp.task('package:online', function() {
//     return cleanServiceInstallFolder()
//         .then(function() { return doPackageSync(); });
// });

// Install vsce to be able to run this task: npm install -g vsce
// gulp.task('package:offline', function() {
//     const platform = require('../out/src/models/platform');
//     const Runtime = platform.Runtime;
//     let json = JSON.parse(fs.readFileSync('package.json').toString());
//     let name = json.name;
//     let version = json.version;
//     let packageName = name + '-' + version;
//
//     let packages = [];
//     packages.push({rid: 'win-x64', runtime: Runtime.Windows_64});
//     packages.push({rid: 'win-x86', runtime: Runtime.Windows_86});
//     packages.push({rid: 'osx', runtime: Runtime.OSX});
//     packages.push({rid: 'linux-x64', runtime: Runtime.Linux_64});
//
//     let promise = Promise.resolve();
//     cleanServiceInstallFolder().then(function () {
//         packages.forEach(function (data) {
//             promise = promise.then(function () {
//                 return doOfflinePackage(data.rid, data.runtime, packageName).then(function () {
//                     return cleanServiceInstallFolder();
//                 });
//             });
//         });
//     });
//
//     return promise;
// });

function getOnlinePackageName() {
    return packageVals.name + "-" + packageVals.version + ".vsix";
}

function getOnlinePackagePath() {
    return './' + getOnlinePackageName();
}

// TEMPORARY GULP TASKS ////////////////////////////////////////////////////
gulp.task('package:online', gulp.series("build", function() {
    return buildPackage(getOnlinePackageName());
}));

gulp.task('package:offline', gulp.series("build", function(done) {
    // TODO: Get list of platforms
    // TODO: For each platform: clean the package service folder, download the service, build the package
    console.error("This mode is not yet supported");
    done("This mode is not yet supported");
}));

gulp.task('install:sqlops', gulp.series("package:online", function() {
    let command = 'sqlops --install-extension ' + getOnlinePackagePath();
    console.log(command);
    return exec(command);
}));

gulp.task("help:debug", function(done) {
    let command = '$SQLOPS_DEV/scripts/sql.sh --extensionDevelopmentPath='+process.cwd();
    console.log('Launch sqlops + your extension (from a sqlops dev enlistment after setting $SQLOPS_DEV to your enlistment root):\n')
    console.log(color(command, 'GREEN'));

    command = 'sqlops --extensionDevelopmentPath='+process.cwd();
    console.log('\nLaunch sqlops + your extension (full SQLOPS - requires setting PATH variable)\n');
    console.log(color(command, 'GREEN'));
    done();
})

