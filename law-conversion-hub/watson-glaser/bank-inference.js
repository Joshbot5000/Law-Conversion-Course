/*
 * bank-inference.js: inference passage structures, each with many settings.
 *
 * A structure fixes the logic: which statements are True, Probably true and
 * so on follows from the shape of the passage, not from the setting. Each
 * setting (fill) only supplies nouns and phrases, so it cannot change an
 * answer. {^name} inserts a slot with a capital first letter.
 */
(function (root) {
  'use strict';
  const B = root.WG_BANK = root.WG_BANK || {};

  const pilotPolicies = [
    { pid: 'flexi', policy: 'start and finish work at times of their own choosing', arrangement: 'flexible hours' },
    { pid: 'fourday', policy: 'work four longer days instead of five', arrangement: 'four-day week' },
    { pid: 'nomeet', policy: 'keep Wednesdays free of all meetings', arrangement: 'meeting-free Wednesdays' },
    { pid: 'wfh2', policy: 'work from home two days a week', arrangement: 'two home-working days' },
    { pid: 'lunch', policy: 'take a longer lunch break for exercise', arrangement: 'longer exercise breaks' },
    { pid: 'quiet', policy: 'turn off email notifications every morning', arrangement: 'email-free mornings' }
  ];
  const pilotTeams = [
    { tid: 'cs', team: 'customer service team', output: 'number of calls answered' },
    { tid: 'acc', team: 'accounts team', output: 'number of invoices processed' },
    { tid: 'lit', team: 'litigation team', output: 'number of billable hours' },
    { tid: 'des', team: 'design team', output: 'number of projects completed' },
    { tid: 'it', team: 'IT support team', output: 'number of support requests resolved' },
    { tid: 'hr', team: 'HR team', output: 'number of cases closed' },
    { tid: 'conv', team: 'property team', output: 'number of house sales completed' }
  ];

  B.INF_FRAMES = [
    {
      id: 'session',
      nums: h => ({ n: h.ri(25, 80) }),
      passage: '{n} {people} chose to attend an optional {session} on {when}. At the end, they voted for "{topic}" as the subject they most wanted covered at the next session.',
      statements: [
        { a: 'T', text: 'At least some {group} were willing to give up {giveUp} for {kind}.',
          why: 'The passage says {n} {group} chose to attend an optional {session} on {when}. Choosing to go to something optional at that time is giving up {giveUp} for {kind}. If the facts are true, this must be true.' },
        { a: 'PT', text: 'As a group, the {group} who attended were more interested in {field} than most other {group}.',
          why: 'People who give up {giveUp} for an optional {session} are likely to be keener on the subject than those who did not go. That makes this more likely true than false. It is not certain (some may have gone to network, or because they were encouraged to), so it is Probably true.' },
        { a: 'ID', text: 'The {session} was led by {leader}.',
          why: 'The passage says nothing about who led the {session}. Nothing tips the balance either way, so it is Insufficient data.' },
        { a: 'ID', text: 'Most of those who attended had {background}.',
          why: 'Nothing in the passage tells you about the background of the people who attended. Insufficient data.' },
        { a: 'PF', text: 'Most of those who attended felt they had little left to learn about {area}.',
          why: 'They voted for "{topic}" to be covered next, which suggests they wanted to learn more about {area}. That points against this statement. A vote shows a preference rather than exactly what each person felt, so it is not ruled out completely: Probably false.' },
        { a: 'F', text: 'Attendance at the {session} was compulsory.',
          why: 'The passage says the {session} was optional and that people chose to attend. "Compulsory" contradicts that, so it is False.' },
        { a: 'F', text: 'They voted for "{other}" as the subject for the next session.',
          why: 'The passage tells you exactly what they voted for: "{topic}". This contradicts it, so it is False.' }
      ],
      fills: [
        { id: 'jdoc', people: 'junior doctors at a city hospital', group: 'junior doctors', session: 'workshop on breaking bad news', when: 'a Saturday morning', giveUp: 'part of a weekend', kind: 'training', field: 'communicating with patients', topic: 'talking to anxious relatives', area: 'communicating with patients and families', other: 'hospital car parking', leader: 'a senior consultant', background: 'trained at the same medical school' },
        { id: 'teach', people: 'teachers from local primary schools', group: 'primary teachers', session: 'evening seminar on managing classroom behaviour', when: 'a weekday evening after school', giveUp: 'an evening', kind: 'professional development', field: 'managing classroom behaviour', topic: 'supporting pupils with additional needs', area: 'managing pupils\' behaviour and needs', other: 'school uniform suppliers', leader: 'an educational psychologist', background: 'taught for more than ten years' },
        { id: 'para', people: 'paralegals at a regional law firm', group: 'paralegals', session: 'workshop on legal research', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'training', field: 'legal research', topic: 'finding recent case law quickly', area: 'legal research', other: 'office catering', leader: 'a law librarian', background: 'a law degree' },
        { id: 'foodbank', people: 'volunteers at a food bank', group: 'food bank volunteers', session: 'training session on fundraising', when: 'a Sunday afternoon', giveUp: 'part of a weekend', kind: 'training', field: 'fundraising', topic: 'running sponsored events', area: 'fundraising', other: 'car park opening hours', leader: 'the food bank\'s manager', background: 'volunteered there for more than a year' },
        { id: 'elec', people: 'apprentice electricians', group: 'apprentice electricians', session: 'evening class on workplace safety', when: 'a weekday evening', giveUp: 'an evening', kind: 'training', field: 'workplace safety', topic: 'working safely at height', area: 'workplace safety', other: 'canteen menus', leader: 'a health and safety inspector', background: 'left school at 16' },
        { id: 'nurse', people: 'nurses on a children\'s ward', group: 'children\'s nurses', session: 'workshop on managing children\'s pain', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'training', field: 'managing children\'s pain', topic: 'calming frightened children before procedures', area: 'caring for children in pain', other: 'staff parking permits', leader: 'a consultant anaesthetist', background: 'worked on the ward for more than five years' },
        { id: 'acct', people: 'accountancy trainees', group: 'accountancy trainees', session: 'revision workshop on tax', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'study', field: 'tax', topic: 'corporation tax calculations', area: 'tax', other: 'office dress codes', leader: 'a tax partner', background: 'studied maths at A-level' },
        { id: 'police', people: 'officers from a rural police force', group: 'police officers', session: 'evening course on investigating online fraud', when: 'a weekday evening', giveUp: 'an evening', kind: 'training', field: 'investigating online crime', topic: 'tracing payments made online', area: 'investigating online fraud', other: 'uniform design', leader: 'a fraud specialist from a bank', background: 'served for more than ten years' },
        { id: 'moot', people: 'first-year law students', group: 'first-year law students', session: 'mooting workshop', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'study', field: 'advocacy', topic: 'answering questions from the judge', area: 'advocacy', other: 'library opening hours', leader: 'a practising barrister', background: 'taken part in a moot before' },
        { id: 'dev', people: 'software developers at a bank', group: 'developers', session: 'workshop on cyber security', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'training', field: 'cyber security', topic: 'spotting phishing attacks', area: 'cyber security', other: 'office parking', leader: 'an external security consultant', background: 'a computer science degree' },
        { id: 'social', people: 'social workers', group: 'social workers', session: 'evening seminar on mental capacity law', when: 'a weekday evening', giveUp: 'an evening', kind: 'training', field: 'mental capacity law', topic: 'assessing capacity in older adults', area: 'mental capacity law', other: 'mileage expenses', leader: 'a solicitor', background: 'qualified within the last five years' },
        { id: 'pharm', people: 'community pharmacists', group: 'pharmacists', session: 'workshop on prescribing', when: 'a Sunday', giveUp: 'part of a weekend', kind: 'training', field: 'prescribing', topic: 'prescribing for older patients', area: 'prescribing', other: 'pharmacy shop displays', leader: 'a GP', background: 'worked in a hospital pharmacy' },
        { id: 'coach', people: 'volunteer football coaches', group: 'volunteer coaches', session: 'coaching workshop', when: 'a Sunday morning', giveUp: 'part of a weekend', kind: 'training', field: 'coaching young players', topic: 'keeping young players motivated', area: 'coaching young players', other: 'kit sponsorship deals', leader: 'a former professional player', background: 'played football at county level' },
        { id: 'journo', people: 'trainee journalists', group: 'trainee journalists', session: 'workshop on court reporting', when: 'a Saturday', giveUp: 'part of a weekend', kind: 'training', field: 'court reporting', topic: 'reporting restrictions in criminal trials', area: 'court reporting', other: 'newsroom furniture', leader: 'a court reporter', background: 'studied journalism at university' },
        { id: 'arch', people: 'junior architects', group: 'junior architects', session: 'evening talk on sustainable design', when: 'a weekday evening', giveUp: 'an evening', kind: 'professional development', field: 'sustainable design', topic: 'designing low-energy homes', area: 'sustainable design', other: 'office parties', leader: 'a structural engineer', background: 'studied abroad' }
      ]
    },
    {
      id: 'survey',
      nums: h => ({ n: h.ri(3, 9) * 100, p: h.ri(76, 93), c: h.ri(16, 31) }),
      passage: 'Last year, {org} surveyed {n} of its {members}. {p}% said they would recommend {thing} to a friend. The most common complaint, made by {c}% of those surveyed, was that {complaint}.',
      statements: [
        { a: 'T', text: 'Some of the {members} surveyed were unhappy about {issue}.',
          why: '{c}% of those surveyed complained that {complaint}. Making that complaint shows they were unhappy about {issue}, so this must be true.' },
        { a: 'T', text: 'Fewer than half of those surveyed complained that {complaint}.',
          why: 'The passage gives this figure as {c}%, which is less than 50%. True.' },
        { a: 'ID', text: 'The survey was carried out by an independent research company.',
          why: 'The passage says {org} surveyed its {members}, but not who actually ran the survey. Insufficient data.' },
        { a: 'ID', text: '{idClaim}',
          why: 'Nothing in the passage tells you this. Insufficient data.' },
        { a: 'PF', text: 'Most of those surveyed {experienced}.',
          why: 'This was the most common complaint, yet only {c}% made it. If most people (over 50%) had experienced it, you would expect far more than {c}% to complain. People can be unhappy without complaining, so it is not ruled out: Probably false.' },
        { a: 'F', text: 'Fewer than half of those surveyed said they would recommend {thing} to a friend.',
          why: 'The passage says {p}% would recommend it, which is more than half. False.' }
      ],
      fills: [
        { id: 'broadband', org: 'a broadband provider', members: 'customers', thing: 'its service', complaint: 'it took too long to get through to customer service', issue: 'how long it took to reach customer service', experienced: 'found it took too long to get through to customer service', idClaim: 'The provider has more customers than any other broadband company in the country.' },
        { id: 'gym', org: 'a gym chain', members: 'members', thing: 'the gym', complaint: 'the changing rooms were too crowded at peak times', issue: 'crowded changing rooms', experienced: 'found the changing rooms too crowded at peak times', idClaim: 'The gym chain is the cheapest in the region.' },
        { id: 'housing', org: 'a housing association', members: 'tenants', thing: 'the association', complaint: 'repairs took too long to be carried out', issue: 'the time repairs took', experienced: 'found that repairs took too long', idClaim: 'The association owns more homes than any other landlord in its area.' },
        { id: 'bus', org: 'a bus company', members: 'passengers', thing: 'its services', complaint: 'buses did not run often enough in the evenings', issue: 'how often buses ran in the evenings', experienced: 'found that evening buses did not run often enough', idClaim: 'The bus company is owned by the local council.' },
        { id: 'dentist', org: 'a dental practice', members: 'patients', thing: 'the practice', complaint: 'it was hard to get an appointment at short notice', issue: 'getting appointments at short notice', experienced: 'found it hard to get an appointment at short notice', idClaim: 'The practice has more dentists than any other practice in the town.' },
        { id: 'course', org: 'an online law course', members: 'students', thing: 'the course', complaint: 'feedback on assignments arrived too slowly', issue: 'how quickly feedback arrived', experienced: 'found that feedback on assignments arrived too slowly', idClaim: 'Most of the course\'s students work full-time.' },
        { id: 'hotel', org: 'a hotel group', members: 'guests', thing: 'its hotels', complaint: 'the Wi-Fi was unreliable', issue: 'the Wi-Fi', experienced: 'found the Wi-Fi unreliable', idClaim: 'Most of the hotel group\'s guests are travelling for business.' },
        { id: 'library', org: 'a city library service', members: 'members', thing: 'the library', complaint: 'opening hours were too short at weekends', issue: 'weekend opening hours', experienced: 'found weekend opening hours too short', idClaim: 'Most of the library\'s members borrow e-books.' },
        { id: 'vet', org: 'a veterinary practice', members: 'registered pet owners', thing: 'the practice', complaint: 'bills were not explained clearly', issue: 'how bills were explained', experienced: 'found that bills were not explained clearly', idClaim: 'Most of the practice\'s patients are dogs.' },
        { id: 'careers', org: 'a university careers service', members: 'student users', thing: 'the service', complaint: 'appointments were hard to book during term time', issue: 'booking appointments in term time', experienced: 'found appointments hard to book during term time', idClaim: 'Most of the students who used the service were in their final year.' },
        { id: 'energy', org: 'an energy supplier', members: 'customers', thing: 'the supplier', complaint: 'bills were difficult to understand', issue: 'how easy their bills were to understand', experienced: 'found their bills difficult to understand', idClaim: 'The supplier generates most of its electricity from wind.' },
        { id: 'council', org: 'a council\'s planning department', members: 'applicants', thing: 'the department', complaint: 'it was hard to find out how an application was progressing', issue: 'tracking the progress of applications', experienced: 'found it hard to find out how their application was progressing', idClaim: 'Most applications to the department are for house extensions.' }
      ]
    },
    {
      id: 'relocate',
      nums: h => { const a = h.ri(30, 48), c = h.ri(40, 75); return { a, b: a - h.ri(10, 20), c, d: c + h.ri(15, 30) }; },
      passage: '{^org} moved to a new site {location}. In the year after the move, the number of {people} who {modeA} fell from {a} to {b}, while the number who {modeB} rose from {c} to {d}. The total number of {people} stayed the same.',
      statements: [
        { a: 'T', text: 'More {people} {modeB} in the year after the move than before it.',
          why: 'The passage says the number rose from {c} to {d}. True.' },
        { a: 'PT', text: 'The new site\'s location made it easier for some {people} to {modeBinf}.',
          why: 'The new site is {location}, and the number who {modeB} rose soon after the move. That makes it likely the location helped, but the passage does not say why the number rose, so it is not certain. Probably true.' },
        { a: 'ID', text: 'The new site cost more to buy or rent than the old one.',
          why: 'The passage says nothing about cost. Insufficient data.' },
        { a: 'ID', text: 'Most of the {people} live within five miles of the new site.',
          why: 'Nothing in the passage tells you where the {people} live. Insufficient data.' },
        { a: 'PF', text: 'On the whole, {people} found the new site harder to reach by {modeBnoun} than the old one.',
          why: 'More {people} {modeB} after the move to a site {location}. That points strongly against the new site being harder to reach that way, but does not strictly rule it out. Probably false.' },
        { a: 'F', text: 'The number of {people} who {modeA} went up after the move.',
          why: 'The passage says it fell, from {a} to {b}. False.' },
        { a: 'F', text: 'The total number of {people} increased in the year after the move.',
          why: 'The passage says the total stayed the same. False.' }
      ],
      fills: [
        { id: 'school', org: 'a secondary school', location: 'next to a new bus station', people: 'pupils', modeA: 'were driven to school', modeB: 'travelled to school by bus', modeBinf: 'travel to school by bus', modeBnoun: 'bus' },
        { id: 'clinic', org: 'a hospital outpatient clinic', location: 'beside a tram stop', people: 'patients', modeA: 'drove to their appointments', modeB: 'came by tram', modeBinf: 'get to appointments by tram', modeBnoun: 'tram' },
        { id: 'councilhq', org: 'a council\'s main office', location: 'in the town centre near the bus station', people: 'staff', modeA: 'drove to work', modeB: 'travelled to work by bus', modeBinf: 'travel to work by bus', modeBnoun: 'bus' },
        { id: 'college', org: 'a sixth-form college', orgThe: 'the college', location: 'next to a railway station', people: 'students', modeA: 'were driven to college', modeB: 'travelled by train', modeBinf: 'travel to college by train', modeBnoun: 'train' },
        { id: 'gym', org: 'a gym', location: 'next to a busy cycle path', people: 'regular members', modeA: 'drove to the gym', modeB: 'cycled to the gym', modeBinf: 'cycle to the gym', modeBnoun: 'bike' },
        { id: 'accfirm', org: 'an accountancy firm', location: 'beside an underground station', people: 'staff', modeA: 'drove to work', modeB: 'commuted by underground', modeBinf: 'commute by underground', modeBnoun: 'underground' },
        { id: 'library', org: 'a town library', location: 'inside a shopping centre with a large bus interchange', people: 'regular visitors', modeA: 'drove to the library', modeB: 'came by bus', modeBinf: 'get to the library by bus', modeBnoun: 'bus' },
        { id: 'court', org: 'a county court', location: 'next to the main railway station', people: 'staff', modeA: 'drove to work', modeB: 'commuted by train', modeBinf: 'commute by train', modeBnoun: 'train' },
        { id: 'uni', org: 'a university law school', location: 'on a new campus served by a dedicated cycle route', people: 'students', modeA: 'drove to lectures', modeB: 'cycled to lectures', modeBinf: 'cycle to lectures', modeBnoun: 'bike' }
      ]
    },
    {
      id: 'capacity',
      nums: h => ({ n: h.ri(30, 70) * 10, k: h.ri(5, 15) }),
      passage: 'Every {day}, a free {service} run by volunteer {volunteers} opens at {venue}. Last year it helped {n} visitors. {^category} made up more than half of all enquiries, and on {k} {sessions} it had to turn people away because there were not enough volunteers to see everyone.',
      statements: [
        { a: 'T', text: 'On at least one {session} last year, the {service} could not see everyone who wanted help.',
          why: 'The passage says that on {k} {sessions} it had to turn people away. So on at least one {session} it could not see everyone. True.' },
        { a: 'T', text: '{^category} made up a larger share of enquiries than any other single type.',
          why: 'They made up more than half of all enquiries. If one type is more than half, all the others together are less than half, so no other single type can be bigger. True.' },
        { a: 'PT', text: 'If more volunteers had been available last year, the {service} would have been able to help more people.',
          why: 'The passage gives a shortage of volunteers as the reason people were turned away. More volunteers would probably have meant more people helped, but something else (such as space) might also have limited it. Probably true.' },
        { a: 'ID', text: 'Most of last year\'s visitors were over the age of 40.',
          why: 'The passage says nothing about visitors\' ages. Insufficient data.' },
        { a: 'F', text: 'The {service} charges visitors a fee.',
          why: 'The passage describes it as free. False.' },
        { a: 'F', text: 'Last year the {service} always had enough volunteers to see everyone who came.',
          why: 'On {k} {sessions} it turned people away for lack of volunteers. False.' }
      ],
      fills: [
        { id: 'tax', day: 'Saturday morning', service: 'tax-return help service', volunteers: 'accountancy students', venue: 'the town library', category: 'questions about self-employment', session: 'morning', sessions: 'mornings' },
        { id: 'bike', day: 'Tuesday evening', service: 'bike repair workshop', volunteers: 'mechanics', venue: 'a community hall', category: 'puncture repairs', session: 'evening', sessions: 'evenings' },
        { id: 'cv', day: 'Monday evening', service: 'CV and job application clinic', volunteers: 'recruitment professionals', venue: 'the job centre', category: 'questions about CVs', session: 'evening', sessions: 'evenings' },
        { id: 'digital', day: 'Thursday afternoon', service: 'digital skills drop-in', volunteers: 'IT students', venue: 'a community centre', category: 'problems with smartphones', session: 'afternoon', sessions: 'afternoons' },
        { id: 'debt', day: 'Wednesday evening', service: 'debt advice clinic', volunteers: 'trained advisers', venue: 'a church hall', category: 'credit card debts', session: 'evening', sessions: 'evenings' },
        { id: 'homework', day: 'Sunday afternoon', service: 'homework help club', volunteers: 'university students', venue: 'a youth centre', category: 'maths questions', session: 'afternoon', sessions: 'afternoons' },
        { id: 'energy', day: 'Friday morning', service: 'energy bill advice service', volunteers: 'retired engineers', venue: 'a village hall', category: 'questions about prepayment meters', session: 'morning', sessions: 'mornings' },
        { id: 'immig', day: 'Tuesday morning', service: 'immigration advice drop-in', volunteers: 'law graduates', venue: 'a community centre', category: 'questions about visa renewals', session: 'morning', sessions: 'mornings' },
        { id: 'tenancy', day: 'Thursday evening', service: 'tenancy rights clinic', volunteers: 'law students', venue: 'the students\' union', category: 'disputes over deposits', session: 'evening', sessions: 'evenings' }
      ]
    },
    {
      id: 'selection',
      nums: h => ({ n: h.ri(8, 40) * 100, t: h.ri(5, 30), y: h.ri(2021, 2025) }),
      passage: 'In {y}, {org} received {n} applications for {t} {places}, and filled all of them. Every successful applicant had completed {prior}. {^orgThe} says that, when choosing between applicants, it values {quality} above everything else.',
      statements: [
        { a: 'T', text: 'Some people who applied to {orgThe2} in {y} did not get a place.',
          why: 'There were {n} applications for only {t} places. Even allowing for anyone who applied twice, far more people applied than there were places, so some must have missed out. True.' },
        { a: 'T', text: 'Everyone who got a place had {spentTime} before being offered it.',
          why: 'Every successful applicant had completed {prior}, which means they had {spentTime}. True.' },
        { a: 'PT', text: 'Completing {prior} improved an applicant\'s chances of getting a place.',
          why: 'Every single successful applicant had done it, out of {n} applications. That strongly suggests it helped, but it is not certain (in theory every applicant might have done it). Probably true.' },
        { a: 'ID', text: 'Most applicants {idClaim}.',
          why: 'The passage says nothing about this. Insufficient data.' },
        { a: 'PF', text: '{^quality} played little or no part in how {orgThe2} chose between applicants.',
          why: '{^orgThe} says it values {quality} above everything else, which points against this. But the passage only tells you what it says, not what it actually did, so it is not ruled out. Probably false.' },
        { a: 'F', text: 'At least one person got a place without completing {prior}.',
          why: 'The passage says every successful applicant had completed {prior}. False.' }
      ],
      fills: [
        { id: 'nhs', org: 'a hospital trust', orgThe: 'the trust', orgThe2: 'the trust', places: 'graduate management places', prior: 'a work placement at the trust', spentTime: 'spent time working at the trust', quality: 'compassion', idClaim: 'had a degree in a health subject' },
        { id: 'pub', org: 'a publishing house', orgThe: 'the publisher', orgThe2: 'the publisher', places: 'editorial assistant posts', prior: 'a summer internship with the publisher', spentTime: 'worked at the publisher', quality: 'attention to detail', idClaim: 'had studied English at university' },
        { id: 'academy', org: 'a football club\'s academy', orgThe: 'the club', orgThe2: 'the club', places: 'academy places', prior: 'a trial week at the club', spentTime: 'trained at the club', quality: 'attitude', idClaim: 'lived within 30 miles of the club' },
        { id: 'bank', org: 'a bank', orgThe: 'the bank', orgThe2: 'the bank', places: 'graduate scheme places', prior: 'a spring internship at the bank', spentTime: 'worked at the bank', quality: 'teamwork', idClaim: 'had studied economics' },
        { id: 'theatre', org: 'a theatre company', orgThe: 'the company', orgThe2: 'the company', places: 'places in its young company', prior: 'a summer workshop with the company', spentTime: 'worked with the company', quality: 'creativity', idClaim: 'had been to drama school' },
        { id: 'chambers', org: 'a barristers\' chambers', orgThe: 'the chambers', orgThe2: 'the chambers', places: 'pupillages', prior: 'a mini-pupillage at the chambers', spentTime: 'spent time at the chambers', quality: 'advocacy skill', idClaim: 'had studied law as their first degree' },
        { id: 'eng', org: 'an engineering firm', orgThe: 'the firm', orgThe2: 'the firm', places: 'apprenticeships', prior: 'a work-experience week at the firm', spentTime: 'spent time at the firm', quality: 'problem-solving', idClaim: 'had studied physics at A-level' },
        { id: 'paper', org: 'a regional newspaper', orgThe: 'the paper', orgThe2: 'the paper', places: 'trainee reporter posts', prior: 'a work-experience placement at the paper', spentTime: 'worked at the paper', quality: 'curiosity', idClaim: 'had a journalism degree' },
        { id: 'civil', org: 'a government department', orgThe: 'the department', orgThe2: 'the department', places: 'policy trainee posts', prior: 'a summer placement in the department', spentTime: 'worked in the department', quality: 'clear writing', idClaim: 'had a postgraduate degree' }
      ]
    },
    {
      id: 'pilot',
      nums: h => { const n = h.ri(18, 32); return { n, p: n - h.ri(1, 4), x: h.ri(10, 30), months: h.ri(3, 9), firm: h.firm() }; },
      passage: 'For {months} months, {firm} let the {n} members of its {team} {policy}. During the trial, the team\'s {output} was unchanged and sickness absence fell by {x}%. At the end, {p} of the {n} team members asked for the arrangement to continue.',
      statements: [
        { a: 'T', text: 'At least one member of the {team} wanted the {arrangement} to continue.',
          why: '{p} members asked for it to continue, which shows they wanted it to. True.' },
        { a: 'T', text: 'The team\'s {output} did not fall during the trial.',
          why: 'The passage says it was unchanged, so it did not fall. True.' },
        { a: 'PT', text: 'Most members of the {team} found the {arrangement} at least as convenient as their old working pattern.',
          why: 'Nearly everyone ({p} of {n}) asked for it to continue, which suggests they found it convenient. Someone might want it to continue for another reason, so it is not certain. Probably true.' },
        { a: 'ID', text: 'Other teams at {firm} have asked to try the {arrangement}.',
          why: 'The passage only talks about the {team}. Insufficient data.' },
        { a: 'PF', text: 'Most members of the {team} found the {arrangement} unhelpful.',
          why: '{p} of the {n} members asked for it to continue, which would be very odd if most found it unhelpful. Not strictly impossible, so Probably false.' },
        { a: 'F', text: 'The trial ran for more than a year.',
          why: 'The passage says it ran for {months} months. False.' },
        { a: 'F', text: 'Sickness absence in the {team} rose during the trial.',
          why: 'The passage says it fell by {x}%. False.' }
      ],
      fills: pilotPolicies.flatMap(p => pilotTeams.map(t => Object.assign({ id: p.pid + '-' + t.tid }, p, t)))
    },
    {
      id: 'charge',
      nums: h => ({ p: h.ri(20, 60) }),
      passage: '{^org} introduced a charge of {x} {chargeFor}. In the year after the charge was introduced, {usage} fell by {p}%, and {substitute} {rose}.',
      statements: [
        { a: 'T', text: 'In the year after the charge was introduced, {usage} was lower than before.',
          why: 'The passage says it fell by {p}%. True.' },
        { a: 'PT', text: 'Some people switched to {alternative} instead of paying the charge.',
          why: 'Use fell and {substitute} {rose} right after the charge started. That makes it likely that some people switched, but the passage does not prove why. Probably true.' },
        { a: 'ID', text: 'The money raised by the charge was spent on {spend}.',
          why: 'The passage says nothing about what happened to the money. Insufficient data.' },
        { a: 'PF', text: 'The charge had no effect on {behaviour}.',
          why: 'Use fell and {substitute} {rose} straight after the charge began, which strongly suggests it did have an effect. Something else could explain both changes, so it is not ruled out completely. Probably false.' },
        { a: 'F', text: 'After the charge was introduced, {substitute} fell.',
          why: 'The passage says {substitute} {rose}. False.' },
        { a: 'F', text: '{^freeThing} remained free in the year after the charge was introduced.',
          why: 'The passage says a charge of {x} was introduced. False.' }
      ],
      fills: [
        { id: 'bags', x: '10p', org: 'a supermarket chain', chargeFor: 'for each single-use carrier bag', usage: 'the number of single-use bags the chain gave out', substitute: 'sales of the chain\'s reusable bags', rose: 'tripled', alternative: 'reusable bags', spend: 'staff training', behaviour: 'how many single-use bags shoppers took', freeThing: 'single-use carrier bags' },
        { id: 'cups', x: '25p', org: 'a coffee chain', chargeFor: 'for each disposable cup', usage: 'the number of disposable cups the chain used', substitute: 'sales of the chain\'s reusable cups', rose: 'doubled', alternative: 'reusable cups', spend: 'new shop furniture', behaviour: 'how many disposable cups customers used', freeThing: 'disposable cups' },
        { id: 'bulky', x: '£25', org: 'a council', chargeFor: 'for collecting bulky household items', usage: 'the number of bulky item collections', substitute: 'visits to the council\'s recycling centre', rose: 'rose sharply', alternative: 'taking items to the recycling centre themselves', spend: 'road repairs', behaviour: 'how residents got rid of bulky items', freeThing: 'bulky item collections' },
        { id: 'print', x: '5p', org: 'a university', chargeFor: 'for each page printed in its libraries', usage: 'the number of pages printed in the university\'s libraries', substitute: 'sales of tablets at the campus shop', rose: 'doubled', alternative: 'reading on screen', spend: 'library books', behaviour: 'how much students printed', freeThing: 'printing in the university\'s libraries' },
        { id: 'parking', x: '£3', org: 'a city council', chargeFor: 'a day for parking on residential streets near the station', usage: 'the number of cars parked on those streets', substitute: 'sales of season tickets for the station\'s cycle shelter', rose: 'doubled', alternative: 'cycling to the station', spend: 'new street lights', behaviour: 'how people travelled to the station', freeThing: 'parking on those streets' },
        { id: 'garden', x: '£40', org: 'a town council', chargeFor: 'a year for collecting garden waste', usage: 'the weight of garden waste the council collected', substitute: 'sales of compost bins at the town\'s garden centres', rose: 'doubled', alternative: 'composting at home', spend: 'park maintenance', behaviour: 'how residents dealt with garden waste', freeThing: 'garden waste collections' },
        { id: 'water', x: '£1', org: 'a sports centre', chargeFor: 'for each bottle of water from its vending machines', usage: 'the number of bottles of water the centre sold', substitute: 'use of the centre\'s free water fountains', rose: 'tripled', alternative: 'the free water fountains', spend: 'new gym equipment', behaviour: 'how visitors got drinking water', freeThing: 'bottled water from the vending machines' }
      ]
    },
    {
      id: 'waits',
      nums: h => { const a = h.ri(10, 30), y1 = h.ri(2019, 2023), j1 = h.ri(40, 90); return { a, b: a + h.ri(6, 20), j1, j2: j1 - h.ri(6, 15), y1, y2: y1 + 2 }; },
      passage: 'Figures show that the average wait for {thing} in {area} rose from {a} {unit} in {y1} to {b} {unit} in {y2}. Over the same period, the number of {staff} fell from {j1} to {j2}, while the number of {demand} stayed roughly the same.',
      statements: [
        { a: 'T', text: 'On average, people in {area} waited longer for {thing} in {y2} than in {y1}.',
          why: 'The average wait rose from {a} to {b} {unit}. True.' },
        { a: 'PT', text: 'The fall in the number of {staff} helped to cause the longer waits.',
          why: 'Fewer {staff} usually means less can be handled, and the waits grew while demand stayed about the same. That makes the fall a likely cause, but the passage does not prove it. Probably true.' },
        { a: 'ID', text: '{idClaim}',
          why: 'Nothing in the passage tells you this. Insufficient data.' },
        { a: 'PF', text: 'Having more {staff} would make waits for {thing} even longer.',
          why: 'Common knowledge (which you may use) says more {staff} can handle more work, and the passage links fewer {staff} with longer waits. So this is unlikely, though not strictly impossible. Probably false.' },
        { a: 'F', text: 'There were far more {demand} in {y2} than in {y1}.',
          why: 'The passage says the number stayed roughly the same. False.' },
        { a: 'F', text: 'The number of {staff} rose between {y1} and {y2}.',
          why: 'It fell, from {j1} to {j2}. False.' }
      ],
      fills: [
        { id: 'gp', thing: 'a GP appointment', area: 'one market town', unit: 'days', staff: 'GPs working in the town', demand: 'patients registered with the town\'s practices', idClaim: 'Most patients registered with the town\'s practices are over 60.' },
        { id: 'planning', thing: 'a planning decision', area: 'one district', unit: 'weeks', staff: 'planning officers employed by the council', demand: 'planning applications received', idClaim: 'Most planning applications received are for house extensions.' },
        { id: 'passport', thing: 'a passport renewal', area: 'one region', unit: 'days', staff: 'staff processing renewals', demand: 'renewal applications', idClaim: 'Most renewal applications are made online.' },
        { id: 'tribunal', thing: 'an employment tribunal hearing', area: 'one region', unit: 'weeks', staff: 'employment judges sitting', demand: 'claims received', idClaim: 'Most claims received are about unfair dismissal.' },
        { id: 'repairs', thing: 'a council house repair', area: 'one city', unit: 'days', staff: 'repair workers employed by the council', demand: 'repair requests', idClaim: 'Most repair requests are about heating.' },
        { id: 'driving', thing: 'a driving test', area: 'one county', unit: 'weeks', staff: 'driving examiners', demand: 'test bookings', idClaim: 'Most test bookings are for automatic cars.' },
        { id: 'probate', thing: 'a grant of probate', area: 'one region', unit: 'weeks', staff: 'probate staff', demand: 'probate applications', idClaim: 'Most probate applications are made by solicitors.' },
        { id: 'family', thing: 'a family court hearing', area: 'one region', unit: 'weeks', staff: 'family judges sitting', demand: 'cases issued', idClaim: 'Most cases issued are about arrangements for children.' }
      ]
    },
    {
      id: 'tech',
      nums: h => { const n = h.ri(30, 90), a = h.ri(7, 14); return { n, k: h.ri(4, 12), a, b: a - h.ri(3, 5) }; },
      passage: '{^org} with {n} {sites} trialled {tech} at {k} of them. In the trial {sites}, the average wait for {service} at busy times fell from {a} minutes to {b} minutes. Complaints about waiting fell in those {sites}, but complaints about {techShort} not working rose sharply.',
      statements: [
        { a: 'T', text: 'In the trial {sites}, the average wait for {service} at busy times was shorter after {tech} were introduced.',
          why: 'It fell from {a} to {b} minutes. True.' },
        { a: 'T', text: 'Not all of the {sites} took part in the trial.',
          why: 'Only {k} of the {n} {sites} did. True.' },
        { a: 'PT', text: '{^tech} helped to cut waiting times in the trial {sites}.',
          why: 'Waits fell in the {sites} that got them, which suggests they helped. Other things could have changed too, so it is not certain. Probably true.' },
        { a: 'ID', text: 'The {sites} chosen for the trial were the busiest ones.',
          why: 'The passage does not say how the trial {sites} were chosen. Insufficient data.' },
        { a: 'PF', text: 'People in the trial {sites} were more satisfied with how reliable the equipment was during the trial than before it.',
          why: 'Complaints about {techShort} not working rose sharply, which points against greater satisfaction with reliability. Not ruled out completely, so Probably false.' },
        { a: 'F', text: 'The average wait for {service} at busy times rose in the trial {sites}.',
          why: 'It fell, from {a} to {b} minutes. False.' }
      ],
      fills: [
        { id: 'library', org: 'a library service', sites: 'libraries', tech: 'self-service book kiosks', service: 'borrowing or returning books', techShort: 'the kiosks' },
        { id: 'airport', org: 'an airport group', sites: 'airports', tech: 'automatic passport gates', service: 'passport control', techShort: 'the gates' },
        { id: 'rail', org: 'a railway company', sites: 'stations', tech: 'new ticket machines', service: 'buying a ticket', techShort: 'the machines' },
        { id: 'hosp', org: 'a hospital group', sites: 'hospitals', tech: 'self check-in screens', service: 'checking in for appointments', techShort: 'the screens' },
        { id: 'food', org: 'a fast-food chain', sites: 'restaurants', tech: 'touchscreen ordering points', service: 'placing an order', techShort: 'the touchscreens' },
        { id: 'court', org: 'a court service', sites: 'court buildings', tech: 'automatic security scanners', service: 'getting through security', techShort: 'the scanners' },
        { id: 'post', org: 'a postal service', sites: 'post offices', tech: 'self-service parcel machines', service: 'sending a parcel', techShort: 'the machines' }
      ]
    },
    {
      id: 'event',
      nums: h => ({ n: h.ri(80, 200), k: h.ri(25, 50), m: h.ri(4, 14), city: h.city() }),
      passage: '{n} people attended {event} run by {org} in {city}. Afterwards, {k} of them {action}. In the previous year, when no {eventShort} was held, {orgThe} received {m} {results} in total.',
      statements: [
        { a: 'T', text: 'Not everyone who attended the {eventShort} {actionShort}.',
          why: '{n} people attended but only {k} of them did. True.' },
        { a: 'T', text: '{^orgThe} received more {results} this year than in the previous year.',
          why: 'At least {k} came from the {eventShort} alone this year, against {m} in total last year. {k} is more than {m}, so this must be true.' },
        { a: 'PT', text: 'The {eventShort} encouraged some people to {actionInf} who would not otherwise have done so.',
          why: 'The numbers jumped in the year the {eventShort} was held, which suggests it helped. There could be other reasons, so Probably true.' },
        { a: 'ID', text: 'The {eventShort} was held on a weekday.',
          why: 'The passage does not say when it was held. Insufficient data.' },
        { a: 'PF', text: 'People in {city} were less interested in {orgThe} this year than the year before.',
          why: 'Far more people {actionShort} this year, which points against interest having fallen. Not impossible, so Probably false.' },
        { a: 'F', text: '{^orgThe} received fewer {results} this year than in the previous year.',
          why: 'At least {k} this year against {m} last year. False.' }
      ],
      fills: [
        { id: 'sixth', event: 'an open evening', eventShort: 'open evening', org: 'a sixth-form college', orgThe: 'the college', action: 'applied for a place', actionInf: 'apply for a place', actionShort: 'applied for a place', results: 'applications' },
        { id: 'rowing', event: 'a taster day', eventShort: 'taster day', org: 'a rowing club', orgThe: 'the club', action: 'joined the club', actionInf: 'join the club', actionShort: 'joined the club', results: 'new members' },
        { id: 'charity', event: 'an information evening', eventShort: 'information evening', org: 'a volunteering charity', orgThe: 'the charity', action: 'signed up to volunteer', actionInf: 'sign up to volunteer', actionShort: 'signed up to volunteer', results: 'volunteer sign-ups' },
        { id: 'climb', event: 'a free trial day', eventShort: 'trial day', org: 'a climbing centre', orgThe: 'the centre', action: 'bought a membership', actionInf: 'buy a membership', actionShort: 'bought a membership', results: 'new memberships' },
        { id: 'apprent', event: 'a careers fair stand', eventShort: 'careers fair stand', org: 'an engineering firm', orgThe: 'the firm', action: 'applied for its apprenticeship', actionInf: 'apply for the apprenticeship', actionShort: 'applied for the apprenticeship', results: 'apprenticeship applications' },
        { id: 'lawschool', event: 'an open day', eventShort: 'open day', org: 'a law school', orgThe: 'the law school', action: 'applied for its conversion course', actionInf: 'apply for the conversion course', actionShort: 'applied for the conversion course', results: 'applications for the course' },
        { id: 'choir', event: 'a come-and-sing afternoon', eventShort: 'come-and-sing afternoon', org: 'a community choir', orgThe: 'the choir', action: 'joined the choir', actionInf: 'join the choir', actionShort: 'joined the choir', results: 'new members' },
        { id: 'insight', event: 'a careers evening', eventShort: 'careers evening', org: 'a regional law firm', orgThe: 'the firm', action: 'applied for its insight scheme', actionInf: 'apply for the insight scheme', actionShort: 'applied for the insight scheme', results: 'insight scheme applications' }
      ]
    },
    {
      id: 'demand',
      nums: h => ({ n: h.ri(6, 30) * 10, w: h.ri(25, 160) }),
      passage: '{^org} offered {n} free places on {course} for {eligible} last {season}. All of the places were taken within two days of bookings opening, and a waiting list of {w} {waitNoun} was set up.',
      statements: [
        { a: 'T', text: 'More {waitNoun} wanted a place on {courseThe} than there were places available.',
          why: 'All {n} places were taken and {w} more {waitNoun} joined the waiting list. True.' },
        { a: 'PT', text: 'If {orgThe} offers {courseThe} again next {season}, more {waitNoun} will want places than there are places.',
          why: 'Places went within two days and there was a long waiting list, so similar demand next time is likely. The future is not certain, so Probably true.' },
        { a: 'ID', text: '{idClaim}',
          why: 'Nothing in the passage tells you this. Insufficient data.' },
        { a: 'F', text: 'Some places on {courseThe} were still available a week after bookings opened.',
          why: 'All places were taken within two days. False.' },
        { a: 'F', text: '{ineligible}',
          why: 'The places were for {eligible} only. False.' }
      ],
      fills: [
        { id: 'firstaid', org: 'a borough council', orgThe: 'the council', course: 'a first-aid course', courseThe: 'the first-aid course', eligible: 'adults living in the borough', season: 'spring', waitNoun: 'people', ineligible: 'People living outside the borough could book a place.', idClaim: 'Most of those who took part had done a first-aid course before.' },
        { id: 'coding', org: 'a coding charity', orgThe: 'the charity', course: 'a summer coding camp', courseThe: 'the coding camp', eligible: 'children aged 12 to 16', season: 'summer', waitNoun: 'children', ineligible: 'Ten-year-olds could book a place.', idClaim: 'Most of the children who took part had written computer code before.' },
        { id: 'money', org: 'a housing association', orgThe: 'the association', course: 'a money management workshop', courseThe: 'the workshop', eligible: 'its tenants', season: 'autumn', waitNoun: 'tenants', ineligible: 'People who were not tenants of the association could book a place.', idClaim: 'Most of those who took part were in debt.' },
        { id: 'summerschool', org: 'a university', orgThe: 'the university', course: 'a law summer school', courseThe: 'the summer school', eligible: 'Year 12 students at state schools', season: 'summer', waitNoun: 'students', ineligible: 'Students at private schools could book a place.', idClaim: 'Most of those who took part lived in the same city as the university.' },
        { id: 'tennis', org: 'a sports trust', orgThe: 'the trust', course: 'tennis coaching sessions', courseThe: 'the coaching sessions', eligible: 'adults over 60', season: 'spring', waitNoun: 'people', ineligible: 'Adults in their thirties could book a place.', idClaim: 'Most of those who took part had played tennis before.' },
        { id: 'writing', org: 'a city library', orgThe: 'the library', course: 'a creative writing course', courseThe: 'the writing course', eligible: 'teenagers aged 13 to 17', season: 'winter', waitNoun: 'teenagers', ineligible: 'Adults could book a place.', idClaim: 'Most of those who took part wanted to become writers.' },
        { id: 'swim', org: 'a charity', orgThe: 'the charity', course: 'adult swimming lessons', courseThe: 'the swimming lessons', eligible: 'adults who could not swim', season: 'summer', waitNoun: 'people', ineligible: 'Strong swimmers could book a place.', idClaim: 'Most of those who took part were over 50.' },
        { id: 'allot', org: 'a parish council', orgThe: 'the council', course: 'a beginners\' gardening course', courseThe: 'the gardening course', eligible: 'new allotment holders', season: 'spring', waitNoun: 'people', ineligible: 'People without an allotment could book a place.', idClaim: 'Most of those who took part were retired.' }
      ]
    },
    {
      id: 'quarter',
      nums: h => { const h0 = h.ri(30, 80) * 100; return { h0, h1: h0 + h.ri(4, 25) * 100 }; },
      passage: 'Last year, {members} at {org} {verb} a total of {h1} {unit}, up from {h0} the year before. {^sub}, who make up about a quarter of {orgPoss} {members}, accounted for more than half of last year\'s total.',
      statements: [
        { a: 'T', text: '{^members} at {orgThe} {verb} more {unit} last year than the year before.',
          why: '{h1} is more than {h0}. True.' },
        { a: 'T', text: 'On average, {sub2} {verb} more {unit} last year than the rest of {orgPoss} {members}.',
          why: 'About a quarter of the {members} produced more than half of the total, so the other three-quarters produced less than half. Sharing more {unit} among fewer people gives a higher average per person, so this must be true. The maths settles it.' },
        { a: 'PT', text: '{^activity} is more strongly encouraged among {sub2} than among the rest of {orgPoss} {members}.',
          why: 'They do far more on average, which suggests it is encouraged more. There could be other reasons, so Probably true.' },
        { a: 'ID', text: '{idClaim}',
          why: 'The passage says nothing about this. Insufficient data.' },
        { a: 'PF', text: '{^activity} was discouraged among {sub2} last year.',
          why: 'With only about a quarter of the {members}, they produced more than half of the total. That points against it being discouraged, though it is not impossible. Probably false.' },
        { a: 'F', text: 'The total number of {unit} {verbPresent} by {members} at {orgThe} fell last year.',
          why: 'It rose, from {h0} to {h1}. False.' }
      ],
      fills: [
        { id: 'hospital', members: 'volunteers', org: 'a city hospital', orgPoss: 'the hospital\'s', orgThe: 'the hospital', verb: 'gave', verbPresent: 'given', unit: 'hours of their time', sub: 'the volunteers on the children\'s ward', sub2: 'the volunteers on the children\'s ward', activity: 'volunteering', idClaim: 'Most of the hospital\'s volunteers are students.' },
        { id: 'bank', members: 'staff', org: 'a high-street bank', orgPoss: 'the bank\'s', orgThe: 'the bank', verb: 'spent', verbPresent: 'spent', unit: 'hours volunteering in schools', sub: 'staff in its Leeds office', sub2: 'staff in the Leeds office', activity: 'school volunteering', idClaim: 'Most of the volunteering took place in primary schools.' },
        { id: 'uni', members: 'students', org: 'a university', orgPoss: 'the university\'s', orgThe: 'the university', verb: 'logged', verbPresent: 'logged', unit: 'hours of community work', sub: 'students in the law school', sub2: 'law school students', activity: 'community work', idClaim: 'Most of the community work was with older people.' },
        { id: 'accfirm', members: 'staff', org: 'an accountancy firm', orgPoss: 'the firm\'s', orgThe: 'the firm', verb: 'completed', verbPresent: 'completed', unit: 'hours of optional training', sub: 'staff in its tax department', sub2: 'staff in the tax department', activity: 'optional training', idClaim: 'Most of the training was done online.' },
        { id: 'retailer', members: 'store staff', org: 'a retail chain', orgPoss: 'the chain\'s', orgThe: 'the chain', verb: 'collected', verbPresent: 'collected', unit: 'items for food banks', sub: 'staff in its Scottish stores', sub2: 'staff in the Scottish stores', activity: 'collecting for food banks', idClaim: 'Most of the items collected were tinned food.' },
        { id: 'council', members: 'employees', org: 'a county council', orgPoss: 'the council\'s', orgThe: 'the council', verb: 'recorded', verbPresent: 'recorded', unit: 'hours of charity work', sub: 'employees in its libraries service', sub2: 'library service employees', activity: 'charity work', idClaim: 'Most of the charity work was done at weekends.' }
      ]
    },
    {
      id: 'control',
      nums: h => ({ p: h.ri(18, 40), period: h.pick(['year', 'two years']) }),
      passage: '{^org} introduced {change} in {areaA}. In the {period} after the change, {outcome} in {areaA} was {p}% lower than in the {period} before it. In {areaB}, where {noChange}, the figure stayed roughly the same.',
      statements: [
        { a: 'T', text: '{^outcome} in {areaA} was lower in the {period} after the change than in the {period} before it.',
          why: 'The passage says it was {p}% lower. True.' },
        { a: 'PT', text: '{^changeThe} helped to reduce {outcome} in {areaA}.',
          why: 'The figure fell where the change was made but stayed the same where it was not. That points to the change as a likely cause, but it is not proven. Probably true.' },
        { a: 'ID', text: 'Most local people supported the change.',
          why: 'The passage says nothing about what people thought. Insufficient data.' },
        { a: 'PF', text: 'The fall in {areaA} was mainly caused by a general improvement across all of {org2}\'s areas.',
          why: 'If things had improved everywhere, you would expect the figure in {areaB} to fall too, but it stayed the same. That makes this unlikely, but not impossible. Probably false.' },
        { a: 'F', text: 'The figure fell by a similar amount in {areaA} and {areaB}.',
          why: 'In {areaB} it stayed roughly the same. False.' },
        { a: 'F', text: 'The same change was also made in {areaB}.',
          why: 'The passage says that in {areaB}, {noChange}. False.' }
      ],
      fills: [
        { id: 'lights', org: 'a city council', org2: 'the city', change: 'brighter lighting', changeThe: 'the brighter lighting', areaA: 'the eastern parks', areaB: 'the western parks', outcome: 'the number of reported thefts', noChange: 'the lighting was not changed' },
        { id: 'breakfast', org: 'a school trust', org2: 'the trust', change: 'a free breakfast club', changeThe: 'the breakfast club', areaA: 'five of the trust\'s primary schools', areaB: 'the trust\'s other primary schools', outcome: 'the number of pupils arriving late', noChange: 'no breakfast club was introduced' },
        { id: 'platform', org: 'a train company', org2: 'the company', change: 'extra platform staff', changeThe: 'the extra platform staff', areaA: 'the busiest stations', areaB: 'the other stations', outcome: 'the number of reported assaults on staff', noChange: 'staffing did not change' },
        { id: 'falls', org: 'a hospital', org2: 'the hospital', change: 'a falls-prevention programme', changeThe: 'the falls-prevention programme', areaA: 'the older people\'s wards', areaB: 'the other wards', outcome: 'the number of patient falls', noChange: 'no programme was introduced' },
        { id: 'repairs', org: 'a housing association', org2: 'the association', change: 'a dedicated repairs phone line', changeThe: 'the repairs phone line', areaA: 'the northern estates', areaB: 'the southern estates', outcome: 'the number of complaints about repairs', noChange: 'the repairs line was not available' },
        { id: 'tags', org: 'a supermarket chain', org2: 'the chain', change: 'security tags on expensive items', changeThe: 'the security tags', areaA: 'the city-centre stores', areaB: 'the out-of-town stores', outcome: 'the value of goods stolen', noChange: 'no tags were added' },
        { id: 'speed', org: 'a county council', org2: 'the county', change: 'speed cameras', changeThe: 'the speed cameras', areaA: 'main roads through villages', areaB: 'other main roads', outcome: 'the number of collisions causing injury', noChange: 'no cameras were installed' }
      ]
    },
    {
      id: 'resolve',
      nums: h => { const n = h.ri(15, 45) * 10; return { n, s: Math.round(n * h.ri(58, 78) / 100) }; },
      passage: 'Last year, {n} {disputes} were referred to a free {scheme}. {s} of them were resolved through the scheme. People whose {dispute} was resolved said that, on average, they spent about a third of what they had expected to spend on {alternative}.',
      statements: [
        { a: 'T', text: 'More than half of the {disputes} referred to the {scheme} last year were resolved through it.',
          why: '{s} out of {n} is more than half. True.' },
        { a: 'PT', text: 'Using the {scheme} saved money for many of the people whose {dispute} was resolved.',
          why: 'On average they reported spending about a third of what they expected {alternative} to cost, so many probably saved money. Their estimates might have been wrong, so it is not certain. Probably true.' },
        { a: 'ID', text: '{idClaim}',
          why: 'Nothing in the passage tells you this. Insufficient data.' },
        { a: 'PF', text: 'Most people whose {dispute} was resolved spent more than {alternative} would have cost them.',
          why: 'On average they reported spending about a third of their expected costs, which points against this. Averages can hide a lot and estimates can be wrong, so it is not ruled out: Probably false.' },
        { a: 'F', text: 'None of the {disputes} referred to the {scheme} last year were resolved through it.',
          why: '{s} of them were. False.' },
        { a: 'F', text: 'People had to pay a fee to use the {scheme}.',
          why: 'The passage says it is free. False.' }
      ],
      fills: [
        { id: 'neigh', disputes: 'disputes between neighbours', dispute: 'dispute', scheme: 'community mediation service', alternative: 'going to court', idClaim: 'Most of the disputes were about noise.' },
        { id: 'builders', disputes: 'complaints about builders', dispute: 'complaint', scheme: 'trade association dispute scheme', alternative: 'legal action', idClaim: 'Most of the complaints were about unfinished work.' },
        { id: 'work', disputes: 'workplace disputes', dispute: 'dispute', scheme: 'early conciliation service', alternative: 'a tribunal claim', idClaim: 'Most of the disputes were about unpaid wages.' },
        { id: 'tenancy', disputes: 'disputes between landlords and tenants', dispute: 'dispute', scheme: 'housing mediation service', alternative: 'going to court', idClaim: 'Most of the disputes were about deposits.' },
        { id: 'energy', disputes: 'complaints against energy suppliers', dispute: 'complaint', scheme: 'ombudsman scheme', alternative: 'legal action', idClaim: 'Most of the complaints were about billing errors.' },
        { id: 'retail', disputes: 'disputes between online shoppers and sellers', dispute: 'dispute', scheme: 'online dispute resolution service', alternative: 'a small claims case', idClaim: 'Most of the disputes were about faulty electronics.' },
        { id: 'school', disputes: 'disputes between parents and schools', dispute: 'dispute', scheme: 'education mediation service', alternative: 'a legal challenge', idClaim: 'Most of the disputes were about school admissions.' }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
