#!/bin/bash
set -e

sources=$(pwd)

find . -name package.json | grep -v node_modules | while read path; do
	dir=$(dirname "$path")
	echo "Checking $path …"
	cd $dir
	yarn audit --level critical --groups dependencies
	if [ $? -gt 16 ]
	then
		exit 1
	fi
	cd $sources
done
