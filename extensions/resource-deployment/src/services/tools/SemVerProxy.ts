/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SemVer } from 'semver';



function fourPart2SemVer(version: string): string {
	if (version.includes('-')) {
		//return unchanged if version contains a pre-release suffix
		return version;
	} else {
		let parts: string[] = version.split('.');
		if (parts.length > 3) {
			version = `${parts[0]}.${parts[1]}.${parts[2]}+${parts.slice(3).join('.')}`;
		}
		return version;
	}
}

/**
 * This Proxy for SemVer behaves the same way as the SamVer except the build number of the SemVer specification at: https://semver.org/ is prefixed by a '.' as well instead of a '+'. So while the BNF for valid SemVer is:
			<valid semver> ::= <version core>
						| <version core> "-" <pre-release>
						| <version core> "+" <build>
						| <version core> "-" <pre-release> "+" <build>
			<version core> ::= <major> "." <minor> "." <patch>

		SemVerProxy support the following BNF:
			<valid semver> ::= <version core>
						| <version core> "-" <pre-release>
						| <version core> "." <build>
						| <version core> "-" <pre-release> "+" <build>
			<version core> ::= <major> "." <minor> "." <patch>
 */
export class SemVerProxy extends SemVer {
	private _version: string;

	constructor(version: string | SemVerProxy, loose?: boolean) {
		let ver: string;

		if (version instanceof SemVer) {
			ver = version.version;
			if (!ver) {
				throw new Error('Invalid version');
			}
		} else {
			ver = fourPart2SemVer(version);
		}
		super(ver, loose);
		if (ver.includes('-')) {
			this._version = ver;
		} else {
			this._version = ver.replace('+', '.'); // change back any '+' character used to delimit the build portion of the version with a '.'
		}
	}

	get version(): string {
		return this._version;
	}
}
