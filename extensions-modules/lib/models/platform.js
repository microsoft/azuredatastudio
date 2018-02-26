/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const fs = require("fs");
const os = require("os");
const unknown = 'unknown';
var Runtime;
(function (Runtime) {
    Runtime[Runtime["UnknownRuntime"] = 'Unknown'] = "UnknownRuntime";
    Runtime[Runtime["UnknownVersion"] = 'Unknown'] = "UnknownVersion";
    Runtime[Runtime["Windows_86"] = 'Windows_86'] = "Windows_86";
    Runtime[Runtime["Windows_64"] = 'Windows_64'] = "Windows_64";
    Runtime[Runtime["OSX"] = 'OSX'] = "OSX";
    Runtime[Runtime["CentOS_7"] = 'CentOS_7'] = "CentOS_7";
    Runtime[Runtime["Debian_8"] = 'Debian_8'] = "Debian_8";
    Runtime[Runtime["Fedora_23"] = 'Fedora_23'] = "Fedora_23";
    Runtime[Runtime["OpenSUSE_13_2"] = 'OpenSUSE_13_2'] = "OpenSUSE_13_2";
    Runtime[Runtime["SLES_12_2"] = 'SLES_12_2'] = "SLES_12_2";
    Runtime[Runtime["RHEL_7"] = 'RHEL_7'] = "RHEL_7";
    Runtime[Runtime["Ubuntu_14"] = 'Ubuntu_14'] = "Ubuntu_14";
    Runtime[Runtime["Ubuntu_16"] = 'Ubuntu_16'] = "Ubuntu_16";
    Runtime[Runtime["Linux_64"] = 'Linux_64'] = "Linux_64";
    Runtime[Runtime["Linux_86"] = 'Linux-86'] = "Linux_86";
})(Runtime = exports.Runtime || (exports.Runtime = {}));
function getRuntimeDisplayName(runtime) {
    switch (runtime) {
        case Runtime.Windows_64:
            return 'Windows';
        case Runtime.Windows_86:
            return 'Windows';
        case Runtime.OSX:
            return 'OSX';
        case Runtime.CentOS_7:
            return 'Linux';
        case Runtime.Debian_8:
            return 'Linux';
        case Runtime.Fedora_23:
            return 'Linux';
        case Runtime.OpenSUSE_13_2:
            return 'Linux';
        case Runtime.SLES_12_2:
            return 'Linux';
        case Runtime.RHEL_7:
            return 'Linux';
        case Runtime.Ubuntu_14:
            return 'Linux';
        case Runtime.Ubuntu_16:
            return 'Linux';
        case Runtime.Linux_64:
            return 'Linux';
        case Runtime.Linux_86:
            return 'Linux';
        default:
            return 'Unknown';
    }
}
exports.getRuntimeDisplayName = getRuntimeDisplayName;
class PlatformInformation {
    constructor(platform, architecture, distribution = undefined, getRuntimeId) {
        this.platform = platform;
        this.architecture = architecture;
        this.distribution = distribution;
        this.getRuntimeId = getRuntimeId;
        try {
            this.runtimeId = this.getRuntimeId(platform, architecture, distribution);
        }
        catch (err) {
            this.runtimeId = undefined;
        }
    }
    isWindows() {
        return this.platform === 'win32';
    }
    isMacOS() {
        return this.platform === 'darwin';
    }
    isLinux() {
        return this.platform === 'linux';
    }
    isValidRuntime() {
        return this.runtimeId !== undefined && this.runtimeId !== Runtime.UnknownRuntime && this.runtimeId !== Runtime.UnknownVersion;
    }
    getRuntimeDisplayName() {
        return getRuntimeDisplayName(this.runtimeId);
    }
    toString() {
        let result = this.platform;
        if (this.architecture) {
            if (result) {
                result += ', ';
            }
            result += this.architecture;
        }
        if (this.distribution) {
            if (result) {
                result += ', ';
            }
            result += this.distribution.toString();
        }
        return result;
    }
    static getCurrent(getRuntimeId, extensionName) {
        let platform = os.platform();
        let architecturePromise;
        let distributionPromise;
        switch (platform) {
            case 'win32':
                architecturePromise = PlatformInformation.getWindowsArchitecture();
                distributionPromise = Promise.resolve(undefined);
                break;
            case 'darwin':
                let osVersion = os.release();
                if (parseFloat(osVersion) < 16.0 && extensionName === 'mssql') {
                    return Promise.reject('The current version of macOS is not supported. Only macOS Sierra and above (>= 10.12) are supported.');
                }
                architecturePromise = PlatformInformation.getUnixArchitecture();
                distributionPromise = Promise.resolve(undefined);
                break;
            case 'linux':
                architecturePromise = PlatformInformation.getUnixArchitecture();
                distributionPromise = LinuxDistribution.getCurrent();
                break;
            default:
                return Promise.reject(`Unsupported platform: ${platform}`);
        }
        return architecturePromise.then(arch => {
            return distributionPromise.then(distro => {
                return new PlatformInformation(platform, arch, distro, getRuntimeId);
            });
        });
    }
    static getWindowsArchitecture() {
        return new Promise((resolve, reject) => {
            // try to get the architecture from WMIC
            PlatformInformation.getWindowsArchitectureWmic().then(architecture => {
                if (architecture && architecture !== unknown) {
                    resolve(architecture);
                }
                else {
                    // sometimes WMIC isn't available on the path so then try to parse the envvar
                    PlatformInformation.getWindowsArchitectureEnv().then(architecture => {
                        resolve(architecture);
                    });
                }
            });
        });
    }
    static getWindowsArchitectureWmic() {
        return this.execChildProcess('wmic os get osarchitecture')
            .then(architecture => {
            if (architecture) {
                let archArray = architecture.split(os.EOL);
                if (archArray.length >= 2) {
                    let arch = archArray[1].trim();
                    // Note: This string can be localized. So, we'll just check to see if it contains 32 or 64.
                    if (arch.indexOf('64') >= 0) {
                        return 'x86_64';
                    }
                    else if (arch.indexOf('32') >= 0) {
                        return 'x86';
                    }
                }
            }
            return unknown;
        }).catch((error) => {
            return unknown;
        });
    }
    static getWindowsArchitectureEnv() {
        return new Promise((resolve, reject) => {
            if (process.env.PROCESSOR_ARCHITECTURE === 'x86' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
                resolve('x86');
            }
            else {
                resolve('x86_64');
            }
        });
    }
    static getUnixArchitecture() {
        return this.execChildProcess('uname -m')
            .then(architecture => {
            if (architecture) {
                return architecture.trim();
            }
            return undefined;
        });
    }
    static execChildProcess(process) {
        return new Promise((resolve, reject) => {
            child_process.exec(process, { maxBuffer: 500 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (stderr && stderr.length > 0) {
                    reject(new Error(stderr));
                    return;
                }
                resolve(stdout);
            });
        });
    }
}
exports.PlatformInformation = PlatformInformation;
/**
 * There is no standard way on Linux to find the distribution name and version.
 * Recently, systemd has pushed to standardize the os-release file. This has
 * seen adoption in "recent" versions of all major distributions.
 * https://www.freedesktop.org/software/systemd/man/os-release.html
 */
class LinuxDistribution {
    constructor(name, version, idLike) {
        this.name = name;
        this.version = version;
        this.idLike = idLike;
    }
    static getCurrent() {
        // Try /etc/os-release and fallback to /usr/lib/os-release per the synopsis
        // at https://www.freedesktop.org/software/systemd/man/os-release.html.
        return LinuxDistribution.fromFilePath('/etc/os-release')
            .catch(() => LinuxDistribution.fromFilePath('/usr/lib/os-release'))
            .catch(() => Promise.resolve(new LinuxDistribution(unknown, unknown)));
    }
    toString() {
        return `name=${this.name}, version=${this.version}`;
    }
    static fromFilePath(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(LinuxDistribution.fromReleaseInfo(data));
                }
            });
        });
    }
    static fromReleaseInfo(releaseInfo, eol = os.EOL) {
        let name = unknown;
        let version = unknown;
        let idLike = undefined;
        const lines = releaseInfo.split(eol);
        for (let line of lines) {
            line = line.trim();
            let equalsIndex = line.indexOf('=');
            if (equalsIndex >= 0) {
                let key = line.substring(0, equalsIndex);
                let value = line.substring(equalsIndex + 1);
                // Strip quotes if necessary
                if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                }
                else if (value.length > 1 && value.startsWith('\'') && value.endsWith('\'')) {
                    value = value.substring(1, value.length - 1);
                }
                if (key === 'ID') {
                    name = value;
                }
                else if (key === 'VERSION_ID') {
                    version = value;
                }
                else if (key === 'ID_LIKE') {
                    idLike = value.split(' ');
                }
                if (name !== unknown && version !== unknown && idLike !== undefined) {
                    break;
                }
            }
        }
        return new LinuxDistribution(name, version, idLike);
    }
}
exports.LinuxDistribution = LinuxDistribution;
//# sourceMappingURL=platform.js.map