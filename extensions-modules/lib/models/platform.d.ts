export declare enum Runtime {
    UnknownRuntime,
    UnknownVersion,
    Windows_86,
    Windows_64,
    OSX,
    CentOS_7,
    Debian_8,
    Fedora_23,
    OpenSUSE_13_2,
    SLES_12_2,
    RHEL_7,
    Ubuntu_14,
    Ubuntu_16,
    Linux_64,
    Linux_86,
}
export declare function getRuntimeDisplayName(runtime: Runtime): string;
export declare class PlatformInformation {
    platform: string;
    architecture: string;
    distribution: LinuxDistribution;
    getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime;
    runtimeId: Runtime;
    constructor(platform: string, architecture: string, distribution: LinuxDistribution, getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime);
    isWindows(): boolean;
    isMacOS(): boolean;
    isLinux(): boolean;
    isValidRuntime(): boolean;
    getRuntimeDisplayName(): string;
    toString(): string;
    static getCurrent(getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime, extensionName: string): Promise<any>;
    private static getWindowsArchitecture();
    private static getWindowsArchitectureWmic();
    private static getWindowsArchitectureEnv();
    private static getUnixArchitecture();
    private static execChildProcess(process);
}
/**
 * There is no standard way on Linux to find the distribution name and version.
 * Recently, systemd has pushed to standardize the os-release file. This has
 * seen adoption in "recent" versions of all major distributions.
 * https://www.freedesktop.org/software/systemd/man/os-release.html
 */
export declare class LinuxDistribution {
    name: string;
    version: string;
    idLike: string[];
    constructor(name: string, version: string, idLike?: string[]);
    static getCurrent(): Promise<LinuxDistribution>;
    toString(): string;
    private static fromFilePath(filePath);
    static fromReleaseInfo(releaseInfo: string, eol?: string): LinuxDistribution;
}
