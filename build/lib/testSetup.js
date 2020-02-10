"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const fs = require('fs').promises;
const path = require('path');
const readConfiguration = (async () => {
    const parseConfigString = ((content) => {
        try {
            const result = JSON.parse(content);
            return result;
        }
        catch (ex) {
            console.log('Could NOT parse TEST_RUN_LIST:', content);
        }
    });
    // Attempt to read from an enviornment variable
    const testRunlist = process.env['TEST_RUN_LIST'];
    if (testRunlist && testRunlist !== '') {
        const result = parseConfigString(testRunlist);
        if (result) {
            console.log('Using the environment test run list:', result);
            return result;
        }
    }
    // Attempt to read from a config file
    let testRunPath = process.env['TEST_RUN_LIST_FILE'];
    if (!testRunPath || testRunPath === '') {
        testRunPath = path.resolve(__dirname, '..', 'runlist.json');
    }
    try {
        const contents = await fs.readFile(testRunPath);
        return parseConfigString(contents);
    }
    catch (ex) {
        console.log(`error reading file ${testRunPath}:`, ex);
    }
});
(async () => {
    const keys = process.argv.slice(2);
    const configuration = await readConfiguration();
    if (!configuration) {
        console.log('no configuration was setup');
        return;
    }
    const testList = [];
    keys.forEach((key) => {
        const arr = configuration[key];
        if (arr) {
            testList.push(...arr);
        }
    });
    const result = `(${testList.join('|')})`;
    console.log(result);
    process.env['TEST_GREP'] = result;
})();
