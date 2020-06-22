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

let args = process.argv.slice(2);
if (args.length < 1) {
	console.log("Missing required parameter.  Need to provide a path the coverage area file.");
	process.exit(1);
}

let filePath = args[0];
fs.readFile(filePath, 'utf8', function (err, data) {
	if (err) {
		console.log(err);
		process.exit(1);
	}

	let coverageAreas = JSON.parse(data);
	if (coverageAreas && coverageAreas.areas) {



	}

	console.log(data);

});

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
//tree.visit(iReports.create('json-summary'), context);

function summarizeCoverage(tree) {
	if (tree.fileCoverage) {
		if (tree.fileCoverage.data.s) {
			let total = 0, covered = 0;
			for (statement in tree.fileCoverage.data.s) {
				++total;
				let isCovered = tree.fileCoverage.data.s[statement];
				if (isCovered !== 0) {
					++covered;
				}
			}
			console.log(tree.fileCoverage.path + ',' + covered + ',' + total);
		}


	}
	for (const child of tree.children) {
		summarizeCoverage(child);
	}
}

summarizeCoverage(tree.root);

