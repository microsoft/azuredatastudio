#!/bin/bash
set -e
gulp  --max_old_space_size=8196 electron || { echo 'gulp electron failed' ; exit 1; }
./scripts/test.sh || { echo 'Tests failed' ; exit 1; }
gulp  --max_old_space_size=8196 optimize-vscode || { echo 'gulp optimize vscode failed' ; exit 1; }