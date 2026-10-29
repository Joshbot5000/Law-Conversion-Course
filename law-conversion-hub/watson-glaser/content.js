/*
 * content.js: the hand-checked material the question engine builds from.
 *
 * Every scenario, firm and person here is fictional. Answers never depend on
 * real-world facts: each statement's answer is fixed by the structure of the
 * passage it belongs to, and the slots ({firm}, {n}, ...) only vary surface
 * details inside ranges that cannot change the answer.
 */
(function (root) {
  'use strict';

  const FIRMS = [
    'Harlow & Pike LLP', 'Thornbury Wells LLP', 'Ellison Vane LLP', 'Marlowe Kent LLP',
    'Ashcombe Reid LLP', 'Penrose Hartley LLP', 'Calder & Finch LLP', 'Whitlock Ames LLP',
    'Brannock Lyle LLP', 'Fenwick Orme LLP'
  ];
  const CITIES = [
    'Leeds', 'Bristol', 'Manchester', 'Birmingham', 'Glasgow', 'Cardiff',
    'Sheffield', 'Nottingham', 'Edinburgh', 'Newcastle', 'Liverpool', 'Southampton'
  ];
  const NAMES = ['Priya', 'Sam', 'Jordan', 'Alex', 'Morgan', 'Kiran', 'Robin', 'Taylor', 'Jamie', 'Ellis'];

  /* ------------------------------------------------------------------ */
  /* INFERENCE: passages with statements graded on the five-point scale  */
  /* ------------------------------------------------------------------ */
  // vars(h) returns the slot values; h gives ri(min,max), pick(arr), firm(), city().
  const INFERENCE = [
    {
      id: 'workshop',
      vars: h => ({ firm: h.firm(), n: h.ri(28, 60) }),
      passage: '{n} trainee solicitors at {firm} chose to attend an optional Saturday workshop on negotiation skills. At the end of the day, the trainees voted "handling difficult clients" as the topic they most wanted covered at the next workshop.',
      statements: [
        { a: 'T', text: 'At least some trainees at {firm} were willing to give up part of a weekend for training.',
          why: 'The passage says {n} trainees chose to attend an optional workshop on a Saturday. Choosing to attend something optional on a Saturday is giving up part of a weekend for training. This has to be true if the facts are true.' },
        { a: 'PT', text: 'As a group, the trainees who attended were more interested in developing their negotiation skills than the average trainee at {firm}.',
          why: 'People who give up a Saturday for an optional workshop are, on the whole, likely to be keener on the subject than people who did not go. That makes this more likely true than false. But it is not certain: some may have gone to network, or because a supervisor suggested it. Likely but not certain = Probably true.' },
        { a: 'ID', text: 'The workshop was run by one of the firm\'s partners.',
          why: 'The passage says nothing about who ran the workshop. Nothing tips the balance either way, so there is insufficient data.' },
        { a: 'ID', text: 'Most of the trainees who attended had worked as paralegals before their training contract.',
          why: 'Nothing in the passage tells you anything about the trainees\' previous jobs. With no facts pointing either way, it is insufficient data.' },
        { a: 'PF', text: 'Most of the trainees who attended felt they had little left to learn about dealing with clients.',
          why: 'The trainees voted to have "handling difficult clients" covered next. That suggests they wanted to learn more about client work, which points against this statement. It is not impossible (a vote shows a preference, not exactly what each person felt), so it is Probably false rather than False.' },
        { a: 'F', text: 'Attendance at the workshop was compulsory for all trainees at {firm}.',
          why: 'The passage says the workshop was optional and that the trainees chose to attend. "Compulsory" directly contradicts "optional", so this is False.' },
        { a: 'F', text: 'The trainees voted for a topic about tax law to be covered at the next workshop.',
          why: 'The passage tells you exactly what they voted for: "handling difficult clients". A tax law topic contradicts that, so this is False.' }
      ]
    },
    {
      id: 'client-survey',
      vars: h => ({ firm: h.firm(), n: h.ri(3, 6) * 100, p: h.ri(78, 92), c: h.ri(18, 30) }),
      passage: 'Last year, {firm} surveyed {n} clients of its family law team. {p}% said they would recommend the team to a friend. The most common complaint, made by {c}% of the clients surveyed, was that it was hard to reach their solicitor by phone.',
      statements: [
        { a: 'T', text: 'Some of the clients surveyed were unhappy about how easy it was to reach their solicitor by phone.',
          why: '{c}% of the clients surveyed complained that it was hard to reach their solicitor by phone. Making that complaint shows they were unhappy about it, so this must be true.' },
        { a: 'T', text: 'Fewer than half of the clients surveyed complained that it was hard to reach their solicitor by phone.',
          why: 'The passage gives the figure as {c}%. {c}% is less than 50%, so this follows directly from the facts. It is True.' },
        { a: 'ID', text: 'The survey was carried out by an independent research company.',
          why: 'The passage only says that the firm surveyed its clients. It says nothing about who actually ran the survey, so there is insufficient data.' },
        { a: 'ID', text: 'The family law team is the largest team at {firm}.',
          why: 'Nothing in the passage compares the family law team with any other team. Insufficient data.' },
        { a: 'PF', text: 'Most of the clients surveyed found it difficult to reach their solicitor by phone.',
          why: 'Phone contact was the most common complaint, but only {c}% made it. If most clients (more than 50%) had found it difficult, you would expect far more than {c}% to have complained. It is not impossible, since people can find something difficult without complaining, so this is Probably false rather than False.' },
        { a: 'F', text: 'Fewer than half of the clients surveyed said they would recommend the team to a friend.',
          why: 'The passage says {p}% said they would recommend the team. {p}% is more than half, so this contradicts the facts. False.' }
      ]
    },
    {
      id: 'office-move',
      vars: h => {
        const a = h.ri(30, 45), b = a - h.ri(10, 18), c = h.ri(40, 70), d = c + h.ri(15, 30);
        return { firm: h.firm(), city: h.city(), a, b, c, d };
      },
      passage: '{firm} moved its {city} office to a new building next to the city\'s main railway station. In the twelve months after the move, the number of staff who said they cycled to work fell from {a} to {b}, while the number who said they travelled by train rose from {c} to {d}. The total number of staff in the office stayed the same.',
      statements: [
        { a: 'T', text: 'More staff in the {city} office said they travelled to work by train after the move than before it.',
          why: 'The passage says the number rose from {c} to {d}. That is exactly what this statement says, so it is True.' },
        { a: 'PT', text: 'The new building\'s location made it easier for some staff to travel to work by train.',
          why: 'The new building is next to the main station and train use went up soon after the move. That makes it likely that the location helped. But the passage does not say why train use rose (fares could have dropped, for example), so it is not certain. Probably true.' },
        { a: 'ID', text: 'The new building costs more to rent than the old one.',
          why: 'The passage says nothing about rent or cost. Insufficient data.' },
        { a: 'ID', text: 'Most of the staff in the {city} office live outside the city.',
          why: 'Nothing in the passage tells you where staff live. Insufficient data.' },
        { a: 'PF', text: 'On the whole, staff in the {city} office found the new building harder to reach by train than the old one.',
          why: 'Train use rose after the move to a building next to the station. That points strongly against the new building being harder to reach by train. It is not strictly impossible, so it is Probably false.' },
        { a: 'F', text: 'The number of staff who said they cycled to work went up after the move.',
          why: 'The passage says it fell, from {a} to {b}. This contradicts the facts, so it is False.' },
        { a: 'F', text: 'The total number of staff in the {city} office increased in the twelve months after the move.',
          why: 'The passage says the total number of staff stayed the same. False.' }
      ]
    },
    {
      id: 'advice-clinic',
      vars: h => ({ city: h.city(), n: h.ri(30, 70) * 10, k: h.ri(6, 15) }),
      passage: 'Every Wednesday evening, a free legal advice clinic run by volunteer law students opens at {city} Community Centre. Last year the clinic saw {n} visitors. Housing problems made up more than half of all enquiries, and on {k} evenings the clinic had to turn people away because there were not enough volunteers to see everyone.',
      statements: [
        { a: 'T', text: 'On at least one evening last year, the clinic could not see everyone who wanted advice.',
          why: 'The passage says that on {k} evenings the clinic turned people away. So on at least one evening it could not see everyone. True.' },
        { a: 'T', text: 'Housing problems made up a larger share of the clinic\'s enquiries than any other single type of problem.',
          why: 'Housing made up more than half of all enquiries. If one type is more than half, every other type put together is less than half, so no other single type can be bigger. This follows with certainty: True.' },
        { a: 'PT', text: 'If more volunteers had been available last year, the clinic would have been able to see more people.',
          why: 'The passage gives the shortage of volunteers as the reason people were turned away. More volunteers would therefore probably have meant more people seen. It is not certain, because something else (such as room space) might have limited it. Probably true.' },
        { a: 'ID', text: 'Most of the clinic\'s visitors last year were over the age of 40.',
          why: 'The passage says nothing about visitors\' ages. Insufficient data.' },
        { a: 'F', text: 'The clinic charges visitors a fee for its advice.',
          why: 'The passage describes it as a free clinic. A fee contradicts this. False.' },
        { a: 'F', text: 'Last year the clinic always had enough volunteers to see everyone who came.',
          why: 'On {k} evenings it had to turn people away because there were not enough volunteers. This contradicts the statement. False.' }
      ]
    },
    {
      id: 'training-contracts',
      vars: h => ({ firm: h.firm(), n: h.ri(18, 40) * 100, t: h.ri(12, 30), y: h.ri(2021, 2025) }),
      passage: 'In {y}, {firm} received {n} applications for {t} training contracts, and filled all of them. Every successful applicant had completed a vacation scheme at the firm. The firm says that, when assessing candidates, it values commercial awareness above every other skill.',
      statements: [
        { a: 'T', text: 'Some people who applied to {firm} in {y} did not get a training contract there.',
          why: 'There were {n} applications for only {t} places. Even if one person sent more than one application, far more people applied than there were places, so some applicants must have missed out. True.' },
        { a: 'T', text: 'Everyone who got a training contract at {firm} in {y} had spent time at the firm before receiving the offer.',
          why: 'Every successful applicant had completed a vacation scheme at the firm, and a vacation scheme is time spent at the firm. So this must be true.' },
        { a: 'PT', text: 'Completing a vacation scheme at {firm} improved an applicant\'s chances of getting a training contract there.',
          why: 'Every single successful applicant had done a vacation scheme, out of {n} applications. That strongly suggests the scheme helped. It is not certain (in theory, every applicant might have done one), so it is Probably true.' },
        { a: 'ID', text: 'Most applicants to {firm} in {y} had studied law at university.',
          why: 'The passage says nothing about what applicants studied. Insufficient data.' },
        { a: 'PF', text: 'Commercial awareness played little or no part in how {firm} assessed candidates.',
          why: 'The firm says it values commercial awareness above every other skill. That is evidence against this statement. But the passage only tells you what the firm says, not what it actually did, so it is not ruled out completely. Probably false. Watch the difference between what a passage says someone claims and what it says is fact.' },
        { a: 'F', text: 'At least one person got a training contract at {firm} in {y} without completing a vacation scheme there.',
          why: 'The passage says every successful applicant had completed a vacation scheme at the firm. This statement contradicts that. False.' }
      ]
    },
    {
      id: 'friday-pilot',
      vars: h => { const n = h.ri(20, 30); return { firm: h.firm(), n, p: n - h.ri(1, 4), x: h.ri(10, 30) }; },
      passage: 'For six months, {firm} allowed the {n} members of its employment team to work from home on Fridays. During the pilot, the team\'s billable hours were unchanged and staff sickness absence fell by {x}%. At the end, {p} of the {n} team members asked for the arrangement to continue.',
      statements: [
        { a: 'T', text: 'At least one member of the team wanted the Friday arrangement to continue.',
          why: '{p} team members asked for it to continue. Asking for it to continue shows they wanted it. True.' },
        { a: 'T', text: 'The team\'s billable hours did not fall during the pilot.',
          why: 'The passage says billable hours were unchanged. Unchanged means they did not fall. True.' },
        { a: 'PT', text: 'Most members of the team found working from home on Fridays at least as convenient as working in the office.',
          why: 'Nearly everyone ({p} of {n}) asked for it to continue, which suggests they found it convenient. It is not certain, since someone might want it to continue for another reason, so it is Probably true.' },
        { a: 'ID', text: 'Other teams at {firm} have asked to join the scheme.',
          why: 'The passage only talks about the employment team. Nothing tells you what other teams did. Insufficient data.' },
        { a: 'PF', text: 'Most members of the team found the Friday arrangement unhelpful.',
          why: '{p} of the {n} members asked for it to continue, which is very unlikely if most found it unhelpful. Not strictly impossible, so Probably false.' },
        { a: 'F', text: 'The pilot ran for a full year.',
          why: 'The passage says the pilot ran for six months. False.' },
        { a: 'F', text: 'Staff sickness absence in the team rose during the pilot.',
          why: 'The passage says it fell by {x}%. False.' }
      ]
    },
    {
      id: 'garden-waste',
      vars: h => ({ x: h.pick(['30', '35', '40', '45', '50']), p: h.ri(20, 40) }),
      passage: 'A town council began charging residents £{x} a year to collect their garden waste. In the year after the charge was introduced, the weight of garden waste collected by the council fell by {p}%, and sales of home compost bins at the town\'s two garden centres doubled.',
      statements: [
        { a: 'T', text: 'The council collected a smaller weight of garden waste in the year after the charge was introduced.',
          why: 'The passage says the weight collected fell by {p}%. True.' },
        { a: 'PT', text: 'Some residents began composting garden waste at home instead of paying to have it collected.',
          why: 'Collections fell and compost bin sales doubled at the same time as the new charge. That makes it likely that some people switched to composting. It is not certain, so Probably true.' },
        { a: 'ID', text: 'The council used the money raised by the charge to repair roads.',
          why: 'The passage says nothing about what the money was used for. Insufficient data.' },
        { a: 'PF', text: 'The charge had no effect on how residents dealt with their garden waste.',
          why: 'Collections fell and compost bin sales doubled right after the charge started, which strongly suggests the charge did have an effect. You cannot be completely sure (something else could explain both changes), so Probably false.' },
        { a: 'F', text: 'Sales of home compost bins at the town\'s garden centres fell after the charge was introduced.',
          why: 'The passage says they doubled. False.' },
        { a: 'F', text: 'Residents could still have their garden waste collected free of charge in the year after the charge was introduced.',
          why: 'The passage says the council began charging £{x} a year for collection. Free collection contradicts that. False.' }
      ]
    },
    {
      id: 'court-waits',
      vars: h => { const a = h.ri(30, 45), y1 = h.ri(2019, 2023), j1 = h.ri(40, 60); return { a, b: a + h.ri(12, 25), j1, j2: j1 - h.ri(6, 14), y1, y2: y1 + 2 }; },
      passage: 'Figures from a regional court service show that the average wait for a civil trial in the region rose from {a} weeks in {y1} to {b} weeks in {y2}. Over the same period, the number of judges sitting in the region fell from {j1} to {j2}, while the number of claims issued stayed roughly the same.',
      statements: [
        { a: 'T', text: 'On average, people waited longer for a civil trial in the region in {y2} than in {y1}.',
          why: 'The average wait rose from {a} to {b} weeks. True.' },
        { a: 'PT', text: 'The fall in the number of judges helped to cause the longer waits.',
          why: 'Fewer judges usually means fewer trials can be heard. Waits rose while the number of claims stayed about the same, so the fall in judges is a likely explanation. The passage does not prove it, so Probably true.' },
        { a: 'ID', text: 'Most civil claims in the region are about unpaid debts.',
          why: 'Nothing in the passage tells you what the claims are about. Insufficient data.' },
        { a: 'PF', text: 'Appointing more judges in the region would make waiting times even longer.',
          why: 'Common knowledge (which you are allowed to use) tells you that more judges can hear more cases, and the passage links fewer judges with longer waits. So this is unlikely, but not impossible to rule out entirely. Probably false.' },
        { a: 'F', text: 'Far more civil claims were issued in the region in {y2} than in {y1}.',
          why: 'The passage says the number of claims stayed roughly the same. "Far more" contradicts that. False.' },
        { a: 'F', text: 'The number of judges sitting in the region rose between {y1} and {y2}.',
          why: 'It fell, from {j1} to {j2}. False.' }
      ]
    },
    {
      id: 'self-checkout',
      vars: h => { const n = h.ri(40, 90); const a = h.ri(7, 12); return { n, k: h.ri(5, 12), a, b: a - h.ri(3, 5) }; },
      passage: 'A supermarket chain with {n} stores trialled self-service checkouts in {k} of them. In the trial stores, the average queuing time at peak hours fell from {a} minutes to {b} minutes. Customer complaints about queues in those stores fell, but complaints about checkout machines not working rose sharply.',
      statements: [
        { a: 'T', text: 'In the trial stores, peak-time queues were shorter on average after the self-service checkouts were introduced.',
          why: 'The average peak queuing time fell from {a} to {b} minutes. True.' },
        { a: 'T', text: 'Not all of the chain\'s stores took part in the trial.',
          why: 'Only {k} of the {n} stores were in the trial. True.' },
        { a: 'PT', text: 'The self-service checkouts helped to reduce peak-time queuing in the trial stores.',
          why: 'Queuing times fell in the stores that got the new checkouts, which suggests the checkouts helped. Other things could have changed too, so it is not certain. Probably true.' },
        { a: 'ID', text: 'The stores chosen for the trial were the chain\'s busiest stores.',
          why: 'The passage does not say how the trial stores were chosen. Insufficient data.' },
        { a: 'PF', text: 'Customers in the trial stores were more satisfied with how reliable the checkouts were during the trial than before it.',
          why: 'Complaints about machines not working rose sharply, which points against greater satisfaction with reliability. It is not completely ruled out, so Probably false.' },
        { a: 'F', text: 'The average peak-time queuing time in the trial stores rose during the trial.',
          why: 'It fell, from {a} to {b} minutes. False.' }
      ]
    },
    {
      id: 'careers-evening',
      vars: h => { const n = h.ri(80, 160); const k = h.ri(25, 45); return { firm: h.firm(), city: h.city(), n, k, m: h.ri(5, 12) }; },
      passage: '{n} students attended a careers evening run by {firm} at the University of {city}. Afterwards, {k} of those students applied for the firm\'s spring insight scheme. In the previous year, when no careers evening was held, the firm received {m} applications from students at the university.',
      statements: [
        { a: 'T', text: 'Not every student who attended the careers evening applied for the spring insight scheme.',
          why: '{n} students attended but only {k} of them applied. True.' },
        { a: 'T', text: 'The firm received more applications from students at the university this year than in the previous year.',
          why: 'At least {k} students from the university applied this year (the ones from the careers evening), compared with {m} last year. {k} is more than {m}, so this must be true.' },
        { a: 'PT', text: 'The careers evening encouraged some students to apply who would not otherwise have done so.',
          why: 'Applications rose sharply in the year the event was held. That suggests the event encouraged some students, but other reasons are possible. Probably true.' },
        { a: 'ID', text: 'The careers evening was held in the university\'s law faculty.',
          why: 'The passage does not say where at the university it was held. Insufficient data.' },
        { a: 'PF', text: 'Students at the University of {city} were less interested in {firm} this year than in the previous year.',
          why: 'Many more students applied this year, which points against interest having fallen. Not impossible, so Probably false.' },
        { a: 'F', text: 'Fewer students from the university applied for the spring insight scheme this year than in the previous year.',
          why: 'At least {k} applied this year against {m} last year, so this contradicts the facts. False.' }
      ]
    },
    {
      id: 'swimming',
      vars: h => ({ city: h.city(), n: h.ri(12, 30) * 10, w: h.ri(40, 160) }),
      passage: 'A charity offered {n} free places on swimming lessons for children aged 7 to 11 in {city} last summer. All of the places were taken within two days of bookings opening, and a waiting list of {w} children was set up.',
      statements: [
        { a: 'T', text: 'More children were put forward for the lessons than there were places available.',
          why: 'All {n} places were taken and another {w} children went on the waiting list. True.' },
        { a: 'PT', text: 'If the charity offers the same lessons next summer, there will again be more children wanting places than there are places.',
          why: 'Places went within two days and there was a long waiting list. It is reasonable to expect similar demand next year, but the future is not certain. Probably true.' },
        { a: 'ID', text: 'Most of the children who took part had never swum before.',
          why: 'Nothing in the passage tells you about the children\'s swimming ability. Insufficient data.' },
        { a: 'F', text: 'Some places on the lessons were still available a week after bookings opened.',
          why: 'All places were taken within two days. False.' },
        { a: 'F', text: 'Children aged 5 could book a place on the lessons.',
          why: 'The lessons were for children aged 7 to 11. False.' }
      ]
    },
    {
      id: 'pro-bono',
      vars: h => { const h0 = h.ri(40, 70) * 100; return { firm: h.firm(), city: h.city(), h0, h1: h0 + h.ri(5, 20) * 100 }; },
      passage: 'Last year, lawyers at {firm} recorded a total of {h1} hours of pro bono work, up from {h0} hours the year before. The firm\'s {city} office, which employs about a quarter of the firm\'s lawyers, accounted for more than half of last year\'s total.',
      statements: [
        { a: 'T', text: 'Lawyers at {firm} recorded more pro bono hours last year than the year before.',
          why: '{h1} hours is more than {h0} hours. True.' },
        { a: 'T', text: 'On average, lawyers in the {city} office recorded more pro bono hours last year than lawyers in the firm\'s other offices.',
          why: 'About a quarter of the lawyers produced more than half of the hours. The other three-quarters of the lawyers produced less than half. Sharing more hours between fewer people gives a higher average per person, so this must be true. Doing the maths is enough here; no guesswork is needed.' },
        { a: 'PT', text: 'Pro bono work is more strongly encouraged in the {city} office than in the firm\'s other offices.',
          why: 'Lawyers there do far more pro bono work on average, which suggests it is encouraged more. But there could be other reasons (for example, the types of clients that office has), so Probably true.' },
        { a: 'ID', text: 'Most of the firm\'s pro bono work last year was for charities.',
          why: 'The passage does not say who the work was for. Insufficient data.' },
        { a: 'PF', text: 'Pro bono work was discouraged by the managers of the {city} office last year.',
          why: 'The {city} office did more than half of all pro bono hours with only a quarter of the lawyers. That points against pro bono being discouraged there, but it is not impossible. Probably false.' },
        { a: 'F', text: 'The firm\'s total pro bono hours fell last year.',
          why: 'They rose, from {h0} to {h1}. False.' }
      ]
    },
    {
      id: 'speed-limit',
      vars: h => ({ city: h.city(), p: h.ri(18, 35) }),
      passage: '{city} City Council introduced a 20 mph speed limit on all residential streets. In the two years after the change, the number of road collisions causing injury on those streets was {p}% lower than in the two years before it. On the city\'s main roads, where the limit did not change, the number stayed roughly the same.',
      statements: [
        { a: 'T', text: 'There were fewer injury collisions on {city}\'s residential streets in the two years after the change than in the two years before it.',
          why: 'The passage says the number was {p}% lower. True.' },
        { a: 'PT', text: 'The lower speed limit helped to reduce injury collisions on residential streets.',
          why: 'Collisions fell only where the limit was lowered, and not on main roads where it stayed the same. That points to the speed limit as a likely cause. It is still not proven, so Probably true.' },
        { a: 'ID', text: 'Most drivers in {city} supported the lower speed limit.',
          why: 'The passage says nothing about what drivers thought. Insufficient data.' },
        { a: 'PF', text: 'The fall in injury collisions on residential streets was caused mainly by a general improvement in driving standards across the city.',
          why: 'If driving had improved across the whole city, you would expect collisions to fall on main roads too, but they stayed about the same. That makes this unlikely, but not impossible. Probably false.' },
        { a: 'F', text: 'The number of injury collisions fell by a similar amount on all of the city\'s roads.',
          why: 'On main roads the number stayed roughly the same, so it did not fall on all roads. False.' },
        { a: 'F', text: 'The speed limit on {city}\'s main roads was also cut to 20 mph.',
          why: 'The passage says the limit on main roads did not change. False.' }
      ]
    },
    {
      id: 'mediation',
      vars: h => { const n = h.ri(15, 40) * 10; return { n, s: Math.round(n * (h.ri(58, 75) / 100)) }; },
      passage: 'Last year, {n} disputes between small businesses were referred to a free mediation service. {s} of them were settled at mediation. Parties who settled said that, on average, they spent about a third of what they had expected to spend on going to court.',
      statements: [
        { a: 'T', text: 'More than half of the disputes referred to the service last year were settled at mediation.',
          why: '{s} out of {n} is more than half. True.' },
        { a: 'PT', text: 'Using the mediation service saved money for many of the parties who settled.',
          why: 'Parties reported spending on average about a third of what they expected court to cost. That makes it likely many saved money. But their court estimates might have been wrong, so it is not certain. Probably true.' },
        { a: 'ID', text: 'Most of the disputes referred to the service were about unpaid invoices.',
          why: 'Nothing tells you what the disputes were about. Insufficient data.' },
        { a: 'PF', text: 'Most of the parties who settled at mediation spent more than they would have spent going to court.',
          why: 'On average they reported spending about a third of their expected court costs. That points against this. Not impossible (averages can hide a lot, and estimates can be wrong), so Probably false.' },
        { a: 'F', text: 'None of the disputes referred to the service last year were settled at mediation.',
          why: '{s} were settled. False.' },
        { a: 'F', text: 'The parties had to pay a fee to use the mediation service.',
          why: 'The passage calls it a free mediation service. False.' }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* ASSUMPTIONS                                                         */
  /* ------------------------------------------------------------------ */
  // Recommendation topics: "<who> should <action> in order to <goal>".
  // The answers come from the recommendation's structure, so any topic works.
  const REC_TOPICS = [
    { who: '{firm}', action: 'introduce a mentoring scheme for first-year trainees', actionIng: 'introducing a mentoring scheme for first-year trainees', goal: 'improve trainee retention', goalIng: 'improving trainee retention', over: 'no trainee would ever leave the firm', alt: 'raising trainee salaries' },
    { who: 'the council', action: 'install brighter street lighting in the town centre', actionIng: 'installing brighter street lighting in the town centre', goal: 'reduce crime at night', goalIng: 'reducing crime at night', over: 'there would be no crime at all in the town centre at night', alt: 'paying for more police patrols' },
    { who: 'the school', action: 'ban mobile phones during lessons', actionIng: 'banning mobile phones during lessons', goal: 'improve pupils\' concentration', goalIng: 'improving pupils\' concentration', over: 'every pupil would concentrate fully in every lesson', alt: 'shortening lessons' },
    { who: 'the government', action: 'raise the tax on sugary drinks', actionIng: 'raising the tax on sugary drinks', goal: 'reduce childhood obesity', goalIng: 'reducing childhood obesity', over: 'childhood obesity would disappear completely', alt: 'funding more school sport' },
    { who: '{firm}', action: 'offer its lawyers a four-day working week', actionIng: 'offering its lawyers a four-day working week', goal: 'attract more experienced lawyers', goalIng: 'attracting more experienced lawyers', over: 'every experienced lawyer in the city would apply to join the firm', alt: 'paying higher bonuses' },
    { who: 'the hospital', action: 'extend its visiting hours', actionIng: 'extending the hospital\'s visiting hours', goal: 'improve patients\' wellbeing', goalIng: 'improving patients\' wellbeing', over: 'every patient would recover more quickly', alt: 'improving the hospital\'s food' },
    { who: 'the court service', action: 'move more short hearings online', actionIng: 'moving more short hearings online', goal: 'reduce waiting times for hearings', goalIng: 'reducing waiting times for hearings', over: 'nobody would ever have to wait for a hearing', alt: 'appointing more judges' },
    { who: 'the city council', action: 'introduce a congestion charge', actionIng: 'introducing a congestion charge', goal: 'reduce traffic in the city centre', goalIng: 'reducing traffic in the city centre', over: 'there would never be a traffic jam in the city centre again', alt: 'improving bus services' },
    { who: 'the supermarket', action: 'stop selling plastic carrier bags', actionIng: 'stopping the sale of plastic carrier bags', goal: 'reduce its plastic waste', goalIng: 'reducing the supermarket\'s plastic waste', over: 'the supermarket would produce no plastic waste at all', alt: 'selling more loose fruit and vegetables' },
    { who: '{firm}', action: 'translate its website into Mandarin', actionIng: 'translating the firm\'s website into Mandarin', goal: 'win more clients based in China', goalIng: 'winning more clients based in China', over: 'every Chinese company with business in the UK would instruct the firm', alt: 'opening an office in Shanghai' },
    { who: 'the charity', action: 'write to everyone who has donated in the past', actionIng: 'writing to everyone who has donated in the past', goal: 'raise more money this year', goalIng: 'raising more money this year', over: 'the charity would never need to fundraise again', alt: 'holding a fundraising dinner' },
    { who: 'the law school', action: 'record all of its lectures', actionIng: 'recording all of the law school\'s lectures', goal: 'support students who miss classes', goalIng: 'supporting students who miss classes', over: 'no student would ever fall behind', alt: 'running extra catch-up seminars' },
    { who: 'the council', action: 'build a cycle lane along the high street', actionIng: 'building a cycle lane along the high street', goal: 'encourage more people to cycle to work', goalIng: 'encouraging more people to cycle to work', over: 'everyone in the town would cycle to work', alt: 'offering discounts on bicycles' },
    { who: 'the museum', action: 'scrap its entry fee', actionIng: 'scrapping the museum\'s entry fee', goal: 'attract more visitors', goalIng: 'attracting more visitors', over: 'the museum would be full every day', alt: 'putting on more exhibitions' },
    { who: 'the train company', action: 'add extra carriages to rush-hour trains', actionIng: 'adding extra carriages to rush-hour trains', goal: 'reduce overcrowding', goalIng: 'reducing overcrowding', over: 'every passenger would get a seat on every journey', alt: 'running more frequent trains' },
    { who: '{firm}', action: 'hire a specialist data protection lawyer', actionIng: 'hiring a specialist data protection lawyer', goal: 'win more technology clients', goalIng: 'winning more technology clients', over: 'every technology company in the country would instruct the firm', alt: 'advertising in technology magazines' },
    { who: 'the government', action: 'lower the voting age to 16', actionIng: 'lowering the voting age to 16', goal: 'increase young people\'s involvement in politics', goalIng: 'increasing young people\'s involvement in politics', over: 'every 16-year-old would vote in every election', alt: 'teaching politics in schools' },
    { who: 'the restaurant', action: 'offer a cheaper lunch menu', actionIng: 'offering a cheaper lunch menu', goal: 'attract more customers at lunchtime', goalIng: 'attracting more customers at lunchtime', over: 'the restaurant would be full every lunchtime', alt: 'advertising on social media' },
    { who: 'the police force', action: 'put more officers on foot patrol', actionIng: 'putting more officers on foot patrol', goal: 'increase public confidence in the police', goalIng: 'increasing public confidence in the police', over: 'every member of the public would trust the police completely', alt: 'publishing crime figures more often' },
    { who: 'the company', action: 'give its staff free gym membership', actionIng: 'giving staff free gym membership', goal: 'reduce sickness absence', goalIng: 'reducing sickness absence', over: 'no member of staff would ever be off sick', alt: 'offering more paid holiday' },
    { who: '{firm}', action: 'run free legal workshops for local start-up businesses', actionIng: 'running free legal workshops for local start-up businesses', goal: 'build relationships with potential future clients', goalIng: 'building relationships with potential future clients', over: 'every start-up that attended would become a client', alt: 'sponsoring local business awards' },
    { who: 'the university', action: 'open its library 24 hours a day during exams', actionIng: 'opening the library 24 hours a day during exams', goal: 'help students to revise', goalIng: 'helping students to revise', over: 'every student would pass their exams', alt: 'providing more study rooms' },
    { who: 'the tribunal service', action: 'publish all of its decisions online', actionIng: 'publishing all tribunal decisions online', goal: 'make the tribunal system more transparent', goalIng: 'making the tribunal system more transparent', over: 'nobody would ever question a tribunal decision again', alt: 'allowing journalists into every hearing' },
    { who: '{firm}', action: 'give every trainee a laptop', actionIng: 'giving every trainee a laptop', goal: 'allow trainees to work more flexibly', goalIng: 'allowing trainees to work more flexibly', over: 'trainees would never need to come into the office', alt: 'letting trainees use their own computers' }
  ];

  // Stand-alone assumption items in other shapes (cause, evidence, instruction).
  const ASSUMPTION_ITEMS = [
    {
      id: 'seminar-room',
      passage: '"We should hold the client seminar in the main conference room, because more than 80 people have registered to attend."',
      statements: [
        { a: 'made', text: 'The main conference room can hold more than 80 people.',
          why: 'The speaker picks this room because of the number of people coming. Flip it: "the room cannot hold more than 80 people". Then choosing it for 80+ people makes no sense, so the speaker must be taking it for granted.' },
        { a: 'made', text: 'The number of people expected is relevant to choosing a room for the seminar.',
          why: 'The only reason given for the choice is the number of registrations. If numbers were irrelevant to the choice of room, that reason would be pointless. So it is assumed.' },
        { a: 'not', text: 'Every person who registered will actually attend the seminar.',
          why: 'The speaker only needs to expect a large turnout. Even if a few people drop out, the large room could still be the right choice. Flip it ("not everyone will turn up") and the recommendation still stands. Not assumed.' },
        { a: 'not', text: 'The seminar will be a success.',
          why: 'Choosing a room says nothing about whether the event will go well. Not assumed.' }
      ]
    },
    {
      id: 'first-class',
      passage: '"{name} is bound to be a strong researcher. After all, {name} was awarded a first-class law degree."',
      statements: [
        { a: 'made', text: 'Getting a first-class law degree is a sign that someone is a strong researcher.',
          why: 'The degree is the only evidence the speaker gives. That evidence only works if a first-class degree says something about research ability. Flip it ("a first doesn\'t indicate research skill") and the argument collapses. Assumed.' },
        { a: 'not', text: 'Anyone without a first-class degree is a weak researcher.',
          why: 'The speaker says a first is a good sign. That does not mean everyone without one is weak. Lots of good researchers could have other degrees. Not assumed.' },
        { a: 'not', text: '{name} studied at one of the country\'s leading universities.',
          why: 'Nothing in the reasoning depends on which university it was. Not assumed.' }
      ]
    },
    {
      id: 'early-train',
      passage: '"Book the 7am train to Manchester. The meeting starts at 10am and the journey takes two hours."',
      statements: [
        { a: 'made', text: 'It is important to arrive before the meeting starts.',
          why: 'The whole point of choosing the 7am train is to get there before 10am. If arriving on time did not matter, the timings would be irrelevant. Assumed.' },
        { a: 'made', text: 'There is a train to Manchester at 7am that can be booked.',
          why: 'You cannot tell someone to book a train you think does not exist. Assumed.' },
        { a: 'not', text: 'The train will arrive without any delay at all.',
          why: 'A 7am departure plus a two-hour journey arrives at 9am, an hour before the meeting. The speaker has left a buffer, so they do not need to assume zero delay. Not assumed.' },
        { a: 'not', text: 'Driving to Manchester would take longer than going by train.',
          why: 'The speaker does not compare the train with driving. They might simply prefer the train. Not assumed.' }
      ]
    },
    {
      id: 'free-fruit',
      passage: '"Ever since we started providing free fruit in the office, sickness absence has fallen. The fruit is clearly making our staff healthier."',
      statements: [
        { a: 'made', text: 'The fall in sickness absence is not explained entirely by something other than the fruit.',
          why: 'The speaker concludes the fruit is the cause. That only works if something else (a mild winter, say) is not the whole explanation. Flip it and the conclusion collapses. Assumed.' },
        { a: 'made', text: 'Staff have been eating the free fruit.',
          why: 'Fruit can only make staff healthier if they actually eat it. Assumed.' },
        { a: 'not', text: 'Free fruit is the only way to reduce sickness absence.',
          why: 'Saying the fruit helped does not mean nothing else could. Not assumed.' },
        { a: 'not', text: 'Sickness absence will keep falling in future.',
          why: 'The speaker talks only about what has already happened. Not assumed.' }
      ]
    },
    {
      id: 'client-silence',
      passage: '"The client has not replied to our email for two weeks, so they must have decided to instruct another firm."',
      statements: [
        { a: 'made', text: 'The client received the email.',
          why: 'Silence only tells you something if the client actually got the email. If it never arrived, the silence would prove nothing. Assumed.' },
        { a: 'made', text: 'A client who still meant to instruct the firm would normally have replied within two weeks.',
          why: 'The speaker treats two weeks of silence as meaningful. That only works if a client who was still interested would usually have replied by now. Assumed.' },
        { a: 'not', text: 'The client is unhappy with the firm\'s fees.',
          why: 'The speaker gives no reason why the client might have gone elsewhere. Fees are never mentioned. Not assumed.' },
        { a: 'not', text: 'The other firm offered the client a lower price.',
          why: 'Nothing in the reasoning depends on why the client might have chosen another firm. Not assumed.' }
      ]
    },
    {
      id: 'canteen-prices',
      passage: '"Prices in the staff canteen went up last month, and fewer people are eating there. We should cut prices back to where they were."',
      statements: [
        { a: 'made', text: 'The price rise is at least partly responsible for fewer people eating in the canteen.',
          why: 'The speaker proposes cutting prices to fix the drop. That only makes sense if prices are at least part of the reason for the drop. Assumed.' },
        { a: 'made', text: 'It would be a good thing if more people ate in the canteen.',
          why: 'You would only recommend a fix if you thought the drop was a problem. Assumed.' },
        { a: 'not', text: 'The price rise is the only reason fewer people are eating there.',
          why: 'The speaker only needs prices to be part of the reason. Flip it ("there are other reasons too") and cutting prices could still help. Not assumed.' },
        { a: 'not', text: 'The canteen\'s food has got worse.',
          why: 'Food quality is never mentioned, and the reasoning does not need it. Not assumed.' }
      ]
    },
    {
      id: 'application-form',
      passage: '"Applications to our vacation scheme fell by 30% this year, so our new online application form must be putting candidates off."',
      statements: [
        { a: 'made', text: 'The new online application form was used in this year\'s application round.',
          why: 'The form can only have put off this year\'s candidates if they actually met it. Assumed.' },
        { a: 'made', text: 'The fall in applications was not caused entirely by other factors.',
          why: 'Blaming the form only works if something else does not fully explain the drop. Assumed.' },
        { a: 'not', text: 'Candidates prefer paper application forms.',
          why: 'The speaker criticises the new form, not online forms in general. Not assumed.' },
        { a: 'not', text: 'Applications will fall again next year.',
          why: 'The speaker says nothing about next year. Not assumed.' }
      ]
    },
    {
      id: 'sign-form',
      passage: '"Only a qualified solicitor can sign this form, so you will need to ask {name} to sign it."',
      statements: [
        { a: 'made', text: '{name} is a qualified solicitor.',
          why: 'If only qualified solicitors can sign, sending the form to {name} only makes sense if {name} is one. Assumed.' },
        { a: 'made', text: 'The person being spoken to cannot sign the form themselves.',
          why: '"You will need to ask {name}" only makes sense if the listener cannot sign it, for example because they are not a qualified solicitor. Assumed.' },
        { a: 'not', text: '{name} has signed this type of form before.',
          why: 'All that matters is that {name} is allowed to sign. Experience with the form is not needed. Not assumed.' }
      ]
    },
    {
      id: 'competitor-fees',
      passage: '"All of our competitors have cut their fees, so we will have to cut ours too if we want to keep our clients."',
      statements: [
        { a: 'made', text: 'If the firm\'s fees stay the same, some clients are likely to move to cheaper competitors.',
          why: 'Cutting fees to keep clients only makes sense if the speaker thinks clients would otherwise leave for cheaper firms. Assumed.' },
        { a: 'not', text: 'Price is the only thing clients consider when choosing a firm.',
          why: 'The speaker needs price to matter, not to be the only thing that matters. Not assumed.' },
        { a: 'not', text: 'The competitors\' work is of lower quality.',
          why: 'The quality of the competitors\' work is never mentioned. Not assumed.' }
      ]
    },
    {
      id: 'agenda-copies',
      passage: '"Please print 50 copies of the agenda for tomorrow\'s team meeting."',
      statements: [
        { a: 'made', text: 'Printed copies of the agenda will be useful at tomorrow\'s meeting.',
          why: 'Nobody asks for printed copies they think are pointless. Assumed.' },
        { a: 'made', text: 'It is possible to print the copies before the meeting.',
          why: 'Asking for something to be done takes for granted that it can be done. Assumed.' },
        { a: 'not', text: 'Exactly 50 people will attend the meeting.',
          why: 'People often print a few spares, or fewer copies than attendees. The request does not need an exact match. Not assumed.' },
        { a: 'not', text: 'The meeting will last more than an hour.',
          why: 'The length of the meeting is irrelevant to the request. Not assumed.' }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* ARGUMENTS                                                           */
  /* ------------------------------------------------------------------ */
  // strongYes / strongNo: important and directly related (treated as true).
  // trivialYes / trivialNo: related but of minor importance.
  // irrelevant: not about the question at all.
  const ARG_TOPICS = [
    { q: 'Should law firms be required to publish the salaries they pay to trainee solicitors?',
      strongYes: ['it would let candidates compare offers accurately before deciding which firm to join.', 'it would make it easier to spot and address unfair pay gaps between firms.'],
      strongNo: ['it would force firms to reveal commercially sensitive information that competitors could use against them.', 'smaller firms that could not match the published salaries of larger firms might struggle to recruit any trainees at all.'],
      trivialYes: ['the published lists would make interesting reading for law students.'],
      trivialNo: ['the salary lists would take up space on firms\' websites.'],
      irrelevant: ['trainee solicitors usually work in several different departments during their training.', 'many law firms were founded more than a century ago.'] },
    { q: 'Should voting in UK general elections be made compulsory?',
      strongYes: ['it would mean that election results reflected the views of the whole electorate, not just of those who choose to vote.', 'it would push political parties to address the concerns of groups who currently vote in low numbers.'],
      strongNo: ['forcing people to vote would take away their freedom to choose not to take part in politics.', 'people with no interest in the election might vote at random, making results a less accurate reflection of considered opinion.'],
      trivialYes: ['polling stations would feel busier and livelier on election day.'],
      trivialNo: ['some voters might have to queue for a few minutes longer.'],
      irrelevant: ['some countries elect their head of state directly.', 'polling stations are often set up in schools and village halls.'] },
    { q: 'Should employers be allowed to read their employees\' work emails?',
      strongYes: ['it would allow employers to detect and stop serious misconduct, such as leaking clients\' confidential information.'],
      strongNo: ['it would seriously undermine employees\' privacy and the trust between employers and staff.'],
      trivialYes: ['managers would find out which employees use the most emojis.'],
      trivialNo: ['employees might feel slightly awkward putting jokes in their emails.'],
      irrelevant: ['many people check their personal email on their phones.', 'email addresses usually contain the @ symbol.'] },
    { q: 'Should university tuition be free for all students?',
      strongYes: ['it would allow talented students from low-income families to go to university without taking on large debts.'],
      strongNo: ['it would have to be paid for through taxes, including by people who never went to university and may earn less than graduates.'],
      trivialYes: ['universities would no longer need to print fee information in their brochures.'],
      trivialNo: ['the student loans office would have to change its opening hours.'],
      irrelevant: ['many universities have campuses outside the city centre.', 'some university courses include a year studying abroad.'] },
    { q: 'Should mobile phones be banned in secondary schools?',
      strongYes: ['it would reduce distractions in lessons and help pupils to concentrate on their learning.', 'it would reduce opportunities for online bullying during the school day.'],
      strongNo: ['pupils would lose the chance to learn how to use technology responsibly under teachers\' supervision.'],
      trivialYes: ['pupils would spend less time charging their phones at lunchtime.'],
      trivialNo: ['pupils would not be able to take photos of the school\'s sports day.'],
      irrelevant: ['the first mobile phones were large and heavy.', 'many secondary schools have a uniform.'] },
    { q: 'Should the minimum age for driving a car be raised to 18?',
      strongYes: ['it would reduce the number of serious road collisions involving young, inexperienced drivers.'],
      strongNo: ['it would make it much harder for 17-year-olds in rural areas to get to work, college or training.'],
      trivialYes: ['car parks at sixth-form colleges would be slightly less crowded.'],
      trivialNo: ['17-year-olds would have to wait another year to choose the colour of their first car.'],
      irrelevant: ['cars in the UK drive on the left-hand side of the road.', 'many cars now have touchscreen displays.'] },
    { q: 'Should law firms let trainees choose all of their training seats?',
      strongYes: ['trainees would gain experience in the areas they intend to qualify into, leaving them better prepared for practice.'],
      strongNo: ['the firm might be unable to staff busy departments that few trainees choose, harming the service it gives clients.'],
      trivialYes: ['trainees would enjoy telling their friends which seats they had picked.'],
      trivialNo: ['the spreadsheet used to allocate seats would need an extra column.'],
      irrelevant: ['some law firms have offices in more than twenty countries.', 'trainee solicitors often attend networking events.'] },
    { q: 'Should supermarkets be banned from throwing away food that is still safe to eat?',
      strongYes: ['it would mean that large amounts of edible food went to people in need instead of being wasted.'],
      strongNo: ['the cost of storing and redistributing the food could lead supermarkets to raise prices for all customers.'],
      trivialYes: ['the bins behind supermarkets would need emptying less often.'],
      trivialNo: ['staff would need to learn a new set of procedures for a few weeks.'],
      irrelevant: ['most supermarkets sell household goods as well as food.', 'some supermarkets are open 24 hours a day.'] },
    { q: 'Should all court hearings be broadcast live on television?',
      strongYes: ['it would improve public understanding of how the justice system works and make the courts more accountable.'],
      strongNo: ['witnesses and victims might be put off giving evidence if they knew they would be shown on television.'],
      trivialYes: ['viewers would have something new to watch during the day.'],
      trivialNo: ['television channels would have to move some of their daytime programmes.'],
      irrelevant: ['some court buildings date from the nineteenth century.', 'judges in some courts wear wigs.'] },
    { q: 'Should the government pay part of the cost of installing solar panels on homes?',
      strongYes: ['it would lower households\' energy bills and cut carbon emissions from electricity generation.'],
      strongNo: ['the scheme would cost taxpayers a large sum that could otherwise be spent on other public services.'],
      trivialYes: ['the rooftops of many houses would look more modern.'],
      trivialNo: ['installers might leave ladders on pavements for a few hours.'],
      irrelevant: ['the sun rises in the east.', 'many homes in the UK have a garden.'] },
    { q: 'Should all employees have a legal right to work from home for part of the week?',
      strongYes: ['it would help employees to combine work with caring responsibilities, allowing more people to stay in work.'],
      strongNo: ['in many jobs, such as nursing or factory work, the work cannot be done from home, so the right would be unworkable or unfair.'],
      trivialYes: ['employees could wear more comfortable clothes on some days.'],
      trivialNo: ['the plants in some offices might be watered less often.'],
      irrelevant: ['many offices are in city centres.', 'some offices have open-plan layouts.'] },
    { q: 'Should solicitors be required to do a minimum number of hours of pro bono work each year?',
      strongYes: ['it would improve access to legal advice for people who cannot afford to pay for it.'],
      strongNo: ['the quality of advice could suffer if solicitors were made to work outside their areas of expertise.'],
      trivialYes: ['solicitors would have more varied stories to tell their friends.'],
      trivialNo: ['firms would have to add an extra code to their timesheets.'],
      irrelevant: ['many solicitors\' firms have offices on high streets.', 'solicitors often work with barristers.'] },
    { q: 'Should the school day be made one hour longer?',
      strongYes: ['it would give pupils more teaching time to catch up on learning they have missed.'],
      strongNo: ['pupils would become more tired, which could reduce how much they learn in the final hour and the next day.'],
      trivialYes: ['the school car park would stay open an hour later.'],
      trivialNo: ['the school\'s bell system would need to be reprogrammed.'],
      irrelevant: ['many schools have a school uniform.', 'some schools have their own swimming pool.'] },
    { q: 'Should cars be banned from city centres?',
      strongYes: ['it would greatly reduce air pollution in the places where most people walk, shop and work.'],
      strongNo: ['disabled people who rely on cars could be prevented from reaching shops and services in the centre.'],
      trivialYes: ['pigeons would have more space on the roads.'],
      trivialNo: ['a few car park signs would have to be taken down.'],
      irrelevant: ['many cities were built next to rivers.', 'some city centres have a cathedral.'] },
    { q: 'Should law firms stop requiring minimum A-level grades from trainee applicants?',
      strongYes: ['it would let talented candidates who underperformed at school because of difficult circumstances compete fairly.'],
      strongNo: ['firms would lose a simple, consistent way of screening the very large number of applications they receive.'],
      trivialYes: ['the online application form would be one question shorter.'],
      trivialNo: ['some candidates would no longer need to look up their old exam certificates.'],
      irrelevant: ['A-level exams are usually taken in the summer.', 'some law firms have their own gyms.'] },
    { q: 'Should lawyers be allowed to use AI tools when drafting court documents?',
      strongYes: ['it could reduce the cost of legal services, making justice more affordable for clients.'],
      strongNo: ['AI tools can produce convincing but inaccurate content, which could mislead the court if it is not properly checked.'],
      trivialYes: ['lawyers could produce documents in a wider range of fonts.'],
      trivialNo: ['lawyers would have to learn some new keyboard shortcuts.'],
      irrelevant: ['court documents are often stored in folders.', 'many lawyers work in open-plan offices.'] },
    { q: 'Should plastic packaging be taxed?',
      strongYes: ['it would encourage manufacturers to use less plastic, reducing the amount that ends up as waste in the environment.'],
      strongNo: ['manufacturers could pass the cost on, increasing the price of everyday goods for low-income households.'],
      trivialYes: ['shop shelves would look a little less shiny.'],
      trivialNo: ['the labels on some packaging would need a small redesign.'],
      irrelevant: ['plastic comes in many different colours.', 'some shops are open on Sundays.'] },
    { q: 'Should all public sector employees move to a four-day working week?',
      strongYes: ['it could improve staff wellbeing and reduce burnout, helping public services to keep experienced staff.'],
      strongNo: ['services such as hospitals and emergency response need staff available every day, so cover could suffer.'],
      trivialYes: ['employees would have more chances for a lie-in.'],
      trivialNo: ['shared office calendars would need updating.'],
      irrelevant: ['the public sector includes both national and local government.', 'many public buildings have lifts.'] },
    { q: 'Should trainee solicitors at the same firm be paid the same salary whichever city they work in?',
      strongYes: ['it would ensure that trainees doing the same work are treated equally.'],
      strongNo: ['the cost of living varies greatly between cities, so the same salary would leave some trainees much worse off than others.'],
      trivialYes: ['all the trainees\' payslips would look the same.'],
      trivialNo: ['the HR team\'s salary table would have fewer rows.'],
      irrelevant: ['many trainees share flats with friends.', 'some cities have trams.'] },
    { q: 'Should entry to museums be free?',
      strongYes: ['it would let people on low incomes access culture and education that they might otherwise miss out on.'],
      strongNo: ['without entry fees, museums might not have enough money to look after their collections properly.'],
      trivialYes: ['visitors would not need to queue at the ticket desk.'],
      trivialNo: ['the museum\'s ticket printer would no longer be used.'],
      irrelevant: ['some museums are housed in former railway stations.', 'many museums have a gift shop.'] },
    { q: 'Should social media companies be legally responsible for harmful content posted on their platforms?',
      strongYes: ['it would give the companies a strong incentive to remove harmful content quickly, protecting users from serious harm.'],
      strongNo: ['the companies might remove large amounts of lawful content to avoid being sued, restricting free expression.'],
      trivialYes: ['the companies\' lawyers would have new topics to discuss at lunch.'],
      trivialNo: ['the platforms\' terms and conditions would become a few pages longer.'],
      irrelevant: ['many social media companies were founded by university students.', 'social media apps can be used on phones and computers.'] },
    { q: 'Should jury service be optional?',
      strongYes: ['people forced to serve against their will might not pay proper attention, which could affect the fairness of trials.'],
      strongNo: ['if it were optional, juries might no longer represent a cross-section of society, undermining the fairness of trials.'],
      trivialYes: ['people would no longer have to read the jury summons letter.'],
      trivialNo: ['court canteens might sell fewer sandwiches.'],
      irrelevant: ['court buildings often have security checks at the entrance.', 'some trials take place in very old courtrooms.'] },
    { q: 'Should the compulsory retirement age for judges be raised?',
      strongYes: ['it would let the courts keep experienced judges for longer, helping to ease the shortage of judges.'],
      strongNo: ['it would slow the progress of younger and more diverse lawyers into senior judicial roles.'],
      trivialYes: ['judges could keep their favourite courtroom for longer.'],
      trivialNo: ['retirement parties for judges would take place later.'],
      irrelevant: ['judges in some courts wear wigs.', 'many courts have public galleries.'] },
    { q: 'Should solicitor apprenticeships be promoted as an alternative to university?',
      strongYes: ['they let people qualify without taking on student debt, widening access to the profession.'],
      strongNo: ['apprentices may have less time for academic study of the law, which could limit the depth of their legal knowledge.'],
      trivialYes: ['apprentices would get a work email address sooner.'],
      trivialNo: ['careers fairs would need a few more stands.'],
      irrelevant: ['solicitors\' offices are usually open on weekdays.', 'many universities have a students\' union.'] }
  ];

  // Topic-independent weak arguments.
  const GENERIC_WEAK = [
    { side: 'No', kind: 'person', text: 'some of the people calling for this change have been criticised in the past for unrelated reasons.' },
    { side: 'Yes', kind: 'person', text: 'the people who oppose this idea have often been wrong about other issues.' },
    { side: 'No', kind: 'tradition', text: 'things have always been done differently, so there is no need to change now.' },
    { side: 'Yes', kind: 'circular', text: 'it is simply the right thing to do.' },
    { side: 'No', kind: 'circular', text: 'it is clearly a bad idea.' }
  ];

  /* ------------------------------------------------------------------ */
  /* DEDUCTION: term packs (categorical) and atom packs (if/then)        */
  /* ------------------------------------------------------------------ */
  // Each pack's terms are unrelated attributes, so no real-world link between
  // them can tempt you; only the stated premises matter.
  const CAT_PACKS = [
    { intro: 'The following statements are about the staff at {firm}.', ent: { label: 'Person', word: 'person', rel: 'who', pron: 'they', are: 'are' },
      terms: [
        { pl: 'trainees', sg: 'a trainee' },
        { pl: 'members of the running club', sg: 'a member of the running club' },
        { pl: 'Spanish speakers', sg: 'a Spanish speaker' },
        { pl: 'people who cycle to work', sg: 'someone who cycles to work' },
        { pl: 'volunteers at the advice clinic', sg: 'a volunteer at the advice clinic' },
        { pl: 'chess players', sg: 'a chess player' },
        { pl: 'members of the pro bono committee', sg: 'a member of the pro bono committee' },
        { pl: 'people based in the {city} office', sg: 'someone based in the {city} office' }
      ] },
    { intro: 'The following statements are about the students on a law course at the University of {city}.', ent: { label: 'Student', word: 'student', rel: 'who', pron: 'they', are: 'are' },
      terms: [
        { pl: 'members of the debating society', sg: 'a member of the debating society' },
        { pl: 'students who live on campus', sg: 'someone who lives on campus' },
        { pl: 'rowers', sg: 'a rower' },
        { pl: 'German speakers', sg: 'a German speaker' },
        { pl: 'volunteers at the food bank', sg: 'a volunteer at the food bank' },
        { pl: 'students with a part-time job', sg: 'someone with a part-time job' },
        { pl: 'mooting competition entrants', sg: 'a mooting competition entrant' },
        { pl: 'students who play the piano', sg: 'someone who plays the piano' }
      ] },
    { intro: 'The following statements are about the cases listed at a county court this month.', ent: { label: 'Case', word: 'case', rel: 'that', pron: 'it', are: 'is' },
      terms: [
        { pl: 'contract disputes', sg: 'a contract dispute' },
        { pl: 'cases heard on a Monday', sg: 'a case heard on a Monday' },
        { pl: 'cases involving a company', sg: 'a case involving a company' },
        { pl: 'cases that settled before trial', sg: 'a case that settled before trial' },
        { pl: 'cases with an expert witness', sg: 'a case with an expert witness' },
        { pl: 'appeals', sg: 'an appeal' },
        { pl: 'cases listed for more than one day', sg: 'a case listed for more than one day' }
      ] },
    { intro: 'The following statements are about the residents of the village of {village}.', ent: { label: 'Resident', word: 'resident', rel: 'who', pron: 'they', are: 'are' },
      terms: [
        { pl: 'gardeners', sg: 'a gardener' },
        { pl: 'members of the choir', sg: 'a member of the choir' },
        { pl: 'dog owners', sg: 'a dog owner' },
        { pl: 'parish councillors', sg: 'a parish councillor' },
        { pl: 'people who read the local newspaper', sg: 'someone who reads the local newspaper' },
        { pl: 'people who own a bicycle', sg: 'someone who owns a bicycle' },
        { pl: 'members of the book club', sg: 'a member of the book club' }
      ] },
    { intro: 'The following statements are about the contracts reviewed by {firm}\'s commercial team this week.', ent: { label: 'Contract', word: 'contract', rel: 'that', pron: 'it', are: 'is' },
      terms: [
        { pl: 'supply agreements', sg: 'a supply agreement' },
        { pl: 'contracts with a break clause', sg: 'a contract with a break clause' },
        { pl: 'contracts signed electronically', sg: 'a contract signed electronically' },
        { pl: 'contracts longer than 20 pages', sg: 'a contract longer than 20 pages' },
        { pl: 'contracts governed by Scots law', sg: 'a contract governed by Scots law' },
        { pl: 'contracts with an overseas party', sg: 'a contract with an overseas party' },
        { pl: 'contracts drafted by the client', sg: 'a contract drafted by the client' }
      ] }
  ];
  const VILLAGES = ['Marsham', 'Little Elmstead', 'Hadley Cross', 'Brockford', 'Wenbury', 'Ashwell Green'];

  // If/then atoms, listed in cause-then-effect order so rules read naturally.
  // pos and neg are full clauses in the present tense.
  const PROP_PACKS = [
    { intro: 'The following statements are about a court claim.', atoms: [
      { pos: 'the claimant files the witness statements by Friday', neg: 'the claimant does not file the witness statements by Friday' },
      { pos: 'the trial goes ahead in March', neg: 'the trial does not go ahead in March' },
      { pos: 'the case is decided before the summer', neg: 'the case is not decided before the summer' },
      { pos: 'the claimant receives compensation this year', neg: 'the claimant does not receive compensation this year' }
    ] },
    { intro: 'The following statements are about {firm}\'s offices next week.', atoms: [
      { pos: 'the server upgrade is completed on Sunday', neg: 'the server upgrade is not completed on Sunday' },
      { pos: 'the document system is available on Monday', neg: 'the document system is not available on Monday' },
      { pos: 'the team works in the office on Monday', neg: 'the team does not work in the office on Monday' },
      { pos: 'the client meeting goes ahead in person', neg: 'the client meeting does not go ahead in person' }
    ] },
    { intro: 'The following statements are about the sale of a house.', atoms: [
      { pos: 'the buyer\'s lender approves the mortgage', neg: 'the buyer\'s lender does not approve the mortgage' },
      { pos: 'the sale completes this month', neg: 'the sale does not complete this month' },
      { pos: 'the seller moves out by the 30th', neg: 'the seller does not move out by the 30th' },
      { pos: 'the new owners move in next month', neg: 'the new owners do not move in next month' }
    ] },
    { intro: 'The following statements are about a trainee solicitor called {name}.', atoms: [
      { pos: '{name} passes the final assessment', neg: '{name} does not pass the final assessment' },
      { pos: '{name} qualifies in September', neg: '{name} does not qualify in September' },
      { pos: '{name} receives a retention offer', neg: '{name} does not receive a retention offer' },
      { pos: '{name} joins the employment team', neg: '{name} does not join the employment team' }
    ] },
    { intro: 'The following statements are about a charity fun run.', atoms: [
      { pos: 'it rains heavily on Friday night', neg: 'it does not rain heavily on Friday night' },
      { pos: 'the course is waterlogged', neg: 'the course is not waterlogged' },
      { pos: 'the fun run is postponed', neg: 'the fun run is not postponed' },
      { pos: 'the medals are handed out next week', neg: 'the medals are not handed out next week' }
    ] }
  ];

  /* ------------------------------------------------------------------ */
  /* INTERPRETATION                                                      */
  /* ------------------------------------------------------------------ */
  // Two-year subgroup comparisons. Every follows/does-not-follow answer for
  // these is computed from the numbers in engine.js.
  const TREND_CONTEXTS = [
    { setup: 'In {y1}, {firm} received {N1} applications for its vacation scheme, {S1} of which came from candidates who had not studied law at university. In {y2}, it received {N2} applications, {S2} of which came from such candidates.',
      whole: 'applications', sub: 'applications from candidates who had not studied law', other: 'applications from candidates who had studied law',
      share: 'of the applications came from candidates who had not studied law',
      propOf: 'applications that came from candidates who had not studied law', predict: 'The proportion of applications coming from candidates who had not studied law will {dirVerb} again in {y3}.',
      cause: 'the firm\'s new social media campaign', wider: 'Across the legal profession, the proportion of vacation scheme applicants who had not studied law changed between {y1} and {y2}.' },
    { setup: 'In {y1}, the {city} Legal Advice Centre handled {N1} cases, {S1} of which were about housing. In {y2}, it handled {N2} cases, {S2} of which were about housing.',
      whole: 'cases', sub: 'housing cases', other: 'cases that were not about housing',
      share: 'of the centre\'s cases were about housing',
      propOf: 'the centre\'s cases that were about housing', predict: 'The proportion of the centre\'s cases that are about housing will {dirVerb} again in {y3}.',
      cause: 'rising rents in {city}', wider: 'Across the UK, the proportion of advice centre cases that were about housing changed between {y1} and {y2}.' },
    { setup: 'In {y1}, a council received {N1} complaints, {S1} of which were about missed bin collections. In {y2}, it received {N2} complaints, {S2} of which were about missed bin collections.',
      whole: 'complaints', sub: 'complaints about missed bin collections', other: 'complaints about other matters',
      share: 'of the council\'s complaints were about missed bin collections',
      propOf: 'the council\'s complaints that were about missed bin collections', predict: 'The proportion of the council\'s complaints that are about missed bin collections will {dirVerb} again in {y3}.',
      cause: 'a change of waste collection contractor', wider: 'Across the country, the proportion of council complaints that were about missed bin collections changed between {y1} and {y2}.' },
    { setup: 'In {y1}, an online law course enrolled {N1} students, {S1} of whom studied part-time. In {y2}, it enrolled {N2} students, {S2} of whom studied part-time.',
      whole: 'students', sub: 'part-time students', other: 'full-time students',
      share: 'of the course\'s students studied part-time',
      propOf: 'the course\'s students who studied part-time', predict: 'The proportion of the course\'s students who study part-time will {dirVerb} again in {y3}.',
      cause: 'a rise in the course fee for full-time study', wider: 'Across all online law courses, the proportion of part-time students changed between {y1} and {y2}.' }
  ];

  const CHANGE_CONTEXTS = [
    { setup: '{firm}\'s fee income from {area} work {dirVerb} from £{a} million in {y1} to £{b} million in {y2}.', unit: 'money', area: ['employment', 'real estate', 'private client', 'banking', 'litigation'] }
  ];

  const SURVEY_CONTEXTS = [
    { pop: 'trainee solicitors', setup: 'In a survey of {n} trainee solicitors, {k} said they would like more regular feedback from their supervisors.',
      said: 'said they would like more regular feedback from their supervisors', notSaid: 'did not say they would like more regular feedback from their supervisors',
      general: 'Most trainee solicitors in England and Wales would like more regular feedback from their supervisors.' },
    { pop: 'small business owners in {city}', setup: 'In a survey of {n} small business owners in {city}, {k} said they had used a solicitor in the past year.',
      said: 'said they had used a solicitor in the past year', notSaid: 'did not say they had used a solicitor in the past year',
      general: 'Most small business owners in {city} have used a solicitor in the past year.' },
    { pop: 'law students', setup: 'In a survey of {n} law students, {k} said they intended to apply for a training contract.',
      said: 'said they intended to apply for a training contract', notSaid: 'did not say they intended to apply for a training contract',
      general: 'Most law students in the UK intend to apply for a training contract.' },
    { pop: 'tenants in {city}', setup: 'In a survey of {n} tenants in {city}, {k} said their landlord had raised their rent in the past year.',
      said: 'said their landlord had raised their rent in the past year', notSaid: 'did not say their landlord had raised their rent in the past year',
      general: 'Most tenants in {city} have had their rent raised in the past year.' }
  ];

  // Qualitative passages: correlation, averages, scope, and missing responses.
  const INTERP_QUAL = [
    {
      id: 'walks', vars: h => ({ n: h.ri(3, 9) * 100 }),
      passage: 'A study of {n} office workers found that, on average, those who took a short walk at lunchtime reported lower stress levels than those who did not.',
      statements: [
        { a: 'follows', p: 'flip', text: 'On average, the office workers in the study who did not take a lunchtime walk reported higher stress levels than those who did.',
          why: 'This is the same comparison seen from the other side. If walkers were lower on average, non-walkers were higher on average. It follows.' },
        { a: 'follows', p: 'exists', text: 'At least one office worker in the study took a short walk at lunchtime.',
          why: 'The study compared workers who walked with workers who did not. You cannot compare a group that has nobody in it, so there must have been at least one walker. It follows.' },
        { a: 'not', p: 'corr', text: 'Taking a short walk at lunchtime reduces office workers\' stress levels.',
          why: 'The study shows a link, not a cause. Maybe less-stressed people simply have more time to walk, or people with lighter workloads both walk and feel less stressed. A link alone does not prove beyond reasonable doubt that one thing causes the other.' },
        { a: 'not', p: 'average', text: 'Every office worker in the study who took a lunchtime walk reported lower stress than every worker who did not.',
          why: 'The passage talks about averages. An average can be lower even if some walkers were more stressed than some non-walkers. "On average" does not mean "every single one".' },
        { a: 'not', p: 'corr', text: 'If the workers who did not walk at lunchtime started doing so, their stress levels would fall.',
          why: 'This predicts what would happen if people changed their behaviour, which assumes the walks cause lower stress. The study does not show that.' }
      ]
    },
    {
      id: 'flexible', vars: h => ({ n: h.ri(6, 20) * 10 }),
      passage: 'Research covering {n} law firms found that, on average, firms offering more flexible working arrangements had lower staff turnover than firms offering fewer.',
      statements: [
        { a: 'follows', p: 'flip', text: 'On average, the firms in the research that offered fewer flexible working arrangements had higher staff turnover.',
          why: 'This restates the finding from the other side, so it follows.' },
        { a: 'not', p: 'corr', text: 'Offering more flexible working causes staff turnover to fall.',
          why: 'The research found a link. It could be that firms which already keep staff well can afford to offer flexibility, or some third factor drives both. A link does not prove a cause.' },
        { a: 'not', p: 'average', text: 'Every firm in the research that offered more flexible working had lower turnover than every firm that offered less.',
          why: 'The finding is about averages, and averages allow exceptions.' },
        { a: 'not', p: 'scope', text: 'Firms in every industry that offer more flexible working have lower staff turnover.',
          why: 'The research only covered law firms. Stretching it to every industry goes beyond the evidence.' }
      ]
    },
    {
      id: 'lectures', vars: h => ({ n: h.ri(2, 8) * 100, city: h.city() }),
      passage: 'In a study of {n} students at the University of {city}, those who attended more than 90% of their lectures achieved higher average marks than those who attended fewer.',
      statements: [
        { a: 'follows', p: 'flip', text: 'In the study, students who attended 90% or fewer of their lectures achieved lower average marks than those who attended more than 90%.',
          why: 'Same finding, other direction. It follows.' },
        { a: 'not', p: 'corr', text: 'Attending lectures causes students to get higher marks.',
          why: 'Students who are already more motivated might both attend more and study harder. The study shows a link, not a cause.' },
        { a: 'not', p: 'scope', text: 'At every UK university, students who attend more lectures get higher marks.',
          why: 'The study covered one university. Applying it to every university goes beyond the evidence.' },
        { a: 'not', p: 'average', text: 'No student in the study who attended more than 90% of lectures got a lower mark than a student who attended fewer.',
          why: 'Averages allow overlap. Some high attenders could still have scored below some low attenders.' }
      ]
    },
    {
      id: 'smart-meter', vars: h => ({ n: h.ri(5, 20) * 100, city: h.city() }),
      passage: 'A survey of {n} households in {city} found that households with a smart meter used less electricity, on average, than households without one.',
      statements: [
        { a: 'follows', p: 'exists', text: 'At least one of the households surveyed had a smart meter.',
          why: 'The survey compared households with and without a smart meter, so both groups must have existed. It follows.' },
        { a: 'not', p: 'corr', text: 'Installing a smart meter makes a household use less electricity.',
          why: 'Households that already care about saving energy may be the ones who choose smart meters. The survey shows a link, not a cause.' },
        { a: 'not', p: 'scope', text: 'Across the UK, households with a smart meter use less electricity on average than households without one.',
          why: 'The survey covered {n} households in {city}. Extending it to the whole UK goes beyond the evidence.' },
        { a: 'follows', p: 'flip', text: 'On average, the surveyed households without a smart meter used more electricity than those with one.',
          why: 'Same finding from the other side. It follows.' }
      ]
    },
    {
      id: 'friday-closure', vars: h => ({ firm: h.firm(), city: h.city(), m: h.ri(3, 9) }),
      passage: 'During a {m}-month trial, {firm} closed its {city} office on Fridays. Over the trial period, the {city} office received the same number of client complaints as in the same months of the previous year.',
      statements: [
        { a: 'follows', p: 'restate', text: 'The trial lasted less than a year.',
          why: '{m} months is less than twelve months. It follows.' },
        { a: 'follows', p: 'restate', text: 'During the trial, the {city} office did not receive more client complaints than in the same months of the previous year.',
          why: 'The number was the same, so it was not higher. It follows.' },
        { a: 'not', p: 'scope', text: 'Closing on Fridays would have no effect on client complaints at any of {firm}\'s offices.',
          why: 'The trial only involved the {city} office, and only for {m} months. Saying what would happen at every office goes beyond the evidence.' },
        { a: 'not', p: 'gap', text: 'Clients of the {city} office did not notice that it was closed on Fridays.',
          why: 'Unchanged complaints do not mean nobody noticed. Clients could notice and simply not complain. The passage says nothing about what clients noticed.' },
        { a: 'not', p: 'gap', text: 'Staff at the {city} office preferred working four days a week.',
          why: 'The passage gives no information about what staff preferred.' }
      ]
    },
    {
      id: 'partner-vote', vars: h => ({ firm: h.firm(), n: h.ri(20, 45), k: h.ri(3, 12) }),
      passage: 'All {n} of the partners at {firm} who responded to a survey said they supported the firm\'s new pay structure. A further {k} partners did not respond.',
      statements: [
        { a: 'follows', p: 'restate', text: 'At least one partner at {firm} said they supported the new pay structure.',
          why: '{n} partners said so, so at least one did. It follows.' },
        { a: 'follows', p: 'restate', text: '{firm} had more than {n} partners at the time of the survey.',
          why: '{n} responded and {k} more did not, making at least {n} + {k} partners. It follows.' },
        { a: 'not', p: 'gap', text: 'All of {firm}\'s partners said they supported the new pay structure.',
          why: '{k} partners did not respond, so we do not know what they would have said. "All who responded" is not "all".' },
        { a: 'not', p: 'gap', text: 'The partners who did not respond were opposed to the new pay structure.',
          why: 'Not responding tells you nothing about someone\'s view. They might support it, oppose it or have no view.' }
      ]
    }
  ];

  root.WG_CONTENT = {
    FIRMS, CITIES, NAMES, VILLAGES,
    INFERENCE, REC_TOPICS, ASSUMPTION_ITEMS, ARG_TOPICS, GENERIC_WEAK,
    CAT_PACKS, PROP_PACKS, TREND_CONTEXTS, CHANGE_CONTEXTS, SURVEY_CONTEXTS, INTERP_QUAL
  };
})(typeof window !== 'undefined' ? window : globalThis);
