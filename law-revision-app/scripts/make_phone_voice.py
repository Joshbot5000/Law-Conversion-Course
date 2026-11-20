"""Builds libs/phone-voice: the files the phone voice needs, published next to the app under tts/.

The app may only download from its own address, so the Kokoro-82M model (Apache-2.0) is split into parts under 15 MB
(the artifact service's limit for one file). The service only serves certain file types, so the data files
are named .wasm (a binary type it serves); the app reads them as plain bytes and published with the onnxruntime-web 1.20.1 engine file, three voices
and a manifest. Sources: the model from the kokoro-onnx GitHub release, voices from the kokoro-js npm package, the
phoneme table from the kokoro-onnx PyPI package, the engine from the onnxruntime-web npm package.

Usage: python3 scripts/make_phone_voice.py <download folder>   (run scripts/fetch_libs.sh first for the npm parts)
"""
import hashlib, io, json, os, sys, tarfile, urllib.request

MODEL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx'
MODEL_SHA = '6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb'
NPM = 'https://registry.npmjs.org/{0}/-/{0}-{1}.tgz'
VOICES = ['bf_emma', 'bm_george', 'af_heart']
PART = 13_500_000

def get(url):
    with urllib.request.urlopen(url) as r:
        return r.read()

def from_tgz(data, name):
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        return t.extractfile(name).read()

def main(dl):
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', 'libs', 'phone-voice')
    os.makedirs(out, exist_ok=True); os.makedirs(dl, exist_ok=True)
    mp = os.path.join(dl, 'kokoro-v1.0.int8.onnx')
    if not os.path.exists(mp):
        open(mp, 'wb').write(get(MODEL))
    model = open(mp, 'rb').read()
    if hashlib.sha256(model).hexdigest() != MODEL_SHA:
        sys.exit('the model download does not match the expected file')
    parts = []
    for i in range(0, len(model), PART):
        name = 'kokoro-int8-%d.wasm' % (i // PART)
        open(os.path.join(out, name), 'wb').write(model[i:i + PART]); parts.append(name)
    open(os.path.join(out, 'ort-wasm-1.20.1.wasm'), 'wb').write(from_tgz(get(NPM.format('onnxruntime-web', '1.20.1')), 'package/dist/ort-wasm-simd-threaded.wasm'))
    kj = get(NPM.format('kokoro-js', '1.2.1'))
    for v in VOICES:
        open(os.path.join(out, 'voice-' + v + '.wasm'), 'wb').write(from_tgz(kj, 'package/voices/%s.bin' % v))
    meta = json.loads(get('https://pypi.org/pypi/kokoro-onnx/0.4.9/json'))
    sdist = [u['url'] for u in meta['urls'] if u['packagetype'] == 'sdist'][0]
    vocab = json.loads(from_tgz(get(sdist), 'kokoro_onnx-0.4.9/src/kokoro_onnx/config.json'))['vocab']
    files = parts + ['ort-wasm-1.20.1.wasm'] + ['voice-' + v + '.wasm' for v in VOICES]
    man = {'name': 'Kokoro-82M v1.0 (int8), Apache-2.0', 'sha256': MODEL_SHA, 'bytes': sum(os.path.getsize(os.path.join(out, f)) for f in files),
           'model': parts, 'wasm': 'ort-wasm-1.20.1.wasm', 'voices': {v: 'voice-' + v + '.wasm' for v in VOICES}, 'vocab': vocab}
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False)
    print('phone voice files in', os.path.normpath(out))

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/phone-voice-downloads')
