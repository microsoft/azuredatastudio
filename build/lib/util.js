"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebNodePaths = exports.createExternalLoaderConfig = exports.acquireWebNodePaths = exports.getElectronVersion = exports.streamToPromise = exports.versionStringToNumber = exports.filter = exports.rebase = exports.getVersion = exports.ensureDir = exports.rreddir = exports.rimraf = exports.rewriteSourceMappingURL = exports.appendOwnPathSourceURL = exports.$if = exports.stripSourceMappingURL = exports.loadSourcemaps = exports.cleanNodeModules = exports.skipDirectories = exports.toFileUri = exports.setExecutableBit = exports.fixWin32DirectoryPermissions = exports.debounce = exports.incremental = void 0;
const es = require("event-stream");
const _debounce = require("debounce");
const _filter = require("gulp-filter");
const rename = require("gulp-rename");
const path = require("path");
const fs = require("fs");
const _rimraf = require("rimraf");
const VinylFile = require("vinyl");
const url_1 = require("url");
const ternaryStream = require("ternary-stream");
const git = require("./git"); // {{SQL CARBON EDIT}} - add for get version
const root = path.dirname(path.dirname(__dirname));
const NoCancellationToken = { isCancellationRequested: () => false };
function incremental(streamProvider, initial, supportsCancellation) {
    const input = es.through();
    const output = es.through();
    let state = 'idle';
    let buffer = Object.create(null);
    const token = !supportsCancellation ? undefined : { isCancellationRequested: () => Object.keys(buffer).length > 0 };
    const run = (input, isCancellable) => {
        state = 'running';
        const stream = !supportsCancellation ? streamProvider() : streamProvider(isCancellable ? token : NoCancellationToken);
        input
            .pipe(stream)
            .pipe(es.through(undefined, () => {
            state = 'idle';
            eventuallyRun();
        }))
            .pipe(output);
    };
    if (initial) {
        run(initial, false);
    }
    const eventuallyRun = _debounce(() => {
        const paths = Object.keys(buffer);
        if (paths.length === 0) {
            return;
        }
        const data = paths.map(path => buffer[path]);
        buffer = Object.create(null);
        run(es.readArray(data), true);
    }, 500);
    input.on('data', (f) => {
        buffer[f.path] = f;
        if (state === 'idle') {
            eventuallyRun();
        }
    });
    return es.duplex(input, output);
}
exports.incremental = incremental;
function debounce(task) {
    const input = es.through();
    const output = es.through();
    let state = 'idle';
    const run = () => {
        state = 'running';
        task()
            .pipe(es.through(undefined, () => {
            const shouldRunAgain = state === 'stale';
            state = 'idle';
            if (shouldRunAgain) {
                eventuallyRun();
            }
        }))
            .pipe(output);
    };
    run();
    const eventuallyRun = _debounce(() => run(), 500);
    input.on('data', () => {
        if (state === 'idle') {
            eventuallyRun();
        }
        else {
            state = 'stale';
        }
    });
    return es.duplex(input, output);
}
exports.debounce = debounce;
function fixWin32DirectoryPermissions() {
    if (!/win32/.test(process.platform)) {
        return es.through();
    }
    return es.mapSync(f => {
        if (f.stat && f.stat.isDirectory && f.stat.isDirectory()) {
            f.stat.mode = 16877;
        }
        return f;
    });
}
exports.fixWin32DirectoryPermissions = fixWin32DirectoryPermissions;
function setExecutableBit(pattern) {
    const setBit = es.mapSync(f => {
        if (!f.stat) {
            f.stat = { isFile() { return true; } };
        }
        f.stat.mode = /* 100755 */ 33261;
        return f;
    });
    if (!pattern) {
        return setBit;
    }
    const input = es.through();
    const filter = _filter(pattern, { restore: true });
    const output = input
        .pipe(filter)
        .pipe(setBit)
        .pipe(filter.restore);
    return es.duplex(input, output);
}
exports.setExecutableBit = setExecutableBit;
function toFileUri(filePath) {
    const match = filePath.match(/^([a-z])\:(.*)$/i);
    if (match) {
        filePath = '/' + match[1].toUpperCase() + ':' + match[2];
    }
    return 'file://' + filePath.replace(/\\/g, '/');
}
exports.toFileUri = toFileUri;
function skipDirectories() {
    return es.mapSync(f => {
        if (!f.isDirectory()) {
            return f;
        }
    });
}
exports.skipDirectories = skipDirectories;
function cleanNodeModules(rulePath) {
    const rules = fs.readFileSync(rulePath, 'utf8')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(line => line && !/^#/.test(line));
    const excludes = rules.filter(line => !/^!/.test(line)).map(line => `!**/node_modules/${line}`);
    const includes = rules.filter(line => /^!/.test(line)).map(line => `**/node_modules/${line.substr(1)}`);
    const input = es.through();
    const output = es.merge(input.pipe(_filter(['**', ...excludes])), input.pipe(_filter(includes)));
    return es.duplex(input, output);
}
exports.cleanNodeModules = cleanNodeModules;
function loadSourcemaps() {
    const input = es.through();
    const output = input
        .pipe(es.map((f, cb) => {
        if (f.sourceMap) {
            cb(undefined, f);
            return;
        }
        if (!f.contents) {
            cb(undefined, f);
            return;
        }
        const contents = f.contents.toString('utf8');
        const reg = /\/\/# sourceMappingURL=(.*)$/g;
        let lastMatch = null;
        let match = null;
        while (match = reg.exec(contents)) {
            lastMatch = match;
        }
        if (!lastMatch) {
            f.sourceMap = {
                version: '3',
                names: [],
                mappings: '',
                sources: [f.relative],
                sourcesContent: [contents]
            };
            cb(undefined, f);
            return;
        }
        f.contents = Buffer.from(contents.replace(/\/\/# sourceMappingURL=(.*)$/g, ''), 'utf8');
        fs.readFile(path.join(path.dirname(f.path), lastMatch[1]), 'utf8', (err, contents) => {
            if (err) {
                return cb(err);
            }
            f.sourceMap = JSON.parse(contents);
            cb(undefined, f);
        });
    }));
    return es.duplex(input, output);
}
exports.loadSourcemaps = loadSourcemaps;
function stripSourceMappingURL() {
    const input = es.through();
    const output = input
        .pipe(es.mapSync(f => {
        const contents = f.contents.toString('utf8');
        f.contents = Buffer.from(contents.replace(/\n\/\/# sourceMappingURL=(.*)$/gm, ''), 'utf8');
        return f;
    }));
    return es.duplex(input, output);
}
exports.stripSourceMappingURL = stripSourceMappingURL;
/** Splits items in the stream based on the predicate, sending them to onTrue if true, or onFalse otherwise */
function $if(test, onTrue, onFalse = es.through()) {
    if (typeof test === 'boolean') {
        return test ? onTrue : onFalse;
    }
    return ternaryStream(test, onTrue, onFalse);
}
exports.$if = $if;
/** Operator that appends the js files' original path a sourceURL, so debug locations map */
function appendOwnPathSourceURL() {
    const input = es.through();
    const output = input
        .pipe(es.mapSync(f => {
        if (!(f.contents instanceof Buffer)) {
            throw new Error(`contents of ${f.path} are not a buffer`);
        }
        f.contents = Buffer.concat([f.contents, Buffer.from(`\n//# sourceURL=${(0, url_1.pathToFileURL)(f.path)}`)]);
        return f;
    }));
    return es.duplex(input, output);
}
exports.appendOwnPathSourceURL = appendOwnPathSourceURL;
function rewriteSourceMappingURL(sourceMappingURLBase) {
    const input = es.through();
    const output = input
        .pipe(es.mapSync(f => {
        const contents = f.contents.toString('utf8');
        const str = `//# sourceMappingURL=${sourceMappingURLBase}/${path.dirname(f.relative).replace(/\\/g, '/')}/$1`;
        f.contents = Buffer.from(contents.replace(/\n\/\/# sourceMappingURL=((?!data:).*)$/gm, str)); // {{SQL CARBON EDIT}} Don't rewrite embedded source maps - some of our dependencies have these (sanitize-html)
        return f;
    }));
    return es.duplex(input, output);
}
exports.rewriteSourceMappingURL = rewriteSourceMappingURL;
function rimraf(dir) {
    const result = () => new Promise((c, e) => {
        let retries = 0;
        const retry = () => {
            _rimraf(dir, { maxBusyTries: 1 }, (err) => {
                if (!err) {
                    return c();
                }
                if (err.code === 'ENOTEMPTY' && ++retries < 5) {
                    return setTimeout(() => retry(), 10);
                }
                return e(err);
            });
        };
        retry();
    });
    result.taskName = `clean-${path.basename(dir).toLowerCase()}`;
    return result;
}
exports.rimraf = rimraf;
function _rreaddir(dirPath, prepend, result) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            _rreaddir(path.join(dirPath, entry.name), `${prepend}/${entry.name}`, result);
        }
        else {
            result.push(`${prepend}/${entry.name}`);
        }
    }
}
function rreddir(dirPath) {
    const result = [];
    _rreaddir(dirPath, '', result);
    return result;
}
exports.rreddir = rreddir;
function ensureDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        return;
    }
    ensureDir(path.dirname(dirPath));
    fs.mkdirSync(dirPath);
}
exports.ensureDir = ensureDir;
function getVersion(root) {
    let version = process.env['VSCODE_DISTRO_COMMIT'] || process.env['BUILD_SOURCEVERSION'];
    if (!version || !/^[0-9a-f]{40}$/i.test(version.trim())) {
        version = git.getVersion(root);
    }
    return version;
}
exports.getVersion = getVersion;
function rebase(count) {
    return rename(f => {
        const parts = f.dirname ? f.dirname.split(/[\/\\]/) : [];
        f.dirname = parts.slice(count).join(path.sep);
    });
}
exports.rebase = rebase;
function filter(fn) {
    const result = es.through(function (data) {
        if (fn(data)) {
            this.emit('data', data);
        }
        else {
            result.restore.push(data);
        }
    });
    result.restore = es.through();
    return result;
}
exports.filter = filter;
function versionStringToNumber(versionStr) {
    const semverRegex = /(\d+)\.(\d+)\.(\d+)/;
    const match = versionStr.match(semverRegex);
    if (!match) {
        throw new Error('Version string is not properly formatted: ' + versionStr);
    }
    return parseInt(match[1], 10) * 1e4 + parseInt(match[2], 10) * 1e2 + parseInt(match[3], 10);
}
exports.versionStringToNumber = versionStringToNumber;
function streamToPromise(stream) {
    return new Promise((c, e) => {
        stream.on('error', err => e(err));
        stream.on('end', () => c());
    });
}
exports.streamToPromise = streamToPromise;
function getElectronVersion() {
    const yarnrc = fs.readFileSync(path.join(root, '.yarnrc'), 'utf8');
    const target = /^target "(.*)"$/m.exec(yarnrc)[1];
    return target;
}
exports.getElectronVersion = getElectronVersion;
function acquireWebNodePaths() {
    const root = path.join(__dirname, '..', '..');
    const webPackageJSON = path.join(root, '/remote/web', 'package.json');
    const webPackages = JSON.parse(fs.readFileSync(webPackageJSON, 'utf8')).dependencies;
    const distroWebPackageJson = path.join(root, '.build/distro/npm/remote/web/package.json');
    if (fs.existsSync(distroWebPackageJson)) {
        const distroWebPackages = JSON.parse(fs.readFileSync(distroWebPackageJson, 'utf8')).dependencies;
        Object.assign(webPackages, distroWebPackages);
    }
    const nodePaths = {};
    for (const key of Object.keys(webPackages)) {
        const packageJSON = path.join(root, 'node_modules', key, 'package.json');
        const packageData = JSON.parse(fs.readFileSync(packageJSON, 'utf8'));
        // Only cases where the browser is a string are handled
        let entryPoint = typeof packageData.browser === 'string' ? packageData.browser : packageData.main;
        // On rare cases a package doesn't have an entrypoint so we assume it has a dist folder with a min.js
        if (!entryPoint) {
            // TODO @lramos15 remove this when jschardet adds an entrypoint so we can warn on all packages w/out entrypoint
            if (key !== 'jschardet') {
                console.warn(`No entry point for ${key} assuming dist/${key}.min.js`);
            }
            entryPoint = `dist/${key}.min.js`;
        }
        // Remove any starting path information so it's all relative info
        if (entryPoint.startsWith('./')) {
            entryPoint = entryPoint.substring(2);
        }
        else if (entryPoint.startsWith('/')) {
            entryPoint = entryPoint.substring(1);
        }
        // Search for a minified entrypoint as well
        if (/(?<!\.min)\.js$/i.test(entryPoint)) {
            const minEntryPoint = entryPoint.replace(/\.js$/i, '.min.js');
            if (fs.existsSync(path.join(root, 'node_modules', key, minEntryPoint))) {
                entryPoint = minEntryPoint;
            }
        }
        nodePaths[key] = entryPoint;
    }
    // @TODO lramos15 can we make this dynamic like the rest of the node paths
    // Add these paths as well for 1DS SDK dependencies.
    // Not sure why given the 1DS entrypoint then requires these modules
    // they are not fetched from the right location and instead are fetched from out/
    nodePaths['@microsoft/dynamicproto-js'] = 'lib/dist/umd/dynamicproto-js.min.js';
    nodePaths['@microsoft/applicationinsights-shims'] = 'dist/umd/applicationinsights-shims.min.js';
    nodePaths['@microsoft/applicationinsights-core-js'] = 'browser/applicationinsights-core-js.min.js';
    return nodePaths;
}
exports.acquireWebNodePaths = acquireWebNodePaths;
function createExternalLoaderConfig(webEndpoint, commit, quality) {
    if (!webEndpoint || !commit || !quality) {
        return undefined;
    }
    webEndpoint = webEndpoint + `/${quality}/${commit}`;
    const nodePaths = acquireWebNodePaths();
    Object.keys(nodePaths).map(function (key, _) {
        nodePaths[key] = `../node_modules/${key}/${nodePaths[key]}`;
    });
    const externalLoaderConfig = {
        baseUrl: `${webEndpoint}/out`,
        recordStats: true,
        paths: nodePaths
    };
    return externalLoaderConfig;
}
exports.createExternalLoaderConfig = createExternalLoaderConfig;
function buildWebNodePaths(outDir) {
    const result = () => new Promise((resolve, _) => {
        const root = path.join(__dirname, '..', '..');
        const nodePaths = acquireWebNodePaths();
        // Now we write the node paths to out/vs
        const outDirectory = path.join(root, outDir, 'vs');
        fs.mkdirSync(outDirectory, { recursive: true });
        const headerWithGeneratedFileWarning = `/*---------------------------------------------------------------------------------------------
	 *  Copyright (c) Microsoft Corporation. All rights reserved.
	 *  Licensed under the Source EULA. See License.txt in the project root for license information.
	 *--------------------------------------------------------------------------------------------*/

	// This file is generated by build/npm/postinstall.js. Do not edit.`;
        const fileContents = `${headerWithGeneratedFileWarning}\nself.webPackagePaths = ${JSON.stringify(nodePaths, null, 2)};`;
        fs.writeFileSync(path.join(outDirectory, 'webPackagePaths.js'), fileContents, 'utf8');
        resolve();
    });
    result.taskName = 'build-web-node-paths';
    return result;
}
exports.buildWebNodePaths = buildWebNodePaths;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFFaEcsbUNBQW1DO0FBQ25DLHNDQUF1QztBQUN2Qyx1Q0FBdUM7QUFDdkMsc0NBQXNDO0FBQ3RDLDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFDekIsa0NBQWtDO0FBQ2xDLG1DQUFtQztBQUduQyw2QkFBb0M7QUFDcEMsZ0RBQWdEO0FBQ2hELDZCQUE2QixDQUFDLDRDQUE0QztBQUUxRSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQU1uRCxNQUFNLG1CQUFtQixHQUF1QixFQUFFLHVCQUF1QixFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBTXpGLFNBQWdCLFdBQVcsQ0FBQyxjQUErQixFQUFFLE9BQStCLEVBQUUsb0JBQThCO0lBQzNILE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUMzQixNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDNUIsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDO0lBQ25CLElBQUksTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFakMsTUFBTSxLQUFLLEdBQW1DLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSx1QkFBdUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUVwSixNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQTZCLEVBQUUsYUFBc0IsRUFBRSxFQUFFO1FBQ3JFLEtBQUssR0FBRyxTQUFTLENBQUM7UUFFbEIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUV0SCxLQUFLO2FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQzthQUNaLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7WUFDaEMsS0FBSyxHQUFHLE1BQU0sQ0FBQztZQUNmLGFBQWEsRUFBRSxDQUFDO1FBQ2pCLENBQUMsQ0FBQyxDQUFDO2FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hCLENBQUMsQ0FBQztJQUVGLElBQUksT0FBTyxFQUFFO1FBQ1osR0FBRyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztLQUNwQjtJQUVELE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxHQUFHLEVBQUU7UUFDcEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVsQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3ZCLE9BQU87U0FDUDtRQUVELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM3QyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixHQUFHLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMvQixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFUixLQUFLLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQU0sRUFBRSxFQUFFO1FBQzNCLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRW5CLElBQUksS0FBSyxLQUFLLE1BQU0sRUFBRTtZQUNyQixhQUFhLEVBQUUsQ0FBQztTQUNoQjtJQUNGLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBL0NELGtDQStDQztBQUVELFNBQWdCLFFBQVEsQ0FBQyxJQUFrQztJQUMxRCxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDM0IsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzVCLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQztJQUVuQixNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUU7UUFDaEIsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUVsQixJQUFJLEVBQUU7YUFDSixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO1lBQ2hDLE1BQU0sY0FBYyxHQUFHLEtBQUssS0FBSyxPQUFPLENBQUM7WUFDekMsS0FBSyxHQUFHLE1BQU0sQ0FBQztZQUVmLElBQUksY0FBYyxFQUFFO2dCQUNuQixhQUFhLEVBQUUsQ0FBQzthQUNoQjtRQUNGLENBQUMsQ0FBQyxDQUFDO2FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hCLENBQUMsQ0FBQztJQUVGLEdBQUcsRUFBRSxDQUFDO0lBRU4sTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRWxELEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNyQixJQUFJLEtBQUssS0FBSyxNQUFNLEVBQUU7WUFDckIsYUFBYSxFQUFFLENBQUM7U0FDaEI7YUFBTTtZQUNOLEtBQUssR0FBRyxPQUFPLENBQUM7U0FDaEI7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQWpDRCw0QkFpQ0M7QUFFRCxTQUFnQiw0QkFBNEI7SUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ3BDLE9BQU8sRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQ3BCO0lBRUQsT0FBTyxFQUFFLENBQUMsT0FBTyxDQUF1QixDQUFDLENBQUMsRUFBRTtRQUMzQyxJQUFJLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUN6RCxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7U0FDcEI7UUFFRCxPQUFPLENBQUMsQ0FBQztJQUNWLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQVpELG9FQVlDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsT0FBMkI7SUFDM0QsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBdUIsQ0FBQyxDQUFDLEVBQUU7UUFDbkQsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUU7WUFDWixDQUFDLENBQUMsSUFBSSxHQUFHLEVBQUUsTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFTLENBQUM7U0FDOUM7UUFDRCxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2IsT0FBTyxNQUFNLENBQUM7S0FDZDtJQUVELE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUMzQixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbkQsTUFBTSxNQUFNLEdBQUcsS0FBSztTQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDO1NBQ1osSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUNaLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFdkIsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBckJELDRDQXFCQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxRQUFnQjtJQUN6QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFakQsSUFBSSxLQUFLLEVBQUU7UUFDVixRQUFRLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3pEO0lBRUQsT0FBTyxTQUFTLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDakQsQ0FBQztBQVJELDhCQVFDO0FBRUQsU0FBZ0IsZUFBZTtJQUM5QixPQUFPLEVBQUUsQ0FBQyxPQUFPLENBQW1DLENBQUMsQ0FBQyxFQUFFO1FBQ3ZELElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDckIsT0FBTyxDQUFDLENBQUM7U0FDVDtJQUNGLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQU5ELDBDQU1DO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsUUFBZ0I7SUFDaEQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDO1NBQzdDLEtBQUssQ0FBQyxRQUFRLENBQUM7U0FDZixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRTNDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNoRyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUV4RyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDM0IsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FDdEIsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQ3hDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQzdCLENBQUM7SUFFRixPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFoQkQsNENBZ0JDO0FBTUQsU0FBZ0IsY0FBYztJQUM3QixNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFM0IsTUFBTSxNQUFNLEdBQUcsS0FBSztTQUNsQixJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBMkMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUE2QixFQUFFO1FBQzNGLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtZQUNoQixFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE9BQU87U0FDUDtRQUVELElBQUksQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO1lBQ2hCLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDakIsT0FBTztTQUNQO1FBRUQsTUFBTSxRQUFRLEdBQVksQ0FBQyxDQUFDLFFBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdkQsTUFBTSxHQUFHLEdBQUcsK0JBQStCLENBQUM7UUFDNUMsSUFBSSxTQUFTLEdBQTJCLElBQUksQ0FBQztRQUM3QyxJQUFJLEtBQUssR0FBMkIsSUFBSSxDQUFDO1FBRXpDLE9BQU8sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDbEMsU0FBUyxHQUFHLEtBQUssQ0FBQztTQUNsQjtRQUVELElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDZixDQUFDLENBQUMsU0FBUyxHQUFHO2dCQUNiLE9BQU8sRUFBRSxHQUFHO2dCQUNaLEtBQUssRUFBRSxFQUFFO2dCQUNULFFBQVEsRUFBRSxFQUFFO2dCQUNaLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ3JCLGNBQWMsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUMxQixDQUFDO1lBRUYsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNqQixPQUFPO1NBQ1A7UUFFRCxDQUFDLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQywrQkFBK0IsRUFBRSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV4RixFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxFQUFFO1lBQ3BGLElBQUksR0FBRyxFQUFFO2dCQUFFLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQUU7WUFFNUIsQ0FBQyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ25DLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUwsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBakRELHdDQWlEQztBQUVELFNBQWdCLHFCQUFxQjtJQUNwQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFM0IsTUFBTSxNQUFNLEdBQUcsS0FBSztTQUNsQixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBdUIsQ0FBQyxDQUFDLEVBQUU7UUFDMUMsTUFBTSxRQUFRLEdBQVksQ0FBQyxDQUFDLFFBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkQsQ0FBQyxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsa0NBQWtDLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDM0YsT0FBTyxDQUFDLENBQUM7SUFDVixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUwsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBWEQsc0RBV0M7QUFFRCw4R0FBOEc7QUFDOUcsU0FBZ0IsR0FBRyxDQUFDLElBQTJDLEVBQUUsTUFBOEIsRUFBRSxVQUFrQyxFQUFFLENBQUMsT0FBTyxFQUFFO0lBQzlJLElBQUksT0FBTyxJQUFJLEtBQUssU0FBUyxFQUFFO1FBQzlCLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztLQUMvQjtJQUVELE9BQU8sYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQU5ELGtCQU1DO0FBRUQsNEZBQTRGO0FBQzVGLFNBQWdCLHNCQUFzQjtJQUNyQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFM0IsTUFBTSxNQUFNLEdBQUcsS0FBSztTQUNsQixJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBdUIsQ0FBQyxDQUFDLEVBQUU7UUFDMUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsWUFBWSxNQUFNLENBQUMsRUFBRTtZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksbUJBQW1CLENBQUMsQ0FBQztTQUMxRDtRQUVELENBQUMsQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsSUFBQSxtQkFBYSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xHLE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVMLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQWRELHdEQWNDO0FBRUQsU0FBZ0IsdUJBQXVCLENBQUMsb0JBQTRCO0lBQ25FLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUUzQixNQUFNLE1BQU0sR0FBRyxLQUFLO1NBQ2xCLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUF1QixDQUFDLENBQUMsRUFBRTtRQUMxQyxNQUFNLFFBQVEsR0FBWSxDQUFDLENBQUMsUUFBUyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLEdBQUcsR0FBRyx3QkFBd0Isb0JBQW9CLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDO1FBQzlHLENBQUMsQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLDJDQUEyQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQywrR0FBK0c7UUFDN00sT0FBTyxDQUFDLENBQUM7SUFDVixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRUwsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBWkQsMERBWUM7QUFFRCxTQUFnQixNQUFNLENBQUMsR0FBVztJQUNqQyxNQUFNLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMvQyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7UUFFaEIsTUFBTSxLQUFLLEdBQUcsR0FBRyxFQUFFO1lBQ2xCLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFRLEVBQUUsRUFBRTtnQkFDOUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtvQkFDVCxPQUFPLENBQUMsRUFBRSxDQUFDO2lCQUNYO2dCQUVELElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxXQUFXLElBQUksRUFBRSxPQUFPLEdBQUcsQ0FBQyxFQUFFO29CQUM5QyxPQUFPLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztpQkFDckM7Z0JBRUQsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDZixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUVGLEtBQUssRUFBRSxDQUFDO0lBQ1QsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsUUFBUSxHQUFHLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO0lBQzlELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQXZCRCx3QkF1QkM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxPQUFlLEVBQUUsT0FBZSxFQUFFLE1BQWdCO0lBQ3BFLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDakUsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLEVBQUU7UUFDNUIsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDeEIsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDOUU7YUFBTTtZQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7U0FDeEM7S0FDRDtBQUNGLENBQUM7QUFFRCxTQUFnQixPQUFPLENBQUMsT0FBZTtJQUN0QyxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFDNUIsU0FBUyxDQUFDLE9BQU8sRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0IsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBSkQsMEJBSUM7QUFFRCxTQUFnQixTQUFTLENBQUMsT0FBZTtJQUN4QyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDM0IsT0FBTztLQUNQO0lBQ0QsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqQyxFQUFFLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZCLENBQUM7QUFORCw4QkFNQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxJQUFZO0lBQ3RDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFFeEYsSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRTtRQUN4RCxPQUFPLEdBQUcsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUMvQjtJQUVELE9BQU8sT0FBTyxDQUFDO0FBQ2hCLENBQUM7QUFSRCxnQ0FRQztBQUVELFNBQWdCLE1BQU0sQ0FBQyxLQUFhO0lBQ25DLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2pCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDekQsQ0FBQyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBTEQsd0JBS0M7QUFNRCxTQUFnQixNQUFNLENBQUMsRUFBMEI7SUFDaEQsTUFBTSxNQUFNLEdBQXNCLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJO1FBQzFELElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDeEI7YUFBTTtZQUNOLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQzFCO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUM5QixPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFYRCx3QkFXQztBQUVELFNBQWdCLHFCQUFxQixDQUFDLFVBQWtCO0lBQ3ZELE1BQU0sV0FBVyxHQUFHLHFCQUFxQixDQUFDO0lBQzFDLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDNUMsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLEdBQUcsVUFBVSxDQUFDLENBQUM7S0FDM0U7SUFFRCxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDN0YsQ0FBQztBQVJELHNEQVFDO0FBRUQsU0FBZ0IsZUFBZSxDQUFDLE1BQThCO0lBQzdELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDM0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNsQyxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzdCLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUxELDBDQUtDO0FBRUQsU0FBZ0Isa0JBQWtCO0lBQ2pDLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbkUsTUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25ELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUpELGdEQUlDO0FBRUQsU0FBZ0IsbUJBQW1CO0lBQ2xDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5QyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDdEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQztJQUVyRixNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDJDQUEyQyxDQUFDLENBQUM7SUFDMUYsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLEVBQUU7UUFDeEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7UUFDakcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztLQUM5QztJQUVELE1BQU0sU0FBUyxHQUE4QixFQUFFLENBQUM7SUFDaEQsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFO1FBQzNDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxHQUFHLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDekUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLHVEQUF1RDtRQUN2RCxJQUFJLFVBQVUsR0FBVyxPQUFPLFdBQVcsQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1FBRTFHLHFHQUFxRztRQUNyRyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2hCLCtHQUErRztZQUMvRyxJQUFJLEdBQUcsS0FBSyxXQUFXLEVBQUU7Z0JBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsa0JBQWtCLEdBQUcsU0FBUyxDQUFDLENBQUM7YUFDdEU7WUFFRCxVQUFVLEdBQUcsUUFBUSxHQUFHLFNBQVMsQ0FBQztTQUNsQztRQUVELGlFQUFpRTtRQUNqRSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDckM7YUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDdEMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDckM7UUFFRCwyQ0FBMkM7UUFDM0MsSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDeEMsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFFOUQsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUMsRUFBRTtnQkFDdkUsVUFBVSxHQUFHLGFBQWEsQ0FBQzthQUMzQjtTQUNEO1FBRUQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztLQUM1QjtJQUVELDBFQUEwRTtJQUMxRSxvREFBb0Q7SUFDcEQsb0VBQW9FO0lBQ3BFLGlGQUFpRjtJQUNqRixTQUFTLENBQUMsNEJBQTRCLENBQUMsR0FBRyxxQ0FBcUMsQ0FBQztJQUNoRixTQUFTLENBQUMsc0NBQXNDLENBQUMsR0FBRywyQ0FBMkMsQ0FBQztJQUNoRyxTQUFTLENBQUMsd0NBQXdDLENBQUMsR0FBRyw0Q0FBNEMsQ0FBQztJQUNuRyxPQUFPLFNBQVMsQ0FBQztBQUNsQixDQUFDO0FBdkRELGtEQXVEQztBQVFELFNBQWdCLDBCQUEwQixDQUFDLFdBQW9CLEVBQUUsTUFBZSxFQUFFLE9BQWdCO0lBQ2pHLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDeEMsT0FBTyxTQUFTLENBQUM7S0FDakI7SUFDRCxXQUFXLEdBQUcsV0FBVyxHQUFHLElBQUksT0FBTyxJQUFJLE1BQU0sRUFBRSxDQUFDO0lBQ3BELE1BQU0sU0FBUyxHQUFHLG1CQUFtQixFQUFFLENBQUM7SUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUMxQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsbUJBQW1CLEdBQUcsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUM3RCxDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sb0JBQW9CLEdBQXdCO1FBQ2pELE9BQU8sRUFBRSxHQUFHLFdBQVcsTUFBTTtRQUM3QixXQUFXLEVBQUUsSUFBSTtRQUNqQixLQUFLLEVBQUUsU0FBUztLQUNoQixDQUFDO0lBQ0YsT0FBTyxvQkFBb0IsQ0FBQztBQUM3QixDQUFDO0FBZkQsZ0VBZUM7QUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxNQUFjO0lBQy9DLE1BQU0sTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ3JELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM5QyxNQUFNLFNBQVMsR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3hDLHdDQUF3QztRQUN4QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkQsRUFBRSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNoRCxNQUFNLDhCQUE4QixHQUFHOzs7OztxRUFLNEIsQ0FBQztRQUNwRSxNQUFNLFlBQVksR0FBRyxHQUFHLDhCQUE4Qiw0QkFBNEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDeEgsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxvQkFBb0IsQ0FBQyxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN0RixPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxDQUFDLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQztJQUN6QyxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFuQkQsOENBbUJDIn0=