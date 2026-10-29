import re
import os
D=os.path.dirname(os.path.abspath(__file__))+'/'
OUT=os.path.join(D,'..')+'/'
head=open(D+'head.html').read(); body=open(D+'body.html').read()
parts=['data.js','js_core.js','js_friends.js','js_store.js','js_render.js','js_actions.js','js_sources.js','js_ask.js','js_quiz.js','js_quiz_mock.js','js_tools.js','js_notes.js','js_richtext.js','js_events.js']
js="<script>\n/* ======================================================================\n   LAW REVISION — APPLICATION LOGIC (vanilla JavaScript)\n   ====================================================================== */\n(function () {\n  'use strict';\n\n" + ''.join(open(D+p).read().rstrip('\n')+'\n\n' for p in parts) + "</script>\n"
open(D+'app.js','w').write(js.replace('<script>','',1).replace('</script>\n',''))
comment='''<!--
  ======================================================================
  LAW REVISION REPOSITORY & ACTIVE RECALL
  ----------------------------------------------------------------------
  Offline copy. Double-click to open it in your browser; everything is
  saved in this browser only. Your main copy lives in claude.ai, where it
  syncs to your account and the Claude features (Ask, drafting cards from
  notes, quizzes, marking) work. Move data between the two with
  Export / Import.
  ======================================================================
-->
'''
offline='<!DOCTYPE html>\n'+comment+'<html lang="en-GB">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+head+'</head>\n<body>\n'+body+js+'</body>\n</html>\n'
open(OUT+'law_revision_app.html','w').write(offline)
online=head+body+js
open(OUT+'law-revision-online.html','w').write(online)
print(len(offline), len(online))

# Friends' edition: python3 src/build.py --friends STARTER.json [OUTPUT.html]
# STARTER.json ({entries, sources:{meta, text}}) is the owner's library: keep it OUT of this public repo.
import sys, json
if '--friends' in sys.argv:
    i = sys.argv.index('--friends')
    starter = json.load(open(sys.argv[i + 1]))
    out = sys.argv[i + 2] if len(sys.argv) > i + 2 else OUT + 'law-revision-friends.html'
    blob = json.dumps({'entries': starter['entries'], 'sources': starter['sources']}, ensure_ascii=False, separators=(',', ':'))
    blob = blob.replace('</', '<\\/').replace('<!--', '<\\!--').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    fjs = js.replace("  var EDITION = 'main';\n  var STARTER = null;\n", "  var EDITION = 'friends';\n  var STARTER = " + blob + ";\n", 1)
    assert fjs != js, 'edition marker not found in data.js'
    fhead = head.replace('<title>Law Revision Repository</title>', "<title>Law Revision – Friends</title>", 1)
    open(out, 'w').write(fhead + body + fjs)
    print('friends edition:', out, len(fhead + body + fjs))
