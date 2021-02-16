/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchTask = exports.compileTask = void 0;
const es = require("event-stream");
const fs = require("fs");
const gulp = require("gulp");
const bom = require("gulp-bom");
const sourcemaps = require("gulp-sourcemaps");
const tsb = require("gulp-tsb");
const path = require("path");
// import * as monacodts from '../monaco/api';
const nls = require("./nls");
const reporter_1 = require("./reporter");
const util = require("./util");
// import * as fancyLog from 'fancy-log';
// import * as ansiColors from 'ansi-colors';
const os = require("os");
const watch = require('./watch');
const reporter = reporter_1.createReporter();
function getTypeScriptCompilerOptions(src) {
    const rootDir = path.join(__dirname, `../../${src}`);
    let options = {};
    options.verbose = false;
    options.sourceMap = true;
    if (process.env['VSCODE_NO_SOURCEMAP']) { // To be used by developers in a hurry
        options.sourceMap = false;
    }
    options.rootDir = rootDir;
    options.baseUrl = rootDir;
    options.sourceRoot = util.toFileUri(rootDir);
    options.newLine = /\r\n/.test(fs.readFileSync(__filename, 'utf8')) ? 0 : 1;
    return options;
}
function createCompile(src, build, emitError) {
    const projectPath = path.join(__dirname, '../../', src, 'tsconfig.json');
    const overrideOptions = Object.assign(Object.assign({}, getTypeScriptCompilerOptions(src)), { inlineSources: Boolean(build) });
    const compilation = tsb.create(projectPath, overrideOptions, false, err => reporter(err));
    function pipeline(token) {
        const utf8Filter = util.filter(data => /(\/|\\)test(\/|\\).*utf8/.test(data.path));
        const tsFilter = util.filter(data => /\.ts$/.test(data.path));
        const noDeclarationsFilter = util.filter(data => !(/\.d\.ts$/.test(data.path)));
        const input = es.through();
        const output = input
            .pipe(utf8Filter)
            .pipe(bom()) // this is required to preserve BOM in test files that loose it otherwise
            .pipe(utf8Filter.restore)
            .pipe(tsFilter)
            .pipe(util.loadSourcemaps())
            .pipe(compilation(token))
            .pipe(noDeclarationsFilter)
            .pipe(build ? nls() : es.through())
            .pipe(noDeclarationsFilter.restore)
            .pipe(sourcemaps.write('.', {
            addComment: false,
            includeContent: !!build,
            sourceRoot: overrideOptions.sourceRoot
        }))
            .pipe(tsFilter.restore)
            .pipe(reporter.end(!!emitError));
        return es.duplex(input, output);
    }
    pipeline.tsProjectSrc = () => {
        return compilation.src({ base: src });
    };
    return pipeline;
}
function compileTask(src, out, build) {
    return function () {
        if (os.totalmem() < 4000000000) {
            throw new Error('compilation requires 4GB of RAM');
        }
        const compile = createCompile(src, build, true);
        const srcPipe = gulp.src(`${src}/**`, { base: `${src}` });
        /* {{SQL CARBON EDIT}} Remove Monaco generator
        let generator = new MonacoGenerator(false);
        if (src === 'src') {
            generator.execute();
        }
        */
        return srcPipe
            //.pipe(generator.stream) {{SQL CARBON EDIT}} Remove Monaco generator
            .pipe(compile())
            .pipe(gulp.dest(out));
    };
}
exports.compileTask = compileTask;
function watchTask(out, build) {
    return function () {
        const compile = createCompile('src', build);
        const src = gulp.src('src/**', { base: 'src' });
        const watchSrc = watch('src/**', { base: 'src', readDelay: 200 });
        // let generator = new MonacoGenerator(true); {{SQL CARBON EDIT}} Remove Monaco generator
        // generator.execute(); {{SQL CARBON EDIT}} Remove Monaco generator
        return watchSrc
            // .pipe(generator.stream) {{SQL CARBON EDIT}} Remove Monaco generator
            .pipe(util.incremental(compile, src, true))
            .pipe(gulp.dest(out));
    };
}
exports.watchTask = watchTask;
