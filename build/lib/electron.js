"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const fs = require("fs");
const path = require("path");
const vfs = require("vinyl-fs");
const filter = require("gulp-filter");
const _ = require("underscore");
const util = require("./util");
const getVersion_1 = require("./getVersion");
function isDocumentSuffix(str) {
    return str === 'document' || str === 'script' || str === 'file' || str === 'source code';
}
const root = path.dirname(path.dirname(__dirname));
const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));
const commit = (0, getVersion_1.getVersion)(root);
const darwinCreditsTemplate = product.darwinCredits && _.template(fs.readFileSync(path.join(root, product.darwinCredits), 'utf8'));
/**
 * Generate a `DarwinDocumentType` given a list of file extensions, an icon name, and an optional suffix or file type name.
 * @param extensions A list of file extensions, such as `['bat', 'cmd']`
 * @param icon A sentence-cased file type name that matches the lowercase name of a darwin icon resource.
 * For example, `'HTML'` instead of `'html'`, or `'Java'` instead of `'java'`.
 * This parameter is lowercased before it is used to reference an icon file.
 * @param nameOrSuffix An optional suffix or a string to use as the file type. If a suffix is provided,
 * it is used with the icon parameter to generate a file type string. If nothing is provided,
 * `'document'` is used with the icon parameter to generate file type string.
 *
 * For example, if you call `darwinBundleDocumentType(..., 'HTML')`, the resulting file type is `"HTML document"`,
 * and the `'html'` darwin icon is used.
 *
 * If you call `darwinBundleDocumentType(..., 'Javascript', 'file')`, the resulting file type is `"Javascript file"`.
 * and the `'javascript'` darwin icon is used.
 *
 * If you call `darwinBundleDocumentType(..., 'bat', 'Windows command script')`, the file type is `"Windows command script"`,
 * and the `'bat'` darwin icon is used.
 */
function darwinBundleDocumentType(extensions, icon, nameOrSuffix, utis) {
    // If given a suffix, generate a name from it. If not given anything, default to 'document'
    if (isDocumentSuffix(nameOrSuffix) || !nameOrSuffix) {
        nameOrSuffix = icon.charAt(0).toUpperCase() + icon.slice(1) + ' ' + (nameOrSuffix ?? 'document');
    }
    return {
        name: nameOrSuffix,
        role: 'Editor',
        ostypes: ['TEXT', 'utxt', 'TUTX', '****'],
        extensions,
        iconFile: 'resources/darwin/' + icon + '.icns',
        utis
    };
}
/**
 * Generate several `DarwinDocumentType`s with unique names and a shared icon.
 * @param types A map of file type names to their associated file extensions.
 * @param icon A darwin icon resource to use. For example, `'HTML'` would refer to `resources/darwin/html.icns`
 *
 * Examples:
 * ```
 * darwinBundleDocumentTypes({ 'C header file': 'h', 'C source code': 'c' },'c')
 * darwinBundleDocumentTypes({ 'React source code': ['jsx', 'tsx'] }, 'react')
 * ```
 */
// {{SQL CARBON EDIT}} Remove unused
// function darwinBundleDocumentTypes(types: { [name: string]: string | string[] }, icon: string): DarwinDocumentType[] {
// 	return Object.keys(types).map((name: string): DarwinDocumentType => {
// 		const extensions = types[name];
// 		return {
//			name: name,
// 			role: 'Editor',
// 			ostypes: ['TEXT', 'utxt', 'TUTX', '****'],
// 			extensions: Array.isArray(extensions) ? extensions : [extensions],
//			iconFile: 'resources/darwin/' + icon + '.icns',
// 		} as DarwinDocumentType;
// 	});
// }
const { electronVersion, msBuildId } = util.getElectronVersion();
exports.config = {
    version: electronVersion,
    tag: product.electronRepository ? `v${electronVersion}-${msBuildId}` : undefined,
    productAppName: product.nameLong,
    companyName: 'Microsoft Corporation',
    copyright: 'Copyright (C) 2023 Microsoft. All rights reserved',
    darwinIcon: 'resources/darwin/code.icns',
    darwinBundleIdentifier: product.darwinBundleIdentifier,
    darwinApplicationCategoryType: 'public.app-category.developer-tools',
    darwinHelpBookFolder: 'VS Code HelpBook',
    darwinHelpBookName: 'VS Code HelpBook',
    darwinBundleDocumentTypes: [
        darwinBundleDocumentType(['csv', 'json', 'sqlplan', 'sql', 'xml'], 'code_file'),
    ],
    darwinBundleURLTypes: [{
            role: 'Viewer',
            name: product.nameLong,
            urlSchemes: [product.urlProtocol]
        }],
    darwinForceDarkModeSupport: true,
    darwinCredits: darwinCreditsTemplate ? Buffer.from(darwinCreditsTemplate({ commit: commit, date: new Date().toISOString() })) : undefined,
    linuxExecutableName: product.applicationName,
    winIcon: 'resources/win32/code.ico',
    token: process.env['GITHUB_TOKEN'],
    repo: product.electronRepository || undefined,
    validateChecksum: true,
    checksumFile: path.join(root, 'build', 'checksums', 'electron.txt'),
};
function getElectron(arch) {
    return () => {
        const electron = require('@vscode/gulp-electron');
        const json = require('gulp-json-editor');
        const electronOpts = _.extend({}, exports.config, {
            platform: process.platform,
            arch: arch === 'armhf' ? 'arm' : arch,
            ffmpegChromium: false,
            keepDefaultApp: true
        });
        return vfs.src('package.json')
            .pipe(json({ name: product.nameShort }))
            .pipe(electron(electronOpts))
            .pipe(filter(['**', '!**/app/package.json']))
            .pipe(vfs.dest('.build/electron'));
    };
}
async function main(arch = process.arch) {
    const version = electronVersion;
    const electronPath = path.join(root, '.build', 'electron');
    const versionFile = path.join(electronPath, 'version');
    const isUpToDate = fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8') === `${version}`;
    if (!isUpToDate) {
        await util.rimraf(electronPath)();
        await util.streamToPromise(getElectron(arch)());
    }
}
if (require.main === module) {
    main(process.argv[2]).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlY3Ryb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbGVjdHJvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7OztBQUVoRyx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLGdDQUFnQztBQUNoQyxzQ0FBc0M7QUFDdEMsZ0NBQWdDO0FBQ2hDLCtCQUErQjtBQUMvQiw2Q0FBMEM7QUFZMUMsU0FBUyxnQkFBZ0IsQ0FBQyxHQUFZO0lBQ3JDLE9BQU8sR0FBRyxLQUFLLFVBQVUsSUFBSSxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLGFBQWEsQ0FBQztBQUMxRixDQUFDO0FBRUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDbkQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDckYsTUFBTSxNQUFNLEdBQUcsSUFBQSx1QkFBVSxFQUFDLElBQUksQ0FBQyxDQUFDO0FBRWhDLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLGFBQWEsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFFbkk7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILFNBQVMsd0JBQXdCLENBQUMsVUFBb0IsRUFBRSxJQUFZLEVBQUUsWUFBNEMsRUFBRSxJQUFlO0lBQ2xJLDJGQUEyRjtJQUMzRixJQUFJLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFB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