/*
 * bank-logic.js: extra settings for Deduction and Interpretation.
 *
 * Deduction answers are always computed by the logic checker, so these packs
 * only supply wording. Terms within a pack are unrelated attributes, so no
 * real-world link between them can tempt you. If/then atoms are listed in
 * cause-then-effect order.
 */
(function (root) {
  'use strict';
  const B = root.WG_BANK = root.WG_BANK || {};

  const P = { label: 'Person', word: 'person', rel: 'who', pron: 'they', are: 'are' };
  const t = (pl, sg) => ({ pl, sg });
  B.CAT_PACKS = [
    { intro: 'The following statements are about the members of a gym in {city}.', ent: { label: 'Member', word: 'member', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('swimmers', 'a swimmer'), t('members who train before work', 'someone who trains before work'), t('yoga class regulars', 'a yoga class regular'), t('members with a personal trainer', 'someone with a personal trainer'), t('runners', 'a runner'), t('members who drive to the gym', 'someone who drives to the gym'), t('weightlifters', 'a weightlifter')] },
    { intro: 'The following statements are about the barristers at a set of chambers.', ent: { label: 'Barrister', word: 'barrister', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('criminal law specialists', 'a criminal law specialist'), t('barristers who sit as part-time judges', 'someone who sits as a part-time judge'), t('Welsh speakers', 'a Welsh speaker'), t('members of the chambers cricket team', 'a member of the chambers cricket team'), t('barristers who teach advocacy', 'someone who teaches advocacy'), t('barristers who travel to court by train', 'someone who travels to court by train'), t('authors of a legal textbook', 'the author of a legal textbook')] },
    { intro: 'The following statements are about the patients on a hospital ward.', ent: { label: 'Patient', word: 'patient', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('patients on a special diet', 'a patient on a special diet'), t('patients who had visitors today', 'someone who had visitors today'), t('patients due to go home this week', 'someone due to go home this week'), t('patients who read the newspaper', 'someone who reads the newspaper'), t('patients in a side room', 'a patient in a side room'), t('patients who walked to the day room', 'someone who walked to the day room')] },
    { intro: 'The following statements are about the books in a library\'s new delivery.', ent: { label: 'Book', word: 'book', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('hardbacks', 'a hardback'), t('books about history', 'a book about history'), t('books written by local authors', 'a book written by a local author'), t('books with illustrations', 'a book with illustrations'), t('books for the reference section', 'a book for the reference section'), t('books translated from French', 'a book translated from French'), t('books longer than 400 pages', 'a book longer than 400 pages')] },
    { intro: 'The following statements are about the cars in a company car park.', ent: { label: 'Car', word: 'car', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('electric cars', 'an electric car'), t('red cars', 'a red car'), t('cars parked under cover', 'a car parked under cover'), t('cars with roof racks', 'a car with a roof rack'), t('cars owned by managers', 'a car owned by a manager'), t('cars less than a year old', 'a car less than a year old'), t('cars with a parking permit', 'a car with a parking permit')] },
    { intro: 'The following statements are about the applicants for a training contract at {firm}.', ent: { label: 'Applicant', word: 'applicant', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('history graduates', 'a history graduate'), t('applicants who did a vacation scheme', 'someone who did a vacation scheme'), t('applicants who speak Mandarin', 'someone who speaks Mandarin'), t('applicants with a master\'s degree', 'someone with a master\'s degree'), t('applicants who were invited to interview', 'someone who was invited to interview'), t('applicants from the north of England', 'someone from the north of England'), t('applicants who have worked as paralegals', 'someone who has worked as a paralegal')] },
    { intro: 'The following statements are about the houses on a street in {city}.', ent: { label: 'House', word: 'house', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('detached houses', 'a detached house'), t('houses with solar panels', 'a house with solar panels'), t('houses with a garage', 'a house with a garage'), t('rented houses', 'a rented house'), t('houses with a red front door', 'a house with a red front door'), t('houses built before 1950', 'a house built before 1950'), t('houses with a cat', 'a house with a cat')] },
    { intro: 'The following statements are about the employees of a software company.', ent: P,
      terms: [t('developers', 'a developer'), t('people who work remotely', 'someone who works remotely'), t('first-aiders', 'a first-aider'), t('members of the book club', 'a member of the book club'), t('people who joined this year', 'someone who joined this year'), t('guitar players', 'a guitar player'), t('people who cycle to work', 'someone who cycles to work')] },
    { intro: 'The following statements are about the claims settled by an insurance company last month.', ent: { label: 'Claim', word: 'claim', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('car insurance claims', 'a car insurance claim'), t('claims paid in full', 'a claim paid in full'), t('claims made online', 'a claim made online'), t('claims involving a solicitor', 'a claim involving a solicitor'), t('claims over £5,000', 'a claim over £5,000'), t('claims settled within a week', 'a claim settled within a week')] },
    { intro: 'The following statements are about the dogs at an animal rescue centre.', ent: { label: 'Dog', word: 'dog', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('puppies', 'a puppy'), t('dogs that are house-trained', 'a dog that is house-trained'), t('dogs that like cats', 'a dog that likes cats'), t('dogs that have been microchipped', 'a dog that has been microchipped'), t('terriers', 'a terrier'), t('dogs that have been reserved', 'a dog that has been reserved')] },
    { intro: 'The following statements are about the members of a city orchestra.', ent: { label: 'Musician', word: 'musician', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('violinists', 'a violinist'), t('musicians who also teach', 'someone who also teaches'), t('members of the orchestra committee', 'a member of the orchestra committee'), t('musicians who live in the city centre', 'someone who lives in the city centre'), t('musicians who play in a jazz band', 'someone who plays in a jazz band'), t('musicians who joined this season', 'someone who joined this season')] },
    { intro: 'The following statements are about the councillors on a district council.', ent: { label: 'Councillor', word: 'councillor', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('members of the planning committee', 'a member of the planning committee'), t('councillors elected for the first time', 'someone elected for the first time'), t('business owners', 'a business owner'), t('councillors who live in the town centre', 'someone who lives in the town centre'), t('school governors', 'a school governor'), t('councillors who use social media', 'someone who uses social media')] },
    { intro: 'The following statements are about the parcels in a delivery van.', ent: { label: 'Parcel', word: 'parcel', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('fragile parcels', 'a fragile parcel'), t('parcels for business addresses', 'a parcel for a business address'), t('parcels that need a signature', 'a parcel that needs a signature'), t('parcels heavier than 5 kg', 'a parcel heavier than 5 kg'), t('parcels sent from abroad', 'a parcel sent from abroad'), t('parcels due before noon', 'a parcel due before noon')] },
    { intro: 'The following statements are about the clients of a family law team.', ent: { label: 'Client', word: 'client', rel: 'who', pron: 'they', are: 'are' },
      terms: [t('clients on legal aid', 'a client on legal aid'), t('clients with children', 'a client with children'), t('clients referred by a friend', 'someone referred by a friend'), t('clients who prefer video meetings', 'someone who prefers video meetings'), t('clients living outside the city', 'someone living outside the city'), t('clients who have used mediation', 'someone who has used mediation')] },
    { intro: 'The following statements are about the trains leaving a station this morning.', ent: { label: 'Train', word: 'train', rel: 'that', pron: 'it', are: 'is' },
      terms: [t('express trains', 'an express train'), t('trains with a buffet car', 'a train with a buffet car'), t('trains running late', 'a train running late'), t('trains leaving from platform 4', 'a train leaving from platform 4'), t('trains with eight carriages', 'a train with eight carriages'), t('trains going to London', 'a train going to London')] },
    { intro: 'The following statements are about the volunteers at a music festival.', ent: P,
      terms: [t('stewards', 'a steward'), t('volunteers who camp on site', 'someone who camps on site'), t('volunteers with a first-aid certificate', 'someone with a first-aid certificate'), t('volunteers who work night shifts', 'someone who works night shifts'), t('students', 'a student'), t('volunteers who have helped before', 'someone who has helped before')] }
  ];

  const a = (pos, neg) => ({ pos, neg });
  B.PROP_PACKS = [
    { intro: 'The following statements are about a company\'s annual accounts.', atoms: [a('the auditors find no errors', 'the auditors find errors'), a('the accounts are approved in June', 'the accounts are not approved in June'), a('the dividend is paid in July', 'the dividend is not paid in July'), a('the shareholders receive their payment before the summer', 'the shareholders do not receive their payment before the summer')] },
    { intro: 'The following statements are about a planning application.', atoms: [a('the developer submits a traffic survey', 'the developer does not submit a traffic survey'), a('the council considers the application in May', 'the council does not consider the application in May'), a('building work starts this year', 'building work does not start this year'), a('the new homes are ready by 2028', 'the new homes are not ready by 2028')] },
    { intro: 'The following statements are about an employment tribunal claim.', atoms: [a('the claim is filed within three months', 'the claim is not filed within three months'), a('the tribunal accepts the claim', 'the tribunal does not accept the claim'), a('a hearing is listed for the autumn', 'a hearing is not listed for the autumn'), a('the employer makes a settlement offer', 'the employer does not make a settlement offer')] },
    { intro: 'The following statements are about a school trip.', atoms: [a('enough parents sign the consent forms', 'not enough parents sign the consent forms'), a('the coach is booked', 'the coach is not booked'), a('the trip goes ahead on Friday', 'the trip does not go ahead on Friday'), a('the pupils visit the museum', 'the pupils do not visit the museum')] },
    { intro: 'The following statements are about a company merger.', atoms: [a('the competition regulator approves the deal', 'the competition regulator does not approve the deal'), a('the merger completes in March', 'the merger does not complete in March'), a('the two head offices are combined', 'the two head offices are not combined'), a('some staff relocate to Bristol', 'no staff relocate to Bristol')] },
    { intro: 'The following statements are about a library\'s opening hours.', atoms: [a('the council confirms the funding', 'the council does not confirm the funding'), a('extra staff are hired', 'extra staff are not hired'), a('the library opens on Sundays', 'the library does not open on Sundays'), a('the homework club moves to Sunday afternoons', 'the homework club does not move to Sunday afternoons')] },
    { intro: 'The following statements are about a criminal trial.', atoms: [a('the key witness gives evidence', 'the key witness does not give evidence'), a('the prosecution case is completed this week', 'the prosecution case is not completed this week'), a('the jury retires next Tuesday', 'the jury does not retire next Tuesday'), a('a verdict is given before the end of the month', 'a verdict is not given before the end of the month')] },
    { intro: 'The following statements are about a new product launch.', atoms: [a('the safety tests are passed', 'the safety tests are not passed'), a('production begins in January', 'production does not begin in January'), a('the product is in shops by spring', 'the product is not in shops by spring'), a('the advertising campaign runs in April', 'the advertising campaign does not run in April')] },
    { intro: 'The following statements are about a student\'s law degree.', atoms: [a('{name} submits the dissertation on time', '{name} does not submit the dissertation on time'), a('{name} graduates in July', '{name} does not graduate in July'), a('{name} starts the solicitors\' exam course in September', '{name} does not start the solicitors\' exam course in September'), a('{name} applies for a training contract this year', '{name} does not apply for a training contract this year')] },
    { intro: 'The following statements are about a football match.', atoms: [a('the pitch freezes overnight', 'the pitch does not freeze overnight'), a('the referee calls off the match', 'the referee does not call off the match'), a('the match is replayed next month', 'the match is not replayed next month'), a('the club refunds the tickets', 'the club does not refund the tickets')] },
    { intro: 'The following statements are about a house renovation.', atoms: [a('the survey finds damp', 'the survey does not find damp'), a('the builders replace the floor', 'the builders do not replace the floor'), a('the work runs over budget', 'the work does not run over budget'), a('the family moves in after Christmas', 'the family does not move in after Christmas')] },
    { intro: 'The following statements are about a conference.', atoms: [a('the keynote speaker confirms', 'the keynote speaker does not confirm'), a('ticket sales pass 500', 'ticket sales do not pass 500'), a('the larger venue is booked', 'the larger venue is not booked'), a('the conference makes a profit', 'the conference does not make a profit')] },
    { intro: 'The following statements are about a charity\'s grant application.', atoms: [a('the application is submitted by Friday', 'the application is not submitted by Friday'), a('the grant is awarded', 'the grant is not awarded'), a('the charity hires a project worker', 'the charity does not hire a project worker'), a('the youth project runs next year', 'the youth project does not run next year')] },
    { intro: 'The following statements are about a flight.', atoms: [a('the fog clears by 7am', 'the fog does not clear by 7am'), a('the flight leaves on time', 'the flight does not leave on time'), a('the passengers make their connection', 'the passengers do not make their connection'), a('the airline pays compensation', 'the airline does not pay compensation')] }
  ];

  B.TREND_CONTEXTS = [
    { setup: 'In {y1}, a city\'s hospitals recorded {N1} hospital admissions, {S1} of which were emergencies. In {y2}, they recorded {N2} admissions, {S2} of which were emergencies.',
      whole: 'admissions', sub: 'emergency admissions', other: 'non-emergency admissions', share: 'of the admissions were emergencies',
      propOf: 'admissions that were emergencies', predict: 'The proportion of admissions that are emergencies will {dirVerb} again in {y3}.',
      cause: 'an ageing population', wider: 'Across the country, the proportion of hospital admissions that were emergencies changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a law school had {N1} graduates, {S1} of whom found a training contract within a year. In {y2}, it had {N2} graduates, {S2} of whom found a training contract within a year.',
      whole: 'graduates', sub: 'graduates who found a training contract within a year', other: 'graduates who did not find a training contract within a year', share: 'of the graduates found a training contract within a year',
      propOf: 'graduates who found a training contract within a year', predict: 'The proportion of the law school\'s graduates who find a training contract within a year will {dirVerb} again in {y3}.',
      cause: 'changes to the law school\'s careers service', wider: 'Across all law schools, the proportion of graduates finding a training contract within a year changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a county court received {N1} claims, {S1} of which were about unpaid debts. In {y2}, it received {N2} claims, {S2} of which were about unpaid debts.',
      whole: 'claims', sub: 'debt claims', other: 'claims about other matters', share: 'of the court\'s claims were about unpaid debts',
      propOf: 'the court\'s claims that were about unpaid debts', predict: 'The proportion of the court\'s claims that are about unpaid debts will {dirVerb} again in {y3}.',
      cause: 'rising living costs', wider: 'Across all county courts, the proportion of claims about unpaid debts changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a train company ran {N1} services, {S1} of which arrived late. In {y2}, it ran {N2} services, {S2} of which arrived late.',
      whole: 'services', sub: 'late services', other: 'services that were not late', share: 'of the company\'s services arrived late',
      propOf: 'the company\'s services that arrived late', predict: 'The proportion of the company\'s services that arrive late will {dirVerb} again in {y3}.',
      cause: 'engineering works', wider: 'Across the whole rail network, the proportion of late trains changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a charity received {N1} donations, {S1} of which were made online. In {y2}, it received {N2} donations, {S2} of which were made online.',
      whole: 'donations', sub: 'online donations', other: 'donations not made online', share: 'of the charity\'s donations were made online',
      propOf: 'the charity\'s donations that were made online', predict: 'The proportion of the charity\'s donations that are made online will {dirVerb} again in {y3}.',
      cause: 'the charity\'s new website', wider: 'Across all UK charities, the proportion of donations made online changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a council approved {N1} planning applications, {S1} of which were for new homes. In {y2}, it approved {N2} applications, {S2} of which were for new homes.',
      whole: 'approved applications', sub: 'approved applications for new homes', other: 'approved applications for other developments', share: 'of the approved applications were for new homes',
      propOf: 'approved applications that were for new homes', predict: 'The proportion of approved applications that are for new homes will {dirVerb} again in {y3}.',
      cause: 'a new local housing plan', wider: 'Across England, the proportion of approved planning applications that were for new homes changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a university received {N1} applications, {S1} of which came from overseas. In {y2}, it received {N2} applications, {S2} of which came from overseas.',
      whole: 'applications', sub: 'overseas applications', other: 'applications from within the UK', share: 'of the university\'s applications came from overseas',
      propOf: 'the university\'s applications that came from overseas', predict: 'The proportion of the university\'s applications coming from overseas will {dirVerb} again in {y3}.',
      cause: 'changes to visa rules', wider: 'Across all UK universities, the proportion of applications from overseas changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a firm\'s employment team handled {N1} matters, {S1} of which were for employees rather than employers. In {y2}, it handled {N2} matters, {S2} of which were for employees.',
      whole: 'matters', sub: 'matters for employees', other: 'matters for employers', share: 'of the team\'s matters were for employees',
      propOf: 'the team\'s matters that were for employees', predict: 'The proportion of the team\'s matters that are for employees will {dirVerb} again in {y3}.',
      cause: 'a new advertising campaign aimed at employees', wider: 'Across all UK law firms, the proportion of employment matters handled for employees changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a police force recorded {N1} crimes, {S1} of which were reported online. In {y2}, it recorded {N2} crimes, {S2} of which were reported online.',
      whole: 'recorded crimes', sub: 'crimes reported online', other: 'crimes not reported online', share: 'of the force\'s recorded crimes were reported online',
      propOf: 'the force\'s recorded crimes that were reported online', predict: 'The proportion of crimes reported to the force online will {dirVerb} again in {y3}.',
      cause: 'the force\'s new reporting website', wider: 'Across all police forces, the proportion of crimes reported online changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a cinema sold {N1} tickets, {S1} of which were for children\'s films. In {y2}, it sold {N2} tickets, {S2} of which were for children\'s films.',
      whole: 'tickets', sub: 'tickets for children\'s films', other: 'tickets for other films', share: 'of the cinema\'s tickets were for children\'s films',
      propOf: 'the cinema\'s tickets that were for children\'s films', predict: 'The proportion of the cinema\'s tickets sold for children\'s films will {dirVerb} again in {y3}.',
      cause: 'cheaper weekend tickets', wider: 'Across all UK cinemas, the proportion of tickets sold for children\'s films changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a GP surgery booked {N1} appointments, {S1} of which were held by phone. In {y2}, it booked {N2} appointments, {S2} of which were held by phone.',
      whole: 'appointments', sub: 'phone appointments', other: 'appointments not held by phone', share: 'of the surgery\'s appointments were held by phone',
      propOf: 'the surgery\'s appointments that were held by phone', predict: 'The proportion of the surgery\'s appointments held by phone will {dirVerb} again in {y3}.',
      cause: 'a shortage of consulting rooms', wider: 'Across all GP surgeries, the proportion of appointments held by phone changed between {y1} and {y2}.' },
    { setup: 'In {y1}, an employment tribunal heard {N1} cases, {S1} of which were won by the employee. In {y2}, it heard {N2} cases, {S2} of which were won by the employee.',
      whole: 'cases', sub: 'cases won by the employee', other: 'cases not won by the employee', share: 'of the tribunal\'s cases were won by the employee',
      propOf: 'the tribunal\'s cases that were won by the employee', predict: 'The proportion of the tribunal\'s cases won by employees will {dirVerb} again in {y3}.',
      cause: 'changes in employment law', wider: 'Across all employment tribunals, the proportion of cases won by employees changed between {y1} and {y2}.' }
  ];

  B.SURVEY_CONTEXTS = [
    { pop: 'junior lawyers', setup: 'In a survey of {n} junior lawyers, {k} said they had considered leaving the profession in the past year.', said: 'said they had considered leaving the profession in the past year', notSaid: 'did not say they had considered leaving the profession', general: 'Most junior lawyers in the UK have considered leaving the profession in the past year.' },
    { pop: 'parents in {city}', setup: 'In a survey of {n} parents in {city}, {k} said they found childcare difficult to afford.', said: 'said they found childcare difficult to afford', notSaid: 'did not say they found childcare difficult to afford', general: 'Most parents in {city} find childcare difficult to afford.' },
    { pop: 'commuters', setup: 'In a survey of {n} rail commuters, {k} said their train was regularly overcrowded.', said: 'said their train was regularly overcrowded', notSaid: 'did not say their train was regularly overcrowded', general: 'Most trains used by commuters are regularly overcrowded.' },
    { pop: 'small charities', setup: 'In a survey of {n} small charities, {k} said they had lost volunteers in the past year.', said: 'said they had lost volunteers in the past year', notSaid: 'did not say they had lost volunteers in the past year', general: 'Most small charities in the country have lost volunteers in the past year.' },
    { pop: 'secondary school teachers', setup: 'In a survey of {n} secondary school teachers, {k} said they worked more than 50 hours a week.', said: 'said they worked more than 50 hours a week', notSaid: 'did not say they worked more than 50 hours a week', general: 'Most secondary school teachers work more than 50 hours a week.' },
    { pop: 'hospital patients', setup: 'In a survey of {n} hospital patients, {k} said they were happy with the food.', said: 'said they were happy with the food', notSaid: 'did not say they were happy with the food', general: 'Most hospital patients in the country are happy with hospital food.' },
    { pop: 'university students', setup: 'In a survey of {n} university students, {k} said they had a part-time job during term.', said: 'said they had a part-time job during term', notSaid: 'did not say they had a part-time job during term', general: 'Most university students in the UK have a part-time job during term.' },
    { pop: 'small business owners', setup: 'In a survey of {n} small business owners, {k} said they had been the victim of online fraud.', said: 'said they had been the victim of online fraud', notSaid: 'did not say they had been the victim of online fraud', general: 'Most small businesses in the country have been victims of online fraud.' },
    { pop: 'residents of {city}', setup: 'In a survey of {n} residents of {city}, {k} said they supported a new tram line.', said: 'said they supported a new tram line', notSaid: 'did not say they supported a new tram line', general: 'Most residents of {city} support a new tram line.' },
    { pop: 'trainee accountants', setup: 'In a survey of {n} trainee accountants, {k} said they would like to work from home more often.', said: 'said they would like to work from home more often', notSaid: 'did not say they would like to work from home more often', general: 'Most trainee accountants in the UK would like to work from home more often.' },
    { pop: 'dog owners', setup: 'In a survey of {n} dog owners, {k} said they walked their dog at least twice a day.', said: 'said they walked their dog at least twice a day', notSaid: 'did not say they walked their dog at least twice a day', general: 'Most dog owners walk their dog at least twice a day.' },
    { pop: 'magistrates', setup: 'In a survey of {n} magistrates, {k} said they would welcome more training on sentencing.', said: 'said they would welcome more training on sentencing', notSaid: 'did not say they would welcome more training on sentencing', general: 'Most magistrates in England and Wales would welcome more training on sentencing.' }
  ];

  // Percentage-change passages. money: figures in £ million; otherwise whole numbers (value x scale).
  B.CHANGE_CONTEXTS = [
    { setup: '{firm}\'s fee income from {area} work {dirVerb} from £{a} million in {y1} to £{b} million in {y2}.', subj: '{firm}\'s fee income from {area} work', money: true,
      areas: ['employment', 'real estate', 'private client', 'banking', 'litigation', 'intellectual property', 'tax'],
      gap: '{firm} earned more from {area} work in {y2} than from any other type of work.', gapWhy: 'The passage only gives figures for {area} work, so you cannot compare it with other types of work.',
      cause: { rise: 'the firm winning new clients', fall: 'the firm losing clients' } },
    { setup: 'The number of visitors to a city museum {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of visitors to the museum', scale: 1000,
      gap: 'The museum had more visitors in {y2} than any other museum in the city.', gapWhy: 'The passage gives figures for one museum only, so you cannot compare it with others.',
      cause: { rise: 'a new exhibition', fall: 'the museum introducing an entry fee' } },
    { setup: 'The number of members of a sports club {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of members of the club', scale: 10,
      gap: 'The club had more members in {y2} than any other sports club in the area.', gapWhy: 'The passage gives figures for one club only, so you cannot compare it with others.',
      cause: { rise: 'the club cutting its membership fee', fall: 'the club raising its membership fee' } },
    { setup: 'The number of applications for a firm\'s vacation scheme {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of applications for the vacation scheme', scale: 100,
      gap: 'The firm received more vacation scheme applications in {y2} than any other firm.', gapWhy: 'The passage gives figures for one firm only, so you cannot compare it with others.',
      cause: { rise: 'the firm raising its trainee salary', fall: 'the firm closing an office' } },
    { setup: 'A charity\'s income from legacies {dirVerb} from £{a} million in {y1} to £{b} million in {y2}.', subj: 'The charity\'s income from legacies', money: true,
      gap: 'Legacies were the charity\'s largest source of income in {y2}.', gapWhy: 'The passage gives no figures for the charity\'s other income, so you cannot say which source was largest.',
      cause: { rise: 'a successful advertising campaign', fall: 'fewer supporters writing wills' } },
    { setup: 'The number of cases started at a county court {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of cases started at the court', scale: 100,
      gap: 'The court started more cases in {y2} than any other court in the region.', gapWhy: 'The passage gives figures for one court only, so you cannot compare it with others.',
      cause: { rise: 'a new online claims system', fall: 'higher court fees' } },
    { setup: 'The number of passengers using a regional airport {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of passengers using the airport', scale: 10000,
      gap: 'The airport was the busiest in the region in {y2}.', gapWhy: 'The passage gives figures for one airport only, so you cannot compare it with others.',
      cause: { rise: 'new holiday routes', fall: 'an airline leaving the airport' } },
    { setup: 'A publisher\'s revenue from e-books {dirVerb} from £{a} million in {y1} to £{b} million in {y2}.', subj: 'The publisher\'s revenue from e-books', money: true,
      gap: 'E-books brought the publisher more revenue in {y2} than printed books did.', gapWhy: 'The passage gives no figures for printed books, so you cannot compare the two.',
      cause: { rise: 'cheaper e-readers', fall: 'readers returning to printed books' } },
    { setup: 'The number of pupils at a secondary school {dirVerb} from {a} in {y1} to {b} in {y2}.', subj: 'The number of pupils at the school', scale: 10,
      gap: 'The school had more pupils in {y2} than any other school in the town.', gapWhy: 'The passage gives figures for one school only, so you cannot compare it with others.',
      cause: { rise: 'new housing being built nearby', fall: 'falling birth rates' } },
    { setup: 'A council\'s spending on road repairs {dirVerb} from £{a} million in {y1} to £{b} million in {y2}.', subj: 'The council\'s spending on road repairs', money: true,
      gap: 'Road repairs were the council\'s biggest area of spending in {y2}.', gapWhy: 'The passage gives no figures for the council\'s other spending, so you cannot say which was biggest.',
      cause: { rise: 'a harsh winter', fall: 'cuts to the council\'s budget' } }
  ];

  // Studies showing a link (correlation) between two things.
  const c = (id, subj, sg, did, didnt, better, worse, cause, wider, rel) => ({ id, subj, sg, did, didnt, better, worse, cause, wider, rel: rel || 'who' });
  B.CORR = [
    c('breakfast', 'schoolchildren', 'child', 'ate breakfast every day', 'did not eat breakfast every day', 'achieved higher test scores', 'achieved lower test scores', 'Eating breakfast every day raises children\'s test scores.', 'schoolchildren across the country'),
    c('reading', 'adults', 'adult', 'read fiction regularly', 'did not read fiction regularly', 'scored higher on a test of empathy', 'scored lower on a test of empathy', 'Reading fiction makes adults more empathetic.', 'adults in every country'),
    c('mentor', 'trainee solicitors', 'trainee', 'had a mentor', 'did not have a mentor', 'reported higher job satisfaction', 'reported lower job satisfaction', 'Having a mentor increases trainee solicitors\' job satisfaction.', 'trainees in every profession'),
    c('dog', 'older people', 'person', 'owned a dog', 'did not own a dog', 'walked further each day', 'walked less far each day', 'Owning a dog makes older people walk further.', 'people of all ages'),
    c('sleep', 'university students', 'student', 'slept at least seven hours a night', 'slept less than seven hours a night', 'achieved higher marks', 'achieved lower marks', 'Sleeping at least seven hours a night improves students\' marks.', 'students at every university'),
    c('garden', 'city residents', 'resident', 'had a garden', 'did not have a garden', 'reported better mental health', 'reported worse mental health', 'Having a garden improves mental health.', 'people living in the countryside'),
    c('cycle', 'office workers', 'worker', 'cycled to work', 'did not cycle to work', 'took fewer sick days', 'took more sick days', 'Cycling to work makes office workers take fewer sick days.', 'workers in every type of job'),
    c('music', 'primary pupils', 'pupil', 'learned a musical instrument', 'did not learn an instrument', 'scored higher in maths', 'scored lower in maths', 'Learning a musical instrument improves pupils\' maths.', 'secondary school pupils'),
    c('training', 'call-centre staff', 'member of staff', 'completed customer service training', 'did not complete the training', 'received fewer complaints', 'received more complaints', 'The customer service training reduces complaints.', 'staff in every industry'),
    c('volunteer', 'retired people', 'person', 'volunteered weekly', 'did not volunteer weekly', 'reported less loneliness', 'reported more loneliness', 'Volunteering weekly reduces loneliness in retirement.', 'people of working age'),
    c('meals', 'families', 'family', 'ate dinner together most evenings', 'did not eat dinner together most evenings', 'reported closer relationships', 'reported less close relationships', 'Eating dinner together brings families closer.', 'families in every country'),
    c('pro bono', 'law firms', 'firm', 'ran a pro bono programme', 'did not run a pro bono programme', 'kept more of their trainees after qualification', 'kept fewer of their trainees after qualification', 'Running a pro bono programme helps firms keep their trainees.', 'firms in every profession', 'that'),
    c('screens', 'teenagers', 'teenager', 'spent less than two hours a day on screens', 'spent two hours or more a day on screens', 'reported better sleep', 'reported worse sleep', 'Limiting screen time improves teenagers\' sleep.', 'adults'),
    c('bonus', 'sales staff', 'member of staff', 'were on a bonus scheme', 'were not on a bonus scheme', 'made more sales', 'made fewer sales', 'Bonus schemes make sales staff sell more.', 'staff in every kind of job'),
    c('plants', 'offices', 'office', 'had indoor plants', 'did not have indoor plants', 'reported higher staff productivity', 'reported lower staff productivity', 'Indoor plants make office staff more productive.', 'factories', 'that')
  ];

  // Trials at one site where a measure stayed the same.
  B.TRIAL = [
    { org: 'a bank', orgPoss: 'the bank\'s', change: 'closed its counter on Wednesday afternoons', where: 'at its {city} branch', siteThe: 'the {city} branch', sites: 'branches', outcome: 'the number of customer complaints', changeNoun: 'Closing the counter on Wednesday afternoons', noticed: 'Customers did not notice that the counter was closed on Wednesday afternoons.', pref: 'Staff at the {city} branch preferred the new hours.' },
    { org: 'a supermarket chain', orgPoss: 'the chain\'s', change: 'switched off its display lighting after 10pm', where: 'at its {city} store', siteThe: 'the {city} store', sites: 'stores', outcome: 'the number of night-time sales', changeNoun: 'Switching off the display lighting after 10pm', noticed: 'Shoppers did not notice that the display lighting was off.', pref: 'Night staff at the store liked the darker shop floor.' },
    { org: 'a GP practice group', orgPoss: 'the group\'s', change: 'offered only video appointments on Mondays', where: 'at its {city} surgery', siteThe: 'the {city} surgery', sites: 'surgeries', outcome: 'the number of missed appointments', changeNoun: 'Offering only video appointments on Mondays', noticed: 'Patients did not notice the change to Monday appointments.', pref: 'Doctors at the surgery preferred video appointments.' },
    { org: '{firm}', orgPoss: '{firm}\'s', change: 'stopped printing documents for client meetings', where: 'in its {city} office', siteThe: 'the {city} office', sites: 'offices', outcome: 'the number of client complaints', changeNoun: 'Not printing documents for client meetings', noticed: 'Clients did not notice that documents were no longer printed.', pref: 'Lawyers in the {city} office preferred working without printed documents.' },
    { org: 'a council', orgPoss: 'the council\'s', change: 'collected bins every two weeks instead of every week', where: 'in one of its districts', siteThe: 'that district', sites: 'districts', outcome: 'the number of reports of overflowing bins', changeNoun: 'Collecting bins every two weeks', noticed: 'Residents did not notice the change in collection days.', pref: 'Bin crews preferred the fortnightly rounds.' },
    { org: 'a university', orgPoss: 'the university\'s', change: 'replaced written exams with online tests', where: 'in its law school', siteThe: 'the law school', sites: 'departments', outcome: 'the average exam mark', changeNoun: 'Replacing written exams with online tests', noticed: 'Students did not notice any difference between the formats.', pref: 'Lecturers preferred marking online tests.' },
    { org: 'a train company', orgPoss: 'the company\'s', change: 'removed the first-class carriage from its trains', where: 'on its {city} line', siteThe: 'the {city} line', sites: 'lines', outcome: 'the number of tickets sold', changeNoun: 'Removing the first-class carriage', noticed: 'Passengers did not notice that the first-class carriage had gone.', pref: 'Train guards preferred working without a first-class carriage.' },
    { org: 'a gym chain', orgPoss: 'the chain\'s', change: 'closed between midnight and 6am', where: 'at its {city} gym', siteThe: 'the {city} gym', sites: 'gyms', outcome: 'the number of members', changeNoun: 'Closing overnight', noticed: 'Members did not notice that the gym closed overnight.', pref: 'Staff at the {city} gym preferred the new hours.' }
  ];

  // Surveys where some people did not respond.
  B.RESPONSE = [
    { members: 'partners', memberSg: 'partner', orgThe: '{firm}', org: '{firm}', orgPoss: '{firm}\'s', proposal: 'the new pay structure' },
    { members: 'teachers', memberSg: 'teacher', orgThe: 'the school', org: 'a secondary school', orgPoss: 'the school\'s', proposal: 'the new timetable' },
    { members: 'tenants', memberSg: 'tenant', orgThe: 'the block', org: 'a block of flats', orgPoss: 'the block\'s', proposal: 'the plan to install a lift' },
    { members: 'members', memberSg: 'member', orgThe: 'the club', org: 'a tennis club', orgPoss: 'the club\'s', proposal: 'the plan to build a new clubhouse' },
    { members: 'nurses', memberSg: 'nurse', orgThe: 'the ward', org: 'a hospital ward', orgPoss: 'the ward\'s', proposal: 'the new shift pattern' },
    { members: 'barristers', memberSg: 'barrister', orgThe: 'the chambers', org: 'a set of chambers', orgPoss: 'the chambers\'', proposal: 'the move to new premises' },
    { members: 'volunteers', memberSg: 'volunteer', orgThe: 'the charity', org: 'a charity', orgPoss: 'the charity\'s', proposal: 'the new volunteer rota' },
    { members: 'shareholders', memberSg: 'shareholder', orgThe: 'the company', org: 'a family company', orgPoss: 'the company\'s', proposal: 'the plan to sell the business' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
