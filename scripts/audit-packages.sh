#!/bin/bash
sources=$(pwd)

find . -name package.json | grep -v node_modules | while read path; do
	dir=$(dirname "$path")
	echo "Checking $path …"
	cd $dir
	yarn audit --groups dependencies>&1
	exitCode="$?"
	echo "Exit code was $exitCode"
	if [ $exitCode -gt 16 ]
	then
		echo "$path has a critical yarn audit issue."
		exit 1
	fi
	cd $sources
done
