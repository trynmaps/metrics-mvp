#!/bin/bash

if [[ -d frontend/node_modules ]]; then
  npm lint:all
fi
