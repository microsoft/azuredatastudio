/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Errorable, failed } from '../interfaces';

interface CompatibilityGuaranteed {
    readonly guaranteed: true;
}

interface CompatibilityNotGuaranteed {
    readonly guaranteed: false;
    readonly didCheck: boolean;
    readonly clientVersion: string;
    readonly serverVersion: string;
}

export type Compatibility = CompatibilityGuaranteed | CompatibilityNotGuaranteed;

export function isGuaranteedCompatible(c: Compatibility): c is CompatibilityGuaranteed {
    return c.guaranteed;
}

export interface Version {
    readonly major: string;
    readonly minor: string;
    readonly gitVersion: string;
}

export async function check(kubectlLoadJSON: (cmd: string) => Promise<Errorable<any>>): Promise<Compatibility> {
    const version = await kubectlLoadJSON('version -o json');
    if (failed(version)) {
        return {
            guaranteed: false,
            didCheck: false,
            clientVersion: '',
            serverVersion: ''
        };
    }

    const clientVersion: Version = version.result.clientVersion;
    const serverVersion: Version = version.result.serverVersion;

    if (isCompatible(clientVersion, serverVersion)) {
        return { guaranteed: true };
    }

    return {
        guaranteed: false,
        didCheck: true,
        clientVersion: clientVersion.gitVersion,
        serverVersion: serverVersion.gitVersion
    };
}

function isCompatible(clientVersion: Version, serverVersion: Version): boolean {
    if (clientVersion.major === serverVersion.major) {
        const clientMinor = Number.parseInt(clientVersion.minor);
        const serverMinor = Number.parseInt(serverVersion.minor);
        if (Number.isInteger(clientMinor) && Number.isInteger(serverMinor) && Math.abs(clientMinor - serverMinor) <= 1) {
            return true;
        }
    }
    return false;
}
