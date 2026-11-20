#!/usr/bin/env bash
# Optional: downloads the two libraries the app loads from a CDN (pdf.js for PDFs, mammoth for Word files)
# so the tests can run without internet access. Without them, the tests fetch the same files from the CDN.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p libs/pdfjs-dist-3.11.174 libs/mammoth-1.6.0
curl -sSL https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-3.11.174.tgz | tar xz -C libs/pdfjs-dist-3.11.174 --strip-components=1
curl -sSL https://registry.npmjs.org/mammoth/-/mammoth-1.6.0.tgz | tar xz -C libs/mammoth-1.6.0 --strip-components=1

mkdir -p libs/pdfmake-0.2.10
curl -sSL https://registry.npmjs.org/pdfmake/-/pdfmake-0.2.10.tgz | tar xz -C libs/pdfmake-0.2.10 --strip-components=1
echo "Libraries saved in libs/"

# Phone voice (tests/pvoice.js): the speech engine and phonemizer the app loads from jsDelivr...
mkdir -p libs/onnxruntime-web-1.20.1 libs/phonemizer-1.2.1
curl -sSL https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.20.1.tgz | tar xz -C libs/onnxruntime-web-1.20.1 --strip-components=1
curl -sSL https://registry.npmjs.org/phonemizer/-/phonemizer-1.2.1.tgz | tar xz -C libs/phonemizer-1.2.1 --strip-components=1
# ...and the model files published next to the app under tts/ (about 105 MB)
python3 scripts/make_phone_voice.py
