/*
 * firms.js: firm briefings the interviewer plays.
 *
 * Facts here are deliberately conservative. Anything reported in the press
 * says "reported"; anything still developing goes under "check", the list of
 * things to confirm on the firm's own site before a real interview. The AI
 * interviewer is told to treat these notes as its briefing and not to invent
 * facts beyond them. Add your own research to any firm on the Firms page: it
 * is passed to the interviewer too.
 *
 * Last reviewed: November 2026.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};

  IT.FIRMS = [
    {
      id: 'mishcon', name: 'Mishcon de Reya', group: 'London independent',
      known: ['Disputes and litigation', 'Real estate', 'Private wealth and private capital', 'The innovation economy (tech, start-ups, growth companies)', 'Employment, fraud, reputation protection'],
      facts: [
        'Founded in London in 1937 by Victor Mishcon; still independent and London-headquartered.',
        'Acted for Gina Miller in the Article 50 litigation that reached the UK Supreme Court in 2017, and for Diana, Princess of Wales in her divorce.',
        'Long-used brand line: "It\'s business. But it\'s personal."',
        'Reported "Vision 2030" strategy (October 2025) naming three focus sectors: the innovation economy, private wealth and private capital, and real estate, while staying a disputes powerhouse.',
        'Runs MDR Lab, a programme for legal technology start-ups, and combined with tech-focused firm Taylor Vinters.',
        'Reported record revenue of around £330m for 2024/25.'
      ],
      format: [
        'Reported for the 2026 cycle: an AI interview (the Bright Apply platform) at the start of the vacation scheme process. It uses your application to tailor questions, asks follow-ups when answers are vague, can be answered by voice or text, is untimed, and may include one or two short recorded video answers.',
        'Candidates reported the AI kept probing until it had enough detail; longer, more specific answers meant fewer follow-ups.',
        'Reported: trainees are recruited through the vacation scheme, followed by a training contract interview with lawyers.',
        'Older cycles used one-way video: about 30-45 seconds to think and about a minute to answer.'
      ],
      style: 'Entrepreneurial, personal and direct. Interested in what makes the candidate distinctive and in the human side of client problems. Probes for specifics until satisfied, and pivots from the candidate\'s answers to commercial questions about Mishcon\'s clients and business development.',
      extra: ['Mishcon describes itself with "It\'s business. But it\'s personal." What does that mean to you?', 'Mishcon is known for high-profile disputes. Why does contentious work appeal to you?', 'Which of Mishcon\'s focus sectors interests you most, and why?', 'How is a news story you have been following likely to affect a Mishcon client, and what would it mean for Mishcon\'s business development?', 'Why would a client choose an independent London firm like Mishcon over a global firm?'],
      check: ['Latest financial results and any strategy updates', 'Recent high-profile cases and deals', 'Current vacation scheme and AI interview format on mishcon.com/graduates']
    },
    {
      id: 'baker', name: 'Baker McKenzie', group: 'Global',
      known: ['Cross-border M&A and private equity', 'Tax', 'International trade, sanctions and export controls', 'IP, technology and data', 'Employment', 'Antitrust and competition', 'Capital markets'],
      facts: [
        'Founded in Chicago in 1949; one of the largest global law firm networks, with offices in dozens of countries.',
        'London is reported to be its largest office; London revenue reportedly about £379m in the year to June 2025, against global revenue of about $3.6bn.',
        'Reported focus in London on growing transactional work (M&A, private equity, capital markets), including senior capital markets hires in April 2026.',
        'Reported in early 2026: cuts to part of its global business services workforce, linked partly to greater use of AI.',
        'Graduate recruitment ethos: "Step up. Stand out."; asks for a 2:1 and strong academics, and says it wants people who understand its unique offering, values and position in the market.'
      ],
      format: [
        'Assessment centre described by the firm: a group exercise and a case study interview with a partner and senior associates.',
        'Candidates have also reported document review or proofreading exercises and a competency interview with senior associates.',
        'Reported questions: a setback and how you dealt with it; a team member not doing their task; what distinguishes Baker McKenzie from other firms; why law; commercial questions about what is affecting the legal sector.'
      ],
      style: 'Global and commercially minded. Interested in cross-border thinking, how geopolitics and trade affect multinational clients, and teamwork across cultures. Competency questions probe beyond the standard answer.',
      extra: ['What distinguishes Baker McKenzie from other global firms?', 'How do tariffs and trade tensions affect Baker McKenzie\'s multinational clients?', 'Baker McKenzie operates across many jurisdictions. What challenges does that create for a client deal?', 'What does "Step up. Stand out." mean to you?', 'Tell me about a time you worked with people from a different culture.'],
      check: ['Latest global and London results', 'Recent London deals and lateral hires', 'Current assessment centre format on uk-graduates.bakermckenzie.com']
    },
    {
      id: 'aoshearman', name: 'A&O Shearman', group: 'Magic Circle',
      known: ['Banking and finance', 'Capital markets', 'M&A', 'Restructuring', 'Disputes', 'Legal technology and AI'],
      facts: ['Formed in May 2024 by the merger of Allen & Overy and Shearman & Sterling.', 'An early adopter of generative AI in legal practice, rolling out the Harvey platform in 2023.', 'Publishes guidance for applicants on using AI responsibly in applications.'],
      format: ['Reported: online tests and a video or virtual interview stage before assessment, with partner interviews later. A reported AI-related assessment has been added to test technology awareness; check current details.'],
      style: 'Finance-heavy, international and technology-forward. Expects a view on how AI changes legal work and on transatlantic integration after the merger.',
      extra: ['What does the merger of Allen & Overy and Shearman & Sterling mean for clients?', 'How should A&O Shearman use AI without compromising quality?', 'Why finance work?'],
      check: ['Latest results and integration news', 'Recent landmark deals', 'Current recruitment stages']
    },
    {
      id: 'cliffordchance', name: 'Clifford Chance', group: 'Magic Circle',
      known: ['Finance and capital markets', 'M&A', 'Litigation and disputes', 'Regulatory'],
      facts: ['One of the Magic Circle firms with a large global network.', 'Reported 2025/26 revenue of about £2.6bn, up around 9%.', 'Has warned applicants that over-reliance on AI tools can weaken an application.'],
      format: ['Reported: online tests, then an assessment day with interviews and a case study. Check the current process.'],
      style: 'Polished, global and analytical. Probes commercial reasoning and international perspective.',
      extra: ['Why Clifford Chance over the other Magic Circle firms?', 'What does a global firm offer a client that a national firm cannot?'],
      check: ['Latest financial results', 'Recent deals', 'Current recruitment stages']
    },
    {
      id: 'freshfields', name: 'Freshfields', group: 'Magic Circle',
      known: ['Public M&A', 'Antitrust and competition', 'Disputes', 'Restructuring', 'US expansion'],
      facts: ['Magic Circle firm that has grown its US practice significantly.', 'Reported to have stopped publishing headline profit per partner figures after 2023; LLP accounts reportedly showed 2024/25 revenue of about £2.25bn.'],
      format: ['Reported: tests, then interviews including a case study or written exercise. Check the current process.'],
      style: 'Rigorous and intellectual. Expects clear structured thinking and an understanding of big-ticket corporate and antitrust work.',
      extra: ['Why do you think Freshfields has invested so heavily in the US?', 'Why does competition law matter to a company planning a merger?'],
      check: ['Latest financial disclosures', 'US growth and recent deals']
    },
    {
      id: 'linklaters', name: 'Linklaters', group: 'Magic Circle',
      known: ['M&A', 'Restructuring', 'Energy and infrastructure', 'Digital infrastructure', 'Finance'],
      facts: ['Reported revenue of £2.47bn for the year to April 2026, up 6.8%, citing restructuring, digital infrastructure, energy and infrastructure and M&A.', 'Reported to be cutting its trainee intake (from about 100 to about 60) while expanding solicitor apprenticeships.'],
      format: ['Reported: tests, then interviews and a case study. Check the current process.'],
      style: 'Analytical and forward-looking; interested in innovation and how the firm differs from its Magic Circle peers.',
      extra: ['Why do you think Linklaters is expanding apprenticeships?', 'What is driving demand for digital infrastructure work?'],
      check: ['Latest results', 'Trainee and apprentice intake news']
    },
    {
      id: 'slaughter', name: 'Slaughter and May', group: 'Magic Circle',
      known: ['Corporate and M&A', 'Financing', 'Disputes', 'Competition', 'Tax'],
      facts: ['Magic Circle firm without a formal international office network; works with leading independent firms abroad ("best friends").', 'Trains lawyers as multi-specialists across corporate, finance and disputes.'],
      format: ['Reported: no one-way recorded video interview stage. Interviews with partners are reported to include discussing a written article you choose and read beforehand.'],
      style: 'Intellectual, understated and conversational. Tests how you think and argue more than rehearsed answers; likes to push back on a view.',
      extra: ['Slaughter and May has no international network of its own. Is that a strength or a weakness?', 'Talk me through an article you have read recently and argue the opposite view.'],
      check: ['Current interview format', 'Recent deals']
    },
    {
      id: 'hsfkramer', name: 'Herbert Smith Freehills Kramer', group: 'Global',
      known: ['Disputes and international arbitration', 'Energy', 'M&A', 'Restructuring'],
      facts: ['Formed in 2025 when Herbert Smith Freehills combined with US firm Kramer Levin; reported combined revenue of about $2bn.', 'Long known as a disputes and arbitration powerhouse.'],
      format: ['Check the current process.'],
      style: 'Disputes-minded and international; interested in how the US combination changes the firm.',
      extra: ['Why did Herbert Smith Freehills need a US combination?', 'Why does international arbitration appeal to clients?'],
      check: ['Post-merger integration and results']
    },
    {
      id: 'hoganlovells', name: 'Hogan Lovells Cadwalader', group: 'Global',
      known: ['Regulatory', 'Finance', 'Life sciences', 'Litigation', 'Intellectual property'],
      facts: ['Hogan Lovells and Cadwalader, Wickersham & Taft partners reportedly approved a merger in April 2026, with the combined firm targeted to begin in July 2026 under the name Hogan Lovells Cadwalader, with around 3,100 lawyers.'],
      format: ['Check the current process.'],
      style: 'Regulatory and transatlantic. Interested in why regulation creates work for lawyers.',
      extra: ['What does the Cadwalader combination add for clients?', 'Why does regulation matter so much to businesses?'],
      check: ['Confirm the combination has launched and the current name', 'Integration news']
    },
    {
      id: 'ashurst', name: 'Ashurst', group: 'Global',
      known: ['Finance', 'Energy and infrastructure', 'Real estate', 'Corporate'],
      facts: ['Reported plan to combine with US firm Perkins Coie, creating a firm of about 3,000 lawyers.'],
      format: ['Check the current process.'],
      style: 'Pragmatic and international.',
      extra: ['What would a combination with Perkins Coie mean for Ashurst\'s clients?'],
      check: ['Confirm the status and name of the Perkins Coie combination']
    },
    {
      id: 'winstontaylor', name: 'Winston Taylor', group: 'Transatlantic (formerly Taylor Wessing UK)',
      known: ['Technology and media', 'Life sciences', 'Private wealth', 'Real estate', 'IP'],
      facts: ['Taylor Wessing\'s UK-led business and US firm Winston & Strawn reportedly approved a combination to operate as Winston Taylor, with revenue of around £1.2bn.'],
      format: ['Check the current process.'],
      style: 'Sector-focused, tech and innovation minded.',
      extra: ['Why are UK firms combining with US firms?', 'Which sector would you most like to advise, and why?'],
      check: ['Confirm the combination has launched']
    },
    {
      id: 'macfarlanes', name: 'Macfarlanes', group: 'London independent',
      known: ['Private equity', 'M&A', 'Private client and wealth', 'Investment funds'],
      facts: ['London-centred firm known for high-end corporate and private client work with a relatively small trainee intake.'],
      format: ['Check the current process.'],
      style: 'Precise and understated; values intellectual ability and clear thinking.',
      extra: ['Why a London-centred firm rather than a global one?'],
      check: ['Recent deals and results']
    },
    {
      id: 'travers', name: 'Travers Smith', group: 'London independent',
      known: ['Private equity', 'Investment funds', 'Corporate', 'Financial services'],
      facts: ['Independent London firm with no international office network, known for private equity and funds work.'],
      format: ['Check the current process.'],
      style: 'Collegiate and down to earth; expects genuine reasons for choosing a smaller firm.',
      extra: ['Why would a client choose an independent firm with no overseas offices?'],
      check: ['Recent deals']
    },
    {
      id: 'kirkland', name: 'Kirkland & Ellis', group: 'US',
      known: ['Private equity', 'Leveraged finance', 'Restructuring', 'Funds'],
      facts: ['US firm reported to be the world\'s highest-grossing law firm, with a large private equity practice in London.'],
      format: ['Check the current process.'],
      style: 'Fast, commercial and demanding. Expects understanding of private equity and of what working at a US firm involves.',
      extra: ['What is private equity, and why are its clients so valuable to law firms?', 'What do you expect from working at a US firm in London?'],
      check: ['Recent PE deals', 'Trainee intake']
    },
    {
      id: 'latham', name: 'Latham & Watkins', group: 'US',
      known: ['Private equity', 'Finance', 'Capital markets', 'M&A'],
      facts: ['US firm with a major London office.'],
      format: ['Check the current process.'],
      style: 'Commercial and driven.',
      extra: ['Why a US firm in London?'],
      check: ['Recent deals']
    },
    {
      id: 'whitecase', name: 'White & Case', group: 'US',
      known: ['International arbitration', 'Finance', 'Energy', 'M&A', 'Capital markets'],
      facts: ['US firm with a large global network and a big London office.'],
      format: ['Its London graduate team has described a pre-recorded video interview as an important part of selection for vacation schemes and training contracts.'],
      style: 'Global and entrepreneurial; values international outlook.',
      extra: ['Why does a global network matter to White & Case\'s clients?'],
      check: ['Current video interview format', 'Recent deals']
    },
    {
      id: 'pinsent', name: 'Pinsent Masons', group: 'UK national and international',
      known: ['Energy and infrastructure', 'Technology', 'Real estate', 'Legal technology'],
      facts: ['UK-headquartered international firm known for infrastructure, energy and technology work and for investment in legal technology.'],
      format: ['Check the current process.'],
      style: 'Purpose-led and practical; interested in innovation.',
      extra: ['How is technology changing the way Pinsent Masons serves clients?'],
      check: ['Recent deals and results']
    },
    {
      id: 'dla', name: 'DLA Piper', group: 'Global',
      known: ['Broad full-service practice', 'Real estate', 'Technology', 'Litigation'],
      facts: ['One of the largest law firms in the world by number of lawyers.'],
      format: ['Check the current process.'],
      style: 'Broad and global.',
      extra: ['What are the advantages and risks of being one of the largest firms in the world?'],
      check: ['Recent results']
    },
    {
      id: 'cms', name: 'CMS', group: 'Global',
      known: ['Energy', 'Real estate', 'Banking', 'Technology', 'European coverage'],
      facts: ['International firm with an especially strong European presence.'],
      format: ['Check the current process.'],
      style: 'Collaborative and sector-focused.',
      extra: ['Why does European coverage matter to UK clients?'],
      check: ['Recent results']
    },
    {
      id: 'nrf', name: 'Norton Rose Fulbright', group: 'Global',
      known: ['Energy', 'Infrastructure', 'Financial institutions', 'Transport'],
      facts: ['Global firm with sector focus on energy, infrastructure and financial institutions.'],
      format: ['Check the current process.'],
      style: 'Sector-minded and international.',
      extra: ['Which of Norton Rose Fulbright\'s sectors interests you most, and why?'],
      check: ['Recent results']
    },
    {
      id: 'eversheds', name: 'Eversheds Sutherland', group: 'Global',
      known: ['Employment', 'Energy', 'Real estate', 'Corporate'],
      facts: ['Global firm formed by the combination of UK firm Eversheds and US firm Sutherland.'],
      format: ['Reported by Chambers Student among firms that replaced telephone interviews with video interviews; check the current process.'],
      style: 'Friendly but structured; values consistency and evidence.',
      extra: ['Why Eversheds Sutherland rather than a Magic Circle firm?'],
      check: ['Current interview format']
    },
    {
      id: 'birdbird', name: 'Bird & Bird', group: 'International',
      known: ['Technology', 'Intellectual property', 'Life sciences', 'Media'],
      facts: ['International firm focused on technology and IP-driven sectors.'],
      format: ['Check the current process.'],
      style: 'Tech-curious; expects interest in innovation and regulation.',
      extra: ['What legal issue facing technology companies interests you most?'],
      check: ['Recent work']
    },
    {
      id: 'osborne', name: 'Osborne Clarke', group: 'International',
      known: ['Technology', 'Energy', 'Life sciences', 'Real estate'],
      facts: ['International firm with roots in Bristol and a sector-focused approach.'],
      format: ['Check the current process.'],
      style: 'Innovative and friendly.',
      extra: ['Why a sector-focused firm?'],
      check: ['Recent work']
    },
    {
      id: 'irwin', name: 'Irwin Mitchell', group: 'UK national',
      known: ['Personal legal services', 'Business law', 'Personal injury', 'Private wealth'],
      facts: ['UK national firm serving both individuals and businesses.'],
      format: ['Its careers site describes an online strengths-based assessment including a video interview at stage one.'],
      style: 'Strengths-based; interested in what energises you and how you treat clients as people.',
      extra: ['What does treating a client as a person, not a file, mean to you?'],
      check: ['Current assessment stages']
    },
    {
      id: 'generic', name: 'A City law firm', group: 'Generic',
      known: ['Corporate', 'Finance', 'Disputes', 'Real estate'], facts: [], format: ['A typical one-way video interview: a question on screen, 30 seconds to prepare, two to three minutes to answer, no retakes.'],
      style: 'A neutral, professional graduate recruitment interviewer.', extra: [], check: []
    }
  ];

  IT.firmById = id => IT.FIRMS.find(f => f.id === id) || null;

  /* Interview formats. */
  IT.FORMATS = [
    { id: 'adaptive', name: 'AI adaptive interview', blurb: 'Like Mishcon\'s AI interview: it builds follow-ups from what you say, keeps probing vague answers, and pivots from your answers to new themes.', mains: 4, depth: 3, prep: 10, answer: 180, mix: ['competency', 'motivation', 'commercial', 'firm', 'strengths'] },
    { id: 'oneway', name: 'One-way video (HireVue style)', blurb: 'A question appears, you get thinking time, then you are recorded against the clock. No retakes, no follow-ups.', mains: 5, depth: 0, prep: 30, answer: 120, mix: ['motivation', 'firm', 'competency', 'commercial', 'strengths'] },
    { id: 'partner', name: 'Partner interview', blurb: 'A conversational final-round interview: motivation, commercial depth, a case study and challenge to your views.', mains: 5, depth: 2, prep: 5, answer: 180, mix: ['firm', 'commercial', 'case', 'competency', 'curveball', 'closing'] },
    { id: 'commercial', name: 'Commercial awareness grill', blurb: 'A news story, then relentless follow-ups: client impact, practice areas, business development, counter-arguments.', mains: 3, depth: 3, prep: 15, answer: 150, mix: ['commercial'] },
    { id: 'quickfire', name: 'Quick-fire pressure round', blurb: 'Ten short questions with five seconds to think and sixty seconds to answer. Trains thinking on your feet.', mains: 10, depth: 0, prep: 5, answer: 60, mix: ['strengths', 'curveball', 'motivation', 'competency'] },
    { id: 'replay', name: 'Replay: Mishcon AI interview', blurb: 'The sequence you faced on 9 November 2026: integrity and setbacks, then a news story, its impact on a Mishcon client and on Mishcon\'s business development.', mains: 2, depth: 3, prep: 10, answer: 180, mix: [] }
  ];
  IT.formatById = id => IT.FORMATS.find(f => f.id === id) || IT.FORMATS[0];

  /* The questions and scripted probes for the Mishcon replay. */
  IT.REPLAY = [
    { qid: 'integrity-2', probes: ['What did doing the right thing cost you at the time?', 'How exactly did you turn that setback into an advantage?', 'What would you do differently if it happened during your training contract?'] },
    { qid: 'news-1', probes: ['How is that story likely to impact a client of Mishcon de Reya?', 'What would that mean for Mishcon\'s business development?', 'Which of Mishcon\'s practice areas would be busiest as a result, and why?'] }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
