#!/bin/bash

if [[ -d frontend/node_modules ]]; then
  yarn lint:all
fi
