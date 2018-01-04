#!/bin/bash
# --------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the Source EULA. See License.txt in the project root for license information.
# --------------------------------------------------------------------------------------------

terminateTree() {
    for cpid in $(pgrep -P $1); do
        terminateTree $cpid
    done
    kill -9 $1 > /dev/null 2>&1
}

for pid in $*; do
    terminateTree $pid
done