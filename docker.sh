#!/bin/bash
set -e
__file__=$(readlink -f "$0")
__dir__=$(dirname "$__file__")
cd "$__dir__"
name=fanhed/ccxt-server
docker build -f "$__dir__/Dockerfile" -t "$name" .
docker push "$name"
