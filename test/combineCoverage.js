/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const iLibCoverage = require('istanbul-lib-coverage');
const iLibReport = require('istanbul-lib-report');
const iReports = require('istanbul-reports');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const coverageMap = iLibCoverage.createCoverageMap();
const repoRoot = path.join(path.dirname(__filename), '..');

// .build contain the core coverage files
// extensions each may container their own coverage file
const coverageFiles = glob.sync('{extensions,.build}/**/coverage-final.json',
	{
		cwd: repoRoot,
		ignore: ['**/node_modules/**']
	}
);

coverageFiles.forEach(file => {
	console.log(`Merging coverage file ${path.join(repoRoot, file)}`);
	coverageMap.merge(JSON.parse(fs.readFileSync(file)));
});

const context = iLibReport.createContext({
	dir: path.join(path.dirname(__filename), 'coverage'),
	coverageMap: coverageMap
});

const tree = context.getTree('flat');
tree.visit(iReports.create('lcov'), context);
