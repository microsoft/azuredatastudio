/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SemVer } from 'semver';



function fourPart2SemVer(version: string): string {
	if (version.includes('-')) {
		//return unchanged if version contains a pre-release suffix
		return version;
		console.log(`TCL: SemVerProxy -> constructor -> ver: version includes '-'`, version);
	} else {
		let parts: string[] = version.split('.');
		if (parts.length > 3) {
			console.log(`TCL: SemVerProxy -> constructor -> ver: version has more than three '.'s`, version);
			version = `${parts[0]}.${parts[1]}.${parts[2]}+${parts.splice(0, 3).join('.')}`;
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

	constructor(version: string | SemVer, loose?: boolean) {
		let ver: string;
		if (version as SemVer) {
			ver = (version as SemVer).version;
			console.log(`TCL: SemVerProxy -> constructor -> ver: within version as SemVer`, ver);
		} else {
			ver = version as string;
			console.log(`TCL: SemVerProxy -> constructor -> ver: within version as string`, ver);
		}
		ver = fourPart2SemVer(ver);
		console.log(`TCL: SemVerProxy -> constructor -> ver: after converting to SemVer`, ver);
		super(ver, loose);
	}

	get version(): string {
		return super.version.replace('+', '.');

	}
}
