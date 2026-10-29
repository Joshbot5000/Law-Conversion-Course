  // Which edition this page is: 'main' (the owner's, saved to claude.ai) or 'friends' (saved in each browser,
  // starting from STARTER). src/build.py --friends swaps these two lines.
  var EDITION = 'main';
  var STARTER = null;

  var MODULES = [
    { id: 'contract', label: 'Contract' },
    { id: 'tort',     label: 'Tort' },
    { id: 'els',      label: 'English Legal System' },
    { id: 'public',   label: 'Constitutional / Administrative' },
    { id: 'criminal', label: 'Criminal' },
    { id: 'land',     label: 'Land' },
    { id: 'trusts',   label: 'Trusts / Equity' },
    { id: 'eu',       label: 'Retained EU Law' }
  ];
  var MODULE_LABEL = {};
  MODULES.forEach(function (m) { MODULE_LABEL[m.id] = m.label; });

  // Topic suggestions shown in the Topic box's drop-down (you can type anything).
  var TOPIC_SUGGESTIONS = {
    contract: ['Formation – Offer', 'Formation – Acceptance', 'Formation – Consideration', 'Promissory Estoppel',
      'Intention to Create Legal Relations', 'Terms – Incorporation', 'Terms – Exclusion Clauses', 'Misrepresentation',
      'Mistake', 'Duress & Undue Influence', 'Frustration', 'Breach & Remedies – Damages', 'Privity'],
    tort: ['Negligence – Duty of Care', 'Negligence – Breach', 'Negligence – Causation', 'Negligence – Remoteness',
      'Psychiatric Harm', 'Pure Economic Loss', 'Omissions', 'Occupiers’ Liability', 'Vicarious Liability',
      'Nuisance', 'Rylands v Fletcher', 'Defamation', 'Defences'],
    els: ['Nature of Law', 'Civil & Criminal Law', 'History – Common Law & Equity', 'Sources – Case Law',
      'Sources – Legislation', 'Delegated Legislation', 'Statutory Interpretation', 'Precedent – Ratio & Obiter',
      'Precedent – Hierarchy of the Courts', 'Precedent – Distinguishing & Avoiding Precedents', 'Judicial Law-Making',
      'The Courts', 'Human Rights'],
    public: ['Parliamentary Sovereignty', 'Rule of Law', 'Separation of Powers', 'Royal Prerogative',
      'Constitutional Conventions', 'Judicial Review – Illegality', 'Judicial Review – Irrationality',
      'Judicial Review – Procedural Impropriety', 'Legitimate Expectation', 'Human Rights Act 1998', 'Devolution'],
    criminal: ['Actus Reus – Omissions', 'Causation', 'Mens Rea – Intention', 'Mens Rea – Recklessness', 'Murder',
      'Loss of Control', 'Diminished Responsibility', 'Involuntary Manslaughter', 'Non-Fatal Offences', 'Theft',
      'Robbery & Burglary', 'Fraud', 'Self-Defence', 'Intoxication', 'Accessorial Liability', 'Inchoate Offences'],
    land: ['Registered Land', 'Unregistered Land', 'Co-ownership', 'Trusts of Land', 'Leases', 'Easements',
      'Freehold Covenants', 'Mortgages', 'Adverse Possession', 'Proprietary Estoppel'],
    trusts: ['Three Certainties', 'Formalities', 'Constitution of Trusts', 'Secret Trusts', 'Resulting Trusts',
      'Constructive Trusts', 'Charitable Trusts', 'Purpose Trusts', 'Trustees’ Duties', 'Breach of Trust',
      'Tracing', 'Fiduciary Duties'],
    eu: ['Supremacy', 'Direct Effect', 'Indirect Effect', 'State Liability', 'Preliminary References (Art 267)',
      'Free Movement of Goods', 'Free Movement of Persons', 'Freedom of Establishment & Services', 'Competition Law',
      'Retained / Assimilated Law after Brexit']
  };

  /* ------------------------------------------------------------------
     B. SAMPLE DATA — loaded only the very first time the app opens.
     ------------------------------------------------------------------ */
  var SAMPLE_ENTRIES = [
    {
      id: 'sample-carlill',
      module: 'contract',
      topic: 'Formation – Offer (unilateral contracts)',
      type: 'case',
      name: 'Carlill v Carbolic Smoke Ball Co',
      citation: '[1893] 1 QB 256 (CA)',
      facts: 'The defendant advertised that it would pay £100 to anyone who caught influenza after using its smoke ball three times a day for two weeks as directed. The advert stated that £1,000 had been deposited with the Alliance Bank "shewing our sincerity". Mrs Carlill used the smoke ball as directed, caught influenza, and claimed the £100. The company argued the advert was a mere "puff", was not an offer, and that she had never communicated acceptance.',
      ratio: 'An advertisement can amount to an offer to the world at large (a unilateral offer) where its wording shows a clear intention to be bound — here shown by the bank deposit. Acceptance takes place by performing the stipulated conditions, and the offeror impliedly waives the need for notification of acceptance. Using the smoke ball as directed was good consideration.',
      strategy: 'Use whenever a problem involves an advert, a reward, or a "first person to do X gets Y" promise.\n1. State the general rule: adverts are usually invitations to treat (Partridge v Crittenden).\n2. Distinguish using Carlill: is the language clear and unequivocal, with evidence of intent to be bound (e.g. a deposit)?\n3. Explain acceptance by performance and waiver of communication.\n4. Consider whether the offer can still be revoked once performance has begun (Errington v Errington and Woods; Daulia v Four Millbank Nominees).',
      tags: ['unilateral-offer', 'advertisement', 'acceptance-by-conduct', 'consideration', 'invitation-to-treat'],
      memorised: false
    },
    {
      id: 'sample-donoghue',
      module: 'tort',
      topic: 'Negligence – Duty of Care',
      type: 'case',
      name: 'Donoghue v Stevenson',
      citation: '[1932] AC 562 (HL)',
      facts: 'Mrs Donoghue’s friend bought her a bottle of ginger beer at a café in Paisley. The bottle was made of opaque glass. After she had drunk some of it, the rest was poured out and the decomposed remains of a snail allegedly emerged. She suffered shock and gastroenteritis. She had no contract with the café owner or the manufacturer, so she sued the manufacturer in negligence.',
      ratio: 'A manufacturer of products, sold in a form showing that they are intended to reach the ultimate consumer without reasonable possibility of intermediate examination, owes that consumer a duty to take reasonable care. Lord Atkin’s "neighbour principle": you must take reasonable care to avoid acts or omissions which you can reasonably foresee would be likely to injure persons so closely and directly affected by your act that you ought reasonably to have them in contemplation. Negligence is an independent tort and does not depend on a contract.',
      strategy: 'Cite as the foundation of the modern duty of care.\n• Problem questions: where the facts fall in an established category (manufacturer–consumer, road users, doctor–patient), say that duty is established by precedent (Robinson v Chief Constable of West Yorkshire [2018] UKSC 4) rather than running the full Caparo test.\n• Essays: use it to trace the development of duty — neighbour principle → Anns → Caparo → Robinson’s incremental approach.',
      tags: ['duty-of-care', 'neighbour-principle', 'negligence', 'product-liability', 'foreseeability'],
      memorised: false
    },
    {
      id: 'sample-hra',
      module: 'public',
      topic: 'Human Rights Act 1998 – Interpretation & Declarations of Incompatibility',
      type: 'statute',
      name: 'Human Rights Act 1998, ss 3–4',
      citation: 'Human Rights Act 1998, ss 3, 4',
      facts: 'Context: the HRA 1998 gives further effect in UK law to rights in the European Convention on Human Rights. It came into force on 2 October 2000. It was designed to preserve parliamentary sovereignty — courts cannot strike down Acts of Parliament. Key illustration: in Ghaidan v Godin-Mendoza [2004] UKHL 30 the House of Lords read "as his or her wife or husband" in the Rent Act 1977 to include same-sex partners.',
      ratio: 's 3(1): "So far as it is possible to do so, primary legislation and subordinate legislation must be read and given effect in a way which is compatible with the Convention rights." This is a strong obligation which can apply even where the words are not ambiguous (Ghaidan), but the court must not adopt a meaning inconsistent with a fundamental feature of the legislation. s 3(2)(b): it does not affect the validity, continuing operation or enforcement of incompatible primary legislation.\ns 4: if a compatible reading is impossible, a higher court may make a declaration of incompatibility. By s 4(6) a declaration does not affect the validity of the provision and is not binding on the parties (e.g. Bellinger v Bellinger [2003] UKHL 21).',
      strategy: 'Structure a human rights problem as:\n1. Is a Convention right engaged?\n2. Is there an interference, and is it justified and proportionate?\n3. If the legislation is incompatible, can it be read compatibly under s 3 (Ghaidan)?\n4. If not, a s 4 declaration — stress that the law stays in force and any change is for Parliament (e.g. a remedial order under s 10).\nIn sovereignty essays, use ss 3–4 to show the "dialogue" model between courts and Parliament.',
      tags: ['human-rights', 'echr', 'statutory-interpretation', 'parliamentary-sovereignty', 'declaration-of-incompatibility'],
      memorised: false
    }
  ];

  /* ------------------------------------------------------------------
     C. MOCK EXAM SCENARIO BANK
     Fixed, hand-written problem questions (2 per module). The generator
     picks one at random, preferring modules and topics that appear in
     YOUR library. Nothing is invented at run time.
     ------------------------------------------------------------------ */
  var SCENARIOS = [
    /* ---------- CONTRACT ---------- */
    {
      id: 'contract-formation', module: 'contract', topic: 'Formation – Offer & Acceptance',
      title: 'The Raleigh Chopper',
      keywords: ['offer', 'acceptance', 'invitation', 'treat', 'unilateral', 'counter', 'postal', 'revocation', 'formation', 'advert', 'consideration'],
      text: 'Priya runs a small vintage bicycle shop. On Monday 1 March she posts on the shop\'s Instagram page: "Fully restored 1972 Raleigh Chopper — £900. First person to transfer a £100 deposit to our account gets it!"\n\nThat afternoon Ben sends a direct message: "Love it. I\'ll give you £800?" Priya does not reply.\n\nOn Tuesday 2 March, Priya emails her regular customer Dev: "Dev, I know you\'ve been after a Chopper. I\'ll hold it for you until Friday if you want it at £900." On Thursday 4 March Dev posts a letter saying "Yes please — I\'ll take it." The letter arrives on Monday 8 March.\n\nOn Wednesday 3 March at 6pm, Carla transfers £100 to the shop\'s account and emails Priya to say so. At 7pm, Ben messages: "OK fine, £900 it is — transferring the deposit now," and transfers £100.\n\nOn Thursday 4 March at noon, Ellie walks into the shop and offers £1,000 in cash. Priya accepts, and that evening texts Dev: "Sorry, the Chopper has gone." Dev had already posted his letter.\n\nBen, Carla and Dev each claim that Priya has broken a contract with them. Advise Priya.',
      issues: [
        'Is the Instagram post an invitation to treat (Partridge v Crittenden; Fisher v Bell) or a unilateral offer (Carlill v Carbolic Smoke Ball Co)?',
        'Ben\'s "£800?" — a counter-offer destroying the original offer (Hyde v Wrench) or a mere request for information (Stevenson v McLean)?',
        'Acceptance of a unilateral offer by performance — who performed first (Carla at 6pm)?',
        'Dev: is Priya bound to keep the offer open until Friday without consideration (Routledge v Grant)?',
        'Dev: does the postal rule apply (Adams v Lindsell; Household Fire Insurance v Grant; Holwell Securities v Hughes)?',
        'Revocation must be communicated (Byrne v Van Tienhoven), but may come via a reliable third party (Dickinson v Dodds) — timing of the text vs posting of the letter.'
      ]
    },
    {
      id: 'contract-exclusion', module: 'contract', topic: 'Terms – Exclusion Clauses',
      title: 'ShinePro Valeting',
      keywords: ['exclusion', 'clause', 'incorporation', 'unfair', 'ucta', 'consumer', 'cra', 'terms', 'reasonableness', 'signature', 'notice'],
      text: 'Marcus is a self-employed plumber. He books two valets at ShinePro Ltd: one for the van he uses for his plumbing business, and one for his personal car.\n\nAt the front desk he is handed a dense, double-sided form and told to "just sign at the bottom so we can get going". He signs without reading it. In small print on the back, clause 14 states: "ShinePro accepts no liability for any loss or damage howsoever caused."\n\nAfter paying, Marcus walks past a sign on the wall of the waiting area (which he had not seen when he arrived) stating: "Valuables are left entirely at the owner\'s risk."\n\nWhen he returns, the van has a deep scratch along one side, caused by an employee carelessly dragging a pressure-washer hose across it. A laptop that Marcus left on the back seat of his car is missing; CCTV shows a ShinePro employee leaving it unattended on a bench beside the open street door.\n\nShinePro points to clause 14 and the sign. Advise Marcus.',
      issues: [
        'Incorporation by signature (L\'Estrange v Graucob) and the limits of that rule (Curtis v Chemical Cleaning — misrepresentation of effect).',
        'Incorporation by notice: timing (Olley v Marlborough Court; Thornton v Shoe Lane Parking) and onerous terms (Interfoto v Stiletto).',
        'Construction: does "howsoever caused" clearly cover negligence (Canada Steamship; contra proferentem — CRA 2015 s 69 for consumers)?',
        'Van — business contract: Unfair Contract Terms Act 1977 s 2(2) and the reasonableness test (s 11, Sch 2 guidelines).',
        'Car — consumer contract: Consumer Rights Act 2015 s 49 (reasonable care and skill), s 57 (cannot exclude s 49 liability), s 62 (fairness), s 65.'
      ]
    },
    /* ---------- TORT ---------- */
    {
      id: 'tort-negligence', module: 'tort', topic: 'Negligence – Breach, Causation & Psychiatric Harm',
      title: 'The Learner Driver',
      keywords: ['negligence', 'breach', 'standard', 'causation', 'loss', 'chance', 'clinical', 'bolam', 'psychiatric', 'secondary', 'victim', 'duty', 'remoteness'],
      text: 'Jamal, aged 17, is having his third driving lesson in his aunt Rosa\'s car, with Rosa supervising. A dog runs into the road; Jamal panics, swerves, mounts the pavement and strikes Mrs Okafor, aged 68, breaking her hip.\n\nAt St Bede\'s Hospital, a junior doctor working a 14-hour shift fails to order an X-ray for six hours, believing Mrs Okafor\'s pain to be bruising. An expert reports that some orthopaedic surgeons would also have waited, but most would not. Expert evidence also states that, had she been treated promptly, there was a 30% chance she would have avoided the permanent limp she now has.\n\nMr Okafor was at work when the accident happened. He arrives at the hospital two hours later, sees his wife in severe pain on a trolley in a corridor, and later develops post-traumatic stress disorder.\n\nJamal argues that, as a learner, he cannot be expected to drive like an experienced driver. Advise Mr and Mrs Okafor.',
      issues: [
        'Duty: established categories — road users; doctor–patient (Robinson v CC West Yorkshire).',
        'Standard of care of a learner driver: the reasonably competent driver (Nettleship v Weston); emergencies.',
        'Clinical negligence: Bolam test as qualified by Bolitho; inexperience is no excuse (Wilsher v Essex AHA).',
        'Causation: "but for" and loss of a chance in personal injury (Hotson v East Berkshire AHA; Gregg v Scott).',
        'Mr Okafor as secondary victim: Alcock control mechanisms; aftermath (McLoughlin v O\'Brian); medical negligence cases (Paul v Royal Wolverhampton NHS Trust [2024] UKSC 1).'
      ]
    },
    {
      id: 'tort-occupiers', module: 'tort', topic: 'Occupiers’ Liability',
      title: 'Fernhill Leisure Centre',
      keywords: ['occupiers', 'liability', 'visitor', 'trespasser', 'warning', 'child', 'contractor', '1957', '1984', 'premises'],
      text: 'Fernhill Leisure Centre is run by Fernhill Council.\n\n(1) Hannah, a gym member, slips on a wet changing-room floor and breaks her wrist. A small yellow "Caution: Wet Floor" sign had been placed at the far end of the room, partly hidden behind a bench. The floor had been mopped 40 minutes earlier and was still wet.\n\n(2) Leo, aged 11, and his friends regularly climb over a broken section of the centre\'s rear fence to play on a flat roof. Staff have chased children off the roof several times this year and reported the broken fence to managers. Leo falls through a fragile skylight and is seriously injured.\n\n(3) Arun, a visiting swimming coach, receives an electric shock from a hand dryer installed a month ago by Sparks Ltd, an apparently reputable electrical firm hired by the council. Sparks Ltd wired it incorrectly.\n\nAdvise Hannah, Leo and Arun.',
      issues: [
        'Hannah: visitor; common duty of care under Occupiers’ Liability Act 1957 s 2(2); whether the warning was enough to keep her reasonably safe (s 2(4)(a)).',
        'Leo: trespasser — Occupiers’ Liability Act 1984 s 1(3) (awareness of danger; reasonable grounds to believe trespassers nearby; risk one against which protection is reasonable).',
        'Children: occupiers must be prepared for children to be less careful (1957 Act s 2(3)(a)); compare Tomlinson v Congleton BC and Keown v Coventry Healthcare NHS Trust.',
        'Arun: work entrusted to an independent contractor — s 2(4)(b) (reasonable care in selecting and checking; Haseldine v Daw; Woodward v Mayor of Hastings).',
        'Defences: contributory negligence, volenti (s 2(5) of the 1957 Act; s 1(6) of the 1984 Act).'
      ]
    },
    /* ---------- PUBLIC LAW ---------- */
    {
      id: 'public-jr', module: 'public', topic: 'Judicial Review – Grounds',
      title: 'The Housing Grant Refusal',
      keywords: ['judicial', 'review', 'illegality', 'irrationality', 'procedural', 'legitimate', 'expectation', 'ouster', 'fairness', 'improper', 'purpose', 'discretion'],
      text: 'The (fictional) Community Housing Act 2025, s 4, provides: "The Secretary of State may make grants to local authorities for the purpose of improving housing conditions." Section 9 provides: "No decision under section 4 shall be called into question in any court."\n\nIn January, the Department wrote to all councils: "Before any grant application is refused, the council will be given an opportunity to make representations."\n\nRiverside Council applies for a £5 million grant to repair damp-affected social housing. In June, the Secretary of State refuses the application in a one-line letter, without inviting representations. A leaked email from her adviser says: "Riverside voted to oppose our planning reforms — let them wait." The Department also adopted an internal rule in March that no council with a budget deficit will ever receive a grant; Riverside has a small deficit.\n\nRiverside\'s lawyers first consider challenging the decision in late October. Advise Riverside Council.',
      issues: [
        'Ouster clause in s 9: Anisminic v FCC; R (Privacy International) v IPT [2019] UKSC 22.',
        'Illegality — improper purpose and irrelevant considerations (Padfield v Minister of Agriculture; R v Somerset CC, ex p Fewings).',
        'Fettering discretion by a rigid policy (British Oxygen v Board of Trade).',
        'Procedural legitimate expectation from the January letter (AG of Hong Kong v Ng Yuen Shiu; R v North and East Devon HA, ex p Coughlan); duty to give reasons.',
        'Irrationality (Wednesbury; CCSU v Minister for the Civil Service).',
        'Procedure: time limit — promptly and in any event within 3 months (CPR 54.5); standing; remedies.'
      ]
    },
    {
      id: 'public-hra', module: 'public', topic: 'Human Rights Act 1998',
      title: 'The Climate Protest Ban',
      keywords: ['human', 'rights', 'echr', 'proportionality', 'declaration', 'incompatibility', 'section', 'interpretation', 'sovereignty', 'protest', 'article'],
      text: 'The (fictional) Public Order (Assemblies) Act 2025, s 7, provides: "A senior police officer may prohibit any public assembly which in the officer\'s opinion is likely to cause serious annoyance to members of the public. Any person who takes part in a prohibited assembly commits an offence."\n\nCommunity groups in Northtown plan a peaceful, two-hour climate march along a high street on a Saturday afternoon. The Chief Superintendent prohibits it under s 7 because "shoppers are likely to be seriously annoyed by the noise". No alternative route or time is offered.\n\nZara, one of the organisers, holds a small silent vigil of six people at the planned starting point on the day. She is arrested and charged under s 7.\n\nZara argues that s 7 and the prohibition breach her human rights. Advise Zara on the arguments available under the Human Rights Act 1998, and on what a court can and cannot do if s 7 is found to be incompatible.',
      issues: [
        'Articles 10 and 11 ECHR engaged; is there an interference "prescribed by law" with a legitimate aim?',
        'Proportionality (Bank Mellat v HM Treasury (No 2); DPP v Ziegler [2021] UKSC 23).',
        'Police as a public authority: HRA s 6 — acting incompatibly is unlawful.',
        'Can s 7 be read compatibly under HRA s 3 (Ghaidan v Godin-Mendoza)? Limits of the "possible" reading.',
        'If not, a s 4 declaration of incompatibility — s 4(6): no effect on validity; parliamentary sovereignty.'
      ]
    },
    /* ---------- CRIMINAL ---------- */
    {
      id: 'criminal-nfo', module: 'criminal', topic: 'Non-Fatal Offences & Self-Defence',
      title: 'Closing Time at the Crown',
      keywords: ['assault', 'battery', 'abh', 'wounding', 'gbh', 'transferred', 'malice', 'self-defence', 'intoxication', 'non-fatal', 'offences'],
      text: 'At closing time at the Crown pub, Tom (who has drunk six pints) is shoved in the back by Lee, a stranger, who shouts: "Move, or I\'ll glass you!" Tom turns and punches Lee once in the face. Lee falls backwards and hits his head on a table, suffering a cut to his scalp that needs four stitches.\n\nLee\'s friend Sam steps towards Tom. Tom, believing Sam is about to attack him, grabs a pint glass and throws it at Sam. Sam ducks; the glass hits Nadia, a bar worker, cutting her cheek and leaving a permanent scar. In fact Sam had been moving forward to pull Lee away.\n\nWhen interviewed, Tom says: "I was terrified. I just reacted. I wasn\'t trying to hurt anyone badly."\n\nDiscuss Tom\'s criminal liability.',
      issues: [
        'Assault and battery (Criminal Justice Act 1988 s 39); ABH (Offences Against the Person Act 1861 s 47; Savage; Roberts).',
        'Wounding: both layers of skin broken (JCC v Eisenhower) — s 20 (maliciously: foresight of some harm, Mowatt) vs s 18 (intent).',
        'Transferred malice from Sam to Nadia (R v Latimer); is a permanent scar "grievous bodily harm" (Bollom)?',
        'Self-defence: Criminal Justice and Immigration Act 2008 s 76; honest belief (Gladstone Williams); reasonable force (Palmer v R).',
        'Voluntary intoxication: s 76(5) — mistaken belief attributable to intoxication; basic vs specific intent (DPP v Majewski).'
      ]
    },
    {
      id: 'criminal-homicide', module: 'criminal', topic: 'Homicide – Partial Defences',
      title: 'The Hammer',
      keywords: ['murder', 'homicide', 'loss', 'control', 'diminished', 'responsibility', 'intention', 'causation', 'manslaughter', 'oblique'],
      text: 'For six years Ruth has lived with Gary, who controls her finances, monitors her phone, and frequently humiliates her in front of their children. Ruth has been diagnosed with moderate depression and takes prescribed medication.\n\nOne evening Gary tells Ruth he has hired a lawyer and will "make sure you never see the kids again — no court will believe a mental case like you." He then falls asleep on the sofa. Ruth sits in the kitchen for around twenty minutes, crying and shaking. She then takes a hammer from a toolbox and strikes Gary twice on the head.\n\nGary is taken to hospital with a fractured skull. A doctor fails to notice a developing bleed on the brain for several hours, which experts say significantly reduced his chances of survival. Gary dies three days later.\n\nRuth tells police: "I just snapped. I couldn\'t take any more. I didn\'t mean to kill him — I just wanted it to stop."\n\nDiscuss Ruth\'s liability for Gary\'s death.',
      issues: [
        'Causation: is the hospital\'s negligence a novus actus interveniens (R v Cheshire; R v Jordan; R v Smith)?',
        'Mens rea of murder: intention to kill or cause GBH; oblique intent (R v Woollin).',
        'Loss of control: Coroners and Justice Act 2009 ss 54–55 — loss need not be sudden (s 54(2)); considered desire for revenge (s 54(4)); qualifying triggers; the objective test (R v Clinton; R v Dawes).',
        'Diminished responsibility: Homicide Act 1957 s 2 as amended by CJA 2009 s 52 — recognised medical condition, substantial impairment (R v Golds), explanation.',
        'Alternative: unlawful act manslaughter if murder mens rea is not proved.'
      ]
    },
    /* ---------- LAND ---------- */
    {
      id: 'land-coownership', module: 'land', topic: 'Co-ownership & Overriding Interests',
      title: 'Willow Cottage',
      keywords: ['co-ownership', 'constructive', 'trust', 'overriding', 'actual', 'occupation', 'overreaching', 'mortgage', 'registered', 'tolata', 'beneficial'],
      text: 'In 2019 Amir and Beth, an unmarried couple, bought Willow Cottage for £400,000. The property was registered in Amir\'s sole name because Beth had a poor credit history. Beth paid £60,000 towards the deposit from her savings; the rest was funded by a mortgage in Amir\'s name. Since then, Beth has paid for the new kitchen and half of the household bills. Beth\'s mother, Clara, moved into the spare room in 2022.\n\nIn 2025, without telling Beth or Clara, Amir took out a second loan of £150,000 from QuickLend plc, secured by a registered charge over Willow Cottage. QuickLend\'s surveyor visited while Beth was at work and Clara was in hospital; the surveyor noticed women\'s coats in the hallway but asked no questions.\n\nAmir has now left the country and the loan is in arrears. QuickLend seeks possession and sale. Advise Beth and Clara.',
      issues: [
        'Does Beth have a beneficial interest? Common intention constructive trust (Lloyds Bank v Rosset; Stack v Dowden; Jones v Kernott); quantification.',
        'Clara: any interest at all? (Contributions? Licence only?)',
        'Overreaching: capital money paid to a single trustee — no overreaching (City of London BS v Flegg; Williams & Glyn\'s Bank v Boland).',
        'Overriding interest of a person in actual occupation: Land Registration Act 2002 Sch 3 para 2 — "obvious on a reasonably careful inspection" / actual knowledge; temporary absence (Link Lending v Bustard).',
        'Order for sale: Trusts of Land and Appointment of Trustees Act 1996 ss 14–15 (Mortgage Corp v Shaire).'
      ]
    },
    {
      id: 'land-easements', module: 'land', topic: 'Easements & Freehold Covenants',
      title: 'The Path to Greenacre',
      keywords: ['easement', 'covenant', 'restrictive', 'prescription', 'wheeldon', 'section', '62', 'annexation', 'tulk', 'burden', 'benefit'],
      text: 'In 1998 Olivia owned Greenacre, a large house with a paddock. She sold the paddock to Paul. In the conveyance Paul covenanted, for himself and his successors, "not to build more than one dwelling on the paddock" and "to maintain the boundary fence in good repair". The conveyance stated that the covenants were for the benefit of "the land retained by the vendor known as Greenacre".\n\nSince 1998 Paul and his family have walked daily across a gravel path on Greenacre to reach the village shop. Nobody ever objected, and no permission was asked for or given.\n\nIn 2023 Olivia sold Greenacre to Rita. In 2024 Paul sold the paddock to Westbuild Ltd, which plans to build six houses, has let the fence collapse, and continues to use the path. Rita has now locked a gate across the path.\n\nAdvise Rita and Westbuild Ltd.',
      issues: [
        'Is the right of way capable of being an easement (Re Ellenborough Park)?',
        'Acquisition by prescription: 20 years\' use "as of right" — nec vi, nec clam, nec precario (common law, lost modern grant, Prescription Act 1832).',
        'Burden of the restrictive covenant passing in equity (Tulk v Moxhay): negative; benefits dominant land; intended to run; registration/notice.',
        'Positive covenant (fence) — burden does not run at law or in equity (Austerberry v Oldham; Rhone v Stephens); indirect methods (Halsall v Brizell).',
        'Benefit passing to Rita: annexation — Law of Property Act 1925 s 78 (Federated Homes v Mill Lodge); express annexation.'
      ]
    },
    /* ---------- TRUSTS / EQUITY ---------- */
    {
      id: 'trusts-certainties', module: 'trusts', topic: 'Three Certainties & Formalities',
      title: 'Aunt Harriet’s Wishes',
      keywords: ['certainty', 'certainties', 'intention', 'subject', 'matter', 'objects', 'discretionary', 'formalities', 'constitution', 'precatory', 'writing'],
      text: 'Harriet died last month. Her valid will contains the following gifts:\n\n(a) "£50,000 to my nephew Oliver, in the full confidence that he will use it to look after my old friends from the bridge club."\n\n(b) "My shares in Lumen plc to my trustees, to distribute among such of my former employees and their dependants as my trustees in their absolute discretion select."\n\n(c) "Most of my jewellery to my goddaughter Isla, on trust for herself and her sister in equal shares."\n\nIn addition, a year before her death, Harriet told her niece Mia over lunch: "From today I hold my seaside flat on trust for you." Nothing was put in writing. Harriet also signed a stock transfer form for 1,000 shares in another company in favour of her friend Kemi and posted it to Kemi, but it never reached the company before her death.\n\nAdvise Harriet\'s executors on the validity of each of these arrangements.',
      issues: [
        'Certainty of intention: precatory words (Re Adams and the Kensington Vestry; Comiskey v Bowring-Hanbury).',
        'Certainty of objects for a discretionary trust — the "is or is not" test (McPhail v Doulton; Re Baden\'s Deed Trusts (No 2)); administrative workability.',
        'Certainty of subject matter: "most of my jewellery" (Palmer v Simmonds; Sprange v Barnard).',
        'Declaration of trust of land must be evidenced in signed writing: Law of Property Act 1925 s 53(1)(b).',
        'Constitution: Milroy v Lord; every effort / unconscionability (Re Rose; Pennington v Waine).'
      ]
    },
    {
      id: 'trusts-tracing', module: 'trusts', topic: 'Breach of Trust & Tracing',
      title: 'Ken’s Mixed Account',
      keywords: ['tracing', 'breach', 'mixed', 'fund', 'hallett', 'oatway', 'lowest', 'intermediate', 'balance', 'proprietary', 'personal', 'remedy', 'trustee'],
      text: 'Ken is the sole trustee of a family trust for his nieces, Freya and Gita. In January he transferred £20,000 of trust money into his personal current account, which already contained £10,000 of his own money.\n\nIn February he withdrew £15,000 from that account and bought a painting, which has since been valued at £30,000. In March he spent £12,000 from the account on a holiday. In April he received his salary of £3,000 into the account. The account now contains £6,000.\n\nKen has also used £8,000 of trust money to pay off part of the mortgage on his house.\n\nKen has many debts and is likely to be made bankrupt. Advise Freya and Gita on their remedies.',
      issues: [
        'Personal liability of the trustee for breach of trust; possible relief under Trustee Act 1925 s 61 (unlikely).',
        'Tracing into a mixed fund: trustee presumed to spend his own money first (Re Hallett\'s Estate) vs beneficiaries\' right to claim the asset bought (Re Oatway).',
        'Claiming the increase in value — proportionate share (Foskett v McKeown).',
        'Lowest intermediate balance rule (Roscoe v Winder): later salary payments are not treated as repaying the trust.',
        'Money used to pay off a mortgage: backwards tracing/subrogation (Foskett v McKeown; Federal Republic of Brazil v Durant; Boscawen v Bajwa).',
        'Why a proprietary claim matters on Ken\'s bankruptcy.'
      ]
    },
    /* ---------- RETAINED EU LAW ---------- */
    {
      id: 'eu-direct-effect', module: 'eu', topic: 'Direct Effect, Indirect Effect & State Liability',
      title: 'The Equal Retirement Age',
      keywords: ['direct', 'effect', 'directive', 'vertical', 'horizontal', 'emanation', 'indirect', 'state', 'liability', 'francovich', 'supremacy', 'retained'],
      text: 'Assume all of the following events took place in 2019, before the UK left the EU.\n\nA (fictional) EU Directive required Member States, by 1 January 2018, to ensure that employers do not dismiss employees on grounds of age before the age of 67. The UK had not implemented it; national legislation still allowed compulsory retirement at 65.\n\n(1) Maria works for Aqua Utilities plc, a privatised water company which provides water services under a statutory licence, is subject to a government regulator, and has special statutory powers to enter land. She is forced to retire at 65.\n\n(2) Her friend Joanna is forced to retire at 65 by Bloom Ltd, a private florist.\n\n(3) Pedro, forced to retire at 65 by a private company, has been unable to obtain any remedy under national law.\n\nAdvise Maria, Joanna and Pedro on the remedies that would have been available under EU law at the time. Then briefly explain how the position differs for events occurring in the UK today, following the European Union (Withdrawal) Act 2018 and the Retained EU Law (Revocation and Reform) Act 2023.',
      issues: [
        'Conditions for direct effect (Van Gend en Loos; Van Duyn); Directives after the implementation deadline (Ratti).',
        'Vertical direct effect only (Marshall v Southampton AHA); emanation of the state (Foster v British Gas; Farrell v Whitty).',
        'No horizontal direct effect for Joanna (Faccini Dori) — indirect effect / consistent interpretation (Von Colson; Marleasing).',
        'State liability for non-implementation (Francovich; Brasserie du Pêcheur / Factortame III).',
        'Post-Brexit: retained ("assimilated") law; REUL Act 2023 removes the general principle of supremacy and directly effective rights recognised under s 4 EUWA 2018 from the end of 2023.'
      ]
    },
    {
      id: 'eu-goods', module: 'eu', topic: 'Free Movement of Goods',
      title: 'Oat Drinks and Energy Drinks',
      keywords: ['goods', 'free', 'movement', 'article', '34', '36', 'dassonville', 'cassis', 'keck', 'quantitative', 'restriction', 'mandatory', 'requirements', 'proportionality'],
      text: 'Assume these events take place in Member State X, an EU Member State.\n\nState X introduces three new rules:\n\n(1) Plant-based drinks may not be sold in packaging that is green or white, "to avoid confusion with dairy milk". Lumi Oats, a Swedish company, sells its oat drink across the EU in white cartons and would need new packaging just for State X.\n\n(2) All energy drinks must be retested in a State X laboratory before sale, even if already tested and lawfully sold in another Member State. Testing takes eight months.\n\n(3) Energy drinks may only be sold in pharmacies, and may not be sold in supermarkets. The rule applies equally to drinks made in State X and imported drinks, but almost all energy drinks sold in State X are imported.\n\nState X argues the rules protect consumers and public health. Advise Lumi Oats and an Austrian energy-drink producer, Volt GmbH.',
      issues: [
        'Article 34 TFEU — measures having equivalent effect to quantitative restrictions (Dassonville).',
        'Product requirements and mutual recognition (Cassis de Dijon); mandatory requirements, e.g. consumer protection.',
        'Selling arrangements outside Art 34 if they affect domestic and imported goods equally in law and in fact (Keck and Mithouard); market access.',
        'Justification under Article 36 (public health) and proportionality — is there a less restrictive alternative (e.g. labelling)?',
        'Double testing burden (e.g. Commission v France (foie gras); Rewe-Zentral).'
      ]
    }
  ];

