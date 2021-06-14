/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as fs from 'fs';
import * as Is from 'is';
import * as path from 'path';
import * as gulp from 'gulp';
import * as glob from 'glob';
import rename = require('gulp-rename');
import { through, ThroughStream } from 'event-stream';
import * as File from 'vinyl';
import i18n = require('./i18n');
import ext = require('./extensions');

const root = path.dirname(path.dirname(__dirname));

const extensionsProject: string = 'extensions';

// Modified packageLocalExtensionsStream from extensions.ts, but for langpacks.
export function packageLangpacksStream(): NodeJS.ReadWriteStream {
	const langpackDescriptions = (<string[]>glob.sync('i18n/*/package.json'))
		.map(manifestPath => {
			const langpackPath = path.dirname(path.join(root, manifestPath));
			const langpackName = path.basename(langpackPath);
			return { name: langpackName, path: langpackPath };
		})

	const builtLangpacks = langpackDescriptions.map(langpack => {
		return ext.fromLocalNormal(langpack.path)
			.pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
	});

	return es.merge(builtLangpacks);
}

export function packageADSExtensionsStream(): NodeJS.ReadWriteStream {
	const currentADSJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../i18n/ADSExtensions.json'), 'utf8'));
	const ADSExtensions = currentADSJson.ADSExtensions;
	const extenalExtensionDescriptions = (<string[]>glob.sync('extensions/*/package.json'))
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})
		.filter(({ name }) => ADSExtensions[name] !== undefined);

	const builtExtensions = extenalExtensionDescriptions.map(extension => {
		return ext.fromLocal(extension.path, false)
			.pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
	});

	return es.merge(builtExtensions);
}

export function createXlfFilesForExtensions(): ThroughStream {
	let counter: number = 0;
	let folderStreamEnded: boolean = false;
	let folderStreamEndEmitted: boolean = false;
	return through(function (this: ThroughStream, extensionFolder: File) {
		const folderStream = this;
		const stat = fs.statSync(extensionFolder.path);
		if (!stat.isDirectory()) {
			return;
		}
		let extensionName = path.basename(extensionFolder.path);
		counter++;
		let _xlf: i18n.XLF;
		function getXlf() {
			if (!_xlf) {
				_xlf = new i18n.XLF(extensionsProject);
			}
			return _xlf;
		}
		gulp.src([`.locbuild/extensions/${extensionName}/package.nls.json`, `.locbuild/extensions/${extensionName}/**/nls.metadata.json`], { allowEmpty: true }).pipe(through(function (file: File) {
			if (file.isBuffer()) {
				const buffer: Buffer = file.contents as Buffer;
				const basename = path.basename(file.path);
				if (basename === 'package.nls.json') {
					const json: PackageJsonFormat = JSON.parse(buffer.toString('utf8'));
					const keys = Object.keys(json);
					const messages = keys.map((key) => {
						const value = json[key];
						if (Is.string(value)) {
							return value;
						} else if (value) {
							return value.message;
						} else {
							return `Unknown message for key: ${key}`;
						}
					});
					getXlf().addFile(`extensions/${extensionName}/package`, keys, messages);
				} else if (basename === 'nls.metadata.json') {
					const json: BundledExtensionFormat = JSON.parse(buffer.toString('utf8'));
					const relPath = path.relative(`.locbuild/extensions/${extensionName}`, path.dirname(file.path));
					for (let file in json) {
						const fileContent = json[file];
						getXlf().addFile(`extensions/${extensionName}/${relPath}/${file}`, fileContent.keys, fileContent.messages);
					}
				} else {
					this.emit('error', new Error(`${file.path} is not a valid extension nls file`));
					return;
				}
			}
		}, function () {
			if (_xlf) {
				let xlfFile = new File({
					path: path.join(extensionsProject, extensionName + '.xlf'),
					contents: Buffer.from(_xlf.toString(), 'utf8')
				});
				folderStream.queue(xlfFile);
			}
			this.queue(null);
			counter--;
			if (counter === 0 && folderStreamEnded && !folderStreamEndEmitted) {
				folderStreamEndEmitted = true;
				folderStream.queue(null);
			}
		}));
	}, function () {
		folderStreamEnded = true;
		if (counter === 0) {
			folderStreamEndEmitted = true;
			this.queue(null);
		}
	});
}

interface LocalizeInfo {
	key: string;
	comment: string[];
}

module LocalizeInfo {
	export function is(value: any): value is LocalizeInfo {
		let candidate = value as LocalizeInfo;
		return Is.defined(candidate) && Is.string(candidate.key) && (Is.undef(candidate.comment) || (Is.array(candidate.comment) && candidate.comment.every(element => Is.string(element))));
	}
}

interface PackageJsonFormat {
	[key: string]: string | ValueFormat;
}

interface ValueFormat {
	message: string;
	comment: string[];
}

interface BundledExtensionFormat {
	[key: string]: {
		messages: string[];
		keys: (string | LocalizeInfo)[];
	};
}

module PackageJsonFormat {
	export function is(value: any): value is PackageJsonFormat {
		if (Is.undef(value) || !Is.object(value)) {
			return false;
		}
		return Object.keys(value).every(key => {
			let element = value[key];
			return Is.string(element) || (Is.object(element) && Is.defined(element.message) && Is.defined(element.comment));
		});
	}
}
