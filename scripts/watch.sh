#!/bin/bash
gulp --max_old_space_size=2000 watch || { echo 'gulp electron failed' ; exit 1; }
