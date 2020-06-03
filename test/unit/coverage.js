/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const minimatch = require('minimatch');
const fs = require('fs');
const path = require('path');
const iLibInstrument = require('istanbul-lib-instrument');
const iLibCoverage = require('istanbul-lib-coverage');
const iLibSourceMaps = require('istanbul-lib-source-maps');
const iLibReport = require('istanbul-lib-report');
const iReports = require('istanbul-reports');

const REPO_PATH = toUpperDriveLetter(path.join(__dirname, '../../'));

exports.initialize = function (loaderConfig) {
	const instrumenter = iLibInstrument.createInstrumenter();
	loaderConfig.nodeInstrumenter = function (contents, source) {
		if (minimatch(source, '**/test/**')) {
			// tests don't get instrumented
			return contents;
		}
		// Try to find a .map file
		let map = undefined;
		try {
			map = JSON.parse(fs.readFileSync(`${source}.map`).toString());
		} catch (err) {
			// missing source map...
		}
		return instrumenter.instrumentSync(contents, source, map);
	};
};

exports.createReport = function (isSingle) {
	const mapStore = iLibSourceMaps.createSourceMapStore();
	const coverageMap = iLibCoverage.createCoverageMap(global.__coverage__);
	return mapStore.transformCoverage(coverageMap).then((transformed) => {
		// Paths come out all broken
		let newData = Object.create(null);
		Object.keys(transformed.data).forEach((file) => {
			const entry = transformed.data[file];
			const fixedPath = fixPath(entry.path);
			if (fixedPath.includes('\\vs\\') || fixedPath.includes('/vs/')) { return; } // {{SQL CARBON EDIT}} skip vscode files
			entry.data.path = fixedPath;
			newData[fixedPath] = entry;
		});
		transformed.data = newData;

		const context = iLibReport.createContext({
			dir: path.join(REPO_PATH, `.build/coverage${isSingle ? '-single' : ''}`),
			coverageMap: transformed
		});
		const tree = context.getTree('flat');

		let reports = [];
		if (isSingle) {
			reports.push(iReports.create('lcovonly'));
			reports.push(iReports.create('json')); // {{SQL CARBON EDIT}} add json for code coverage merging
		} else {
			reports.push(iReports.create('json'));
			reports.push(iReports.create('lcov'));
			reports.push(iReports.create('html'));
			reports.push(iReports.create('cobertura')); // {{SQL CARBON EDIT}} add covertura
		}
		reports.forEach(report => tree.visit(report, context));
	});
};

function toUpperDriveLetter(str) {
	if (/^[a-z]:/.test(str)) {
		return str.charAt(0).toUpperCase() + str.substr(1);
	}
	return str;
}

function toLowerDriveLetter(str) {
	if (/^[A-Z]:/.test(str)) {
		return str.charAt(0).toLowerCase() + str.substr(1);
	}
	return str;
}

function fixPath(brokenPath) {
	const startIndex = brokenPath.lastIndexOf(REPO_PATH);
	if (startIndex === -1) {
		return toLowerDriveLetter(brokenPath);
	}
	return toLowerDriveLetter(brokenPath.substr(startIndex));
}
