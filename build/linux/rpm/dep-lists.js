"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceGeneratedDepsByArch = exports.bundledDeps = exports.additionalDeps = void 0;
// Based on https://source.chromium.org/chromium/chromium/src/+/main:chrome/installer/linux/rpm/additional_deps
// Additional dependencies not in the rpm find-requires output.
exports.additionalDeps = [
    'ca-certificates',
    'libgtk-3.so.0()(64bit)',
    'libnss3.so(NSS_3.22)(64bit)',
    'libssl3.so(NSS_3.28)(64bit)',
    'rpmlib(FileDigests) <= 4.6.0-1',
    'libvulkan.so.1()(64bit)',
    'libcurl.so.4()(64bit)',
    'xdg-utils' // OS integration
];
// Based on https://source.chromium.org/chromium/chromium/src/+/refs/tags/98.0.4758.109:chrome/installer/linux/BUILD.gn;l=64-80
// and the Linux Archive build
// Shared library dependencies that we already bundle.
exports.bundledDeps = [
    'libEGL.so',
    'libGLESv2.so',
    'libvulkan.so.1',
    'swiftshader_libEGL.so',
    'swiftshader_libGLESv2.so',
    'libvk_swiftshader.so',
    'libffmpeg.so'
];
exports.referenceGeneratedDepsByArch = {
    'x86_64': [
        'ca-certificates',
        'ld-linux-x86-64.so.2()(64bit)',
        'ld-linux-x86-64.so.2(GLIBC_2.2.5)(64bit)',
        'ld-linux-x86-64.so.2(GLIBC_2.3)(64bit)',
        'libX11.so.6()(64bit)',
        'libXcomposite.so.1()(64bit)',
        'libXdamage.so.1()(64bit)',
        'libXext.so.6()(64bit)',
        'libXfixes.so.3()(64bit)',
        'libXrandr.so.2()(64bit)',
        'libasound.so.2()(64bit)',
        'libasound.so.2(ALSA_0.9)(64bit)',
        'libasound.so.2(ALSA_0.9.0rc4)(64bit)',
        'libatk-1.0.so.0()(64bit)',
        'libatk-bridge-2.0.so.0()(64bit)',
        'libatspi.so.0()(64bit)',
        'libc.so.6()(64bit)',
        'libc.so.6(GLIBC_2.10)(64bit)',
        'libc.so.6(GLIBC_2.11)(64bit)',
        'libc.so.6(GLIBC_2.14)(64bit)',
        'libc.so.6(GLIBC_2.15)(64bit)',
        'libc.so.6(GLIBC_2.16)(64bit)',
        'libc.so.6(GLIBC_2.17)(64bit)',
        'libc.so.6(GLIBC_2.2.5)(64bit)',
        'libc.so.6(GLIBC_2.3)(64bit)',
        'libc.so.6(GLIBC_2.3.2)(64bit)',
        'libc.so.6(GLIBC_2.3.3)(64bit)',
        'libc.so.6(GLIBC_2.3.4)(64bit)',
        'libc.so.6(GLIBC_2.4)(64bit)',
        'libc.so.6(GLIBC_2.6)(64bit)',
        'libc.so.6(GLIBC_2.7)(64bit)',
        'libc.so.6(GLIBC_2.8)(64bit)',
        'libc.so.6(GLIBC_2.9)(64bit)',
        'libcairo.so.2()(64bit)',
        'libcups.so.2()(64bit)',
        'libcurl.so.4()(64bit)',
        'libdbus-1.so.3()(64bit)',
        'libdl.so.2()(64bit)',
        'libdl.so.2(GLIBC_2.2.5)(64bit)',
        'libdrm.so.2()(64bit)',
        'libexpat.so.1()(64bit)',
        'libgbm.so.1()(64bit)',
        'libgcc_s.so.1()(64bit)',
        'libgcc_s.so.1(GCC_3.0)(64bit)',
        'libgio-2.0.so.0()(64bit)',
        'libglib-2.0.so.0()(64bit)',
        'libgobject-2.0.so.0()(64bit)',
        'libgtk-3.so.0()(64bit)',
        'libm.so.6()(64bit)',
        'libm.so.6(GLIBC_2.2.5)(64bit)',
        'libnspr4.so()(64bit)',
        'libnss3.so()(64bit)',
        'libnss3.so(NSS_3.11)(64bit)',
        'libnss3.so(NSS_3.12)(64bit)',
        'libnss3.so(NSS_3.12.1)(64bit)',
        'libnss3.so(NSS_3.2)(64bit)',
        'libnss3.so(NSS_3.22)(64bit)',
        'libnss3.so(NSS_3.3)(64bit)',
        'libnss3.so(NSS_3.4)(64bit)',
        'libnss3.so(NSS_3.5)(64bit)',
        'libnss3.so(NSS_3.9.2)(64bit)',
        'libnssutil3.so()(64bit)',
        'libnssutil3.so(NSSUTIL_3.12.3)(64bit)',
        'libpango-1.0.so.0()(64bit)',
        'libpthread.so.0()(64bit)',
        'libpthread.so.0(GLIBC_2.12)(64bit)',
        'libpthread.so.0(GLIBC_2.2.5)(64bit)',
        'libpthread.so.0(GLIBC_2.3.2)(64bit)',
        'libpthread.so.0(GLIBC_2.3.3)(64bit)',
        'libpthread.so.0(GLIBC_2.3.4)(64bit)',
        'librt.so.1()(64bit)',
        'librt.so.1(GLIBC_2.2.5)(64bit)',
        'libsecret-1.so.0()(64bit)',
        'libsmime3.so()(64bit)',
        'libsmime3.so(NSS_3.10)(64bit)',
        'libsmime3.so(NSS_3.2)(64bit)',
        'libssl3.so(NSS_3.28)(64bit)',
        'libutil.so.1()(64bit)',
        'libutil.so.1(GLIBC_2.2.5)(64bit)',
        'libxcb.so.1()(64bit)',
        'libxkbcommon.so.0()(64bit)',
        'libxkbfile.so.1()(64bit)',
        'rpmlib(FileDigests) <= 4.6.0-1',
        'rtld(GNU_HASH)',
        'xdg-utils'
    ],
    'armv7hl': [
        'ca-certificates',
        'ld-linux-armhf.so.3',
        'ld-linux-armhf.so.3(GLIBC_2.4)',
        'libX11.so.6',
        'libXcomposite.so.1',
        'libXdamage.so.1',
        'libXext.so.6',
        'libXfixes.so.3',
        'libXrandr.so.2',
        'libasound.so.2',
        'libasound.so.2(ALSA_0.9)',
        'libasound.so.2(ALSA_0.9.0rc4)',
        'libatk-1.0.so.0',
        'libatk-bridge-2.0.so.0',
        'libatspi.so.0',
        'libc.so.6',
        'libc.so.6(GLIBC_2.10)',
        'libc.so.6(GLIBC_2.11)',
        'libc.so.6(GLIBC_2.14)',
        'libc.so.6(GLIBC_2.15)',
        'libc.so.6(GLIBC_2.16)',
        'libc.so.6(GLIBC_2.17)',
        'libc.so.6(GLIBC_2.4)',
        'libc.so.6(GLIBC_2.6)',
        'libc.so.6(GLIBC_2.7)',
        'libc.so.6(GLIBC_2.8)',
        'libc.so.6(GLIBC_2.9)',
        'libcairo.so.2',
        'libcups.so.2',
        'libcurl.so.4()(64bit)',
        'libdbus-1.so.3',
        'libdl.so.2',
        'libdl.so.2(GLIBC_2.4)',
        'libdrm.so.2',
        'libexpat.so.1',
        'libgbm.so.1',
        'libgcc_s.so.1',
        'libgcc_s.so.1(GCC_3.0)',
        'libgcc_s.so.1(GCC_3.4)',
        'libgcc_s.so.1(GCC_3.5)',
        'libgio-2.0.so.0',
        'libglib-2.0.so.0',
        'libgobject-2.0.so.0',
        'libgtk-3.so.0',
        'libgtk-3.so.0()(64bit)',
        'libm.so.6',
        'libm.so.6(GLIBC_2.4)',
        'libnspr4.so',
        'libnss3.so',
        'libnss3.so(NSS_3.11)',
        'libnss3.so(NSS_3.12)',
        'libnss3.so(NSS_3.12.1)',
        'libnss3.so(NSS_3.2)',
        'libnss3.so(NSS_3.22)',
        'libnss3.so(NSS_3.22)(64bit)',
        'libnss3.so(NSS_3.3)',
        'libnss3.so(NSS_3.4)',
        'libnss3.so(NSS_3.5)',
        'libnss3.so(NSS_3.9.2)',
        'libnssutil3.so',
        'libnssutil3.so(NSSUTIL_3.12.3)',
        'libpango-1.0.so.0',
        'libpthread.so.0',
        'libpthread.so.0(GLIBC_2.12)',
        'libpthread.so.0(GLIBC_2.4)',
        'librt.so.1',
        'librt.so.1(GLIBC_2.4)',
        'libsecret-1.so.0',
        'libsmime3.so',
        'libsmime3.so(NSS_3.10)',
        'libsmime3.so(NSS_3.2)',
        'libssl3.so(NSS_3.28)(64bit)',
        'libstdc++.so.6',
        'libstdc++.so.6(CXXABI_1.3)',
        'libstdc++.so.6(CXXABI_1.3.5)',
        'libstdc++.so.6(CXXABI_1.3.8)',
        'libstdc++.so.6(CXXABI_1.3.9)',
        'libstdc++.so.6(CXXABI_ARM_1.3.3)',
        'libstdc++.so.6(GLIBCXX_3.4)',
        'libstdc++.so.6(GLIBCXX_3.4.11)',
        'libstdc++.so.6(GLIBCXX_3.4.14)',
        'libstdc++.so.6(GLIBCXX_3.4.15)',
        'libstdc++.so.6(GLIBCXX_3.4.18)',
        'libstdc++.so.6(GLIBCXX_3.4.19)',
        'libstdc++.so.6(GLIBCXX_3.4.20)',
        'libstdc++.so.6(GLIBCXX_3.4.21)',
        'libstdc++.so.6(GLIBCXX_3.4.22)',
        'libstdc++.so.6(GLIBCXX_3.4.5)',
        'libstdc++.so.6(GLIBCXX_3.4.9)',
        'libutil.so.1',
        'libutil.so.1(GLIBC_2.4)',
        'libxcb.so.1',
        'libxkbcommon.so.0',
        'libxkbfile.so.1',
        'rpmlib(FileDigests) <= 4.6.0-1',
        'rtld(GNU_HASH)',
        'xdg-utils'
    ],
    'aarch64': [
        'ca-certificates',
        'ld-linux-aarch64.so.1()(64bit)',
        'ld-linux-aarch64.so.1(GLIBC_2.17)(64bit)',
        'libX11.so.6()(64bit)',
        'libXcomposite.so.1()(64bit)',
        'libXdamage.so.1()(64bit)',
        'libXext.so.6()(64bit)',
        'libXfixes.so.3()(64bit)',
        'libXrandr.so.2()(64bit)',
        'libasound.so.2()(64bit)',
        'libasound.so.2(ALSA_0.9)(64bit)',
        'libasound.so.2(ALSA_0.9.0rc4)(64bit)',
        'libatk-1.0.so.0()(64bit)',
        'libatk-bridge-2.0.so.0()(64bit)',
        'libatspi.so.0()(64bit)',
        'libc.so.6()(64bit)',
        'libc.so.6(GLIBC_2.17)(64bit)',
        'libcairo.so.2()(64bit)',
        'libcups.so.2()(64bit)',
        'libcurl.so.4()(64bit)',
        'libdbus-1.so.3()(64bit)',
        'libdbus-1.so.3(LIBDBUS_1_3)(64bit)',
        'libdl.so.2()(64bit)',
        'libdl.so.2(GLIBC_2.17)(64bit)',
        'libdrm.so.2()(64bit)',
        'libexpat.so.1()(64bit)',
        'libgbm.so.1()(64bit)',
        'libgcc_s.so.1()(64bit)',
        'libgcc_s.so.1(GCC_3.0)(64bit)',
        'libgcc_s.so.1(GCC_4.2.0)(64bit)',
        'libgcc_s.so.1(GCC_4.5.0)(64bit)',
        'libgio-2.0.so.0()(64bit)',
        'libglib-2.0.so.0()(64bit)',
        'libgobject-2.0.so.0()(64bit)',
        'libgtk-3.so.0()(64bit)',
        'libm.so.6()(64bit)',
        'libm.so.6(GLIBC_2.17)(64bit)',
        'libnspr4.so()(64bit)',
        'libnss3.so()(64bit)',
        'libnss3.so(NSS_3.11)(64bit)',
        'libnss3.so(NSS_3.12)(64bit)',
        'libnss3.so(NSS_3.12.1)(64bit)',
        'libnss3.so(NSS_3.2)(64bit)',
        'libnss3.so(NSS_3.22)(64bit)',
        'libnss3.so(NSS_3.3)(64bit)',
        'libnss3.so(NSS_3.4)(64bit)',
        'libnss3.so(NSS_3.5)(64bit)',
        'libnss3.so(NSS_3.9.2)(64bit)',
        'libnssutil3.so()(64bit)',
        'libnssutil3.so(NSSUTIL_3.12.3)(64bit)',
        'libpango-1.0.so.0()(64bit)',
        'libpthread.so.0()(64bit)',
        'libpthread.so.0(GLIBC_2.17)(64bit)',
        'librt.so.1()(64bit)',
        'librt.so.1(GLIBC_2.17)(64bit)',
        'libsecret-1.so.0()(64bit)',
        'libsmime3.so()(64bit)',
        'libsmime3.so(NSS_3.10)(64bit)',
        'libsmime3.so(NSS_3.2)(64bit)',
        'libssl3.so(NSS_3.28)(64bit)',
        'libstdc++.so.6()(64bit)',
        'libstdc++.so.6(CXXABI_1.3)(64bit)',
        'libstdc++.so.6(CXXABI_1.3.5)(64bit)',
        'libstdc++.so.6(CXXABI_1.3.8)(64bit)',
        'libstdc++.so.6(CXXABI_1.3.9)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.11)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.14)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.15)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.18)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.19)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.20)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.21)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.22)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.5)(64bit)',
        'libstdc++.so.6(GLIBCXX_3.4.9)(64bit)',
        'libutil.so.1()(64bit)',
        'libutil.so.1(GLIBC_2.17)(64bit)',
        'libxcb.so.1()(64bit)',
        'libxkbcommon.so.0()(64bit)',
        'libxkbcommon.so.0(V_0.5.0)(64bit)',
        'libxkbfile.so.1()(64bit)',
        'rpmlib(FileDigests) <= 4.6.0-1',
        'rtld(GNU_HASH)',
        'xdg-utils'
    ]
};
