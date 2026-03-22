#!/bin/sh
set -e

# Fix ownership of mounted data volume (may be owned by root from previous runs)
chown -R node:node /data

# Drop privileges and run as node user
exec su-exec node node apps/api/dist/index.js
