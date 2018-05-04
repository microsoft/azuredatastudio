/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var path = require('path');

var projectRoot = path.resolve(path.dirname(__dirname));
var srcRoot = path.resolve(projectRoot, 'src');
var localization = path.resolve(projectRoot, 'localization');

var config = {
    paths: {
        project: {
            root: projectRoot,
            localization: localization
        },
        extension: {
            root: srcRoot
        }
    }
};

module.exports = config;
