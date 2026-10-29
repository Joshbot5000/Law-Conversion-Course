#!/usr/bin/env bash
# Optional: downloads the two libraries the app loads from a CDN (pdf.js for PDFs, mammoth for Word files)
# so the tests can run without internet access. Without them, the tests fetch the same files from the CDN.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p libs/pdfjs-dist-3.11.174 libs/mammoth-1.6.0
curl -sSL https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-3.11.174.tgz | tar xz -C libs/pdfjs-dist-3.11.174 --strip-components=1
curl -sSL https://registry.npmjs.org/mammoth/-/mammoth-1.6.0.tgz | tar xz -C libs/mammoth-1.6.0 --strip-components=1
echo "Libraries saved in libs/"
