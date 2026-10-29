import re
import os
D=os.path.dirname(os.path.abspath(__file__))+'/'
OUT=os.path.join(D,'..')+'/'
head=open(D+'head.html').read(); body=open(D+'body.html').read()
parts=['data.js','js_core.js','js_store.js','js_render.js','js_actions.js','js_sources.js','js_ask.js','js_quiz.js','js_quiz_mock.js','js_tools.js','js_notes.js','js_richtext.js','js_events.js']
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
