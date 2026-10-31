/*
 * bank-test.js: "Test level" questions, written to match the CMS practice
 * test (Pearson Watson-Glaser, delivered by Getfeedback).
 *
 * What the CMS practice test showed, and what these questions copy:
 *  - Inference: one long, factual, news-style passage (around 100 words) with
 *    several statements that turn on exact wording (e.g. "the first in the
 *    region" means there was none before).
 *  - Assumptions: one hedged, general statement ("improve your chances...")
 *    followed by several abstract proposed assumptions with no easy
 *    giveaway words.
 *  - Deduction: realistic everyday reasoning ending "Therefore:", with traps
 *    about scope ("loads over one ton"), "only if" and "not until".
 *  - Interpretation and arguments: realistic study and policy passages where
 *    the wrong answer sounds sensible.
 *
 * Nothing here is copied from the real test. All places and organisations are
 * fictional. Where a deduction can be written in formal logic, the `logic`
 * field lets the test suite re-check the answer with the logic checker.
 */
(function (root) {
  'use strict';
  const B = root.WG_BANK = root.WG_BANK || {};
  const s = (a, p, text, why, logic) => ({ a, p, text, why, logic });

  /* ------------------------------------------------------------------ */
  B.TEST_INFERENCE = [
    { id: 'valmont',
      passage: 'Valmont is one of the oldest spa towns in the Pyrenees. Last year, the Valmont district council introduced a water conservation strategy, the first in the region. The strategy commits the district to cutting its water use by 18 percent by 2030. Among the proposed measures is a ban on filling private swimming pools during the summer months. Recent studies have recorded falling spring water levels and longer summer droughts in the district, and warn that the thermal springs which supply the town\'s three spa hotels could become unreliable within twenty years.',
      statements: [
        s('T', 'inf-T', 'The Valmont district council had never introduced a water conservation strategy before last year.', 'The strategy is described as "the first in the region", and Valmont is in that region. If the council had introduced one before, last year\'s would not be the first. So this must be true. Watch for small phrases like "the first" that settle a statement completely.'),
        s('T', 'inf-T', 'The district aims to use less water in 2030 than it does now.', 'The strategy "commits the district to cutting its water use by 18 percent by 2030". Cutting use means using less. True.'),
        s('PT', 'inf-PT', 'Some homes in the Valmont district have private swimming pools.', 'A ban on filling private pools would be pointless if there were none, so it is likely that some exist. But the measure is only proposed, and nothing says how many pools there are. Likely but not certain: Probably true.'),
        s('PF', 'inf-PF', 'The ban on filling private swimming pools is already in force.', 'The passage calls the ban one of the "proposed measures". Proposed usually means not yet in force, so this leans false. It does not completely rule it out, so it is Probably false rather than False.'),
        s('T', 'inf-T', 'The town\'s spa hotels currently rely on its thermal springs.', 'The passage says the thermal springs "supply the town\'s three spa hotels". True.'),
        s('ID', 'inf-ID', 'Most of Valmont\'s hotel owners opposed the water conservation strategy.', 'The passage says nothing about what hotel owners thought. Insufficient data.'),
        s('F', 'inf-F', 'Studies have found that water levels in the district\'s springs are rising.', 'The passage says studies "recorded falling spring water levels". This contradicts it. False.')
      ] },
    { id: 'harwell',
      passage: 'In 2023, the Harwell Museum of Science opened a new gallery on the history of computing. Entry to the museum is free, but visitors pay £8 to enter the new gallery. In its first year, the gallery attracted 140,000 visitors, more than any other paid exhibition the museum has ever staged. Around two-thirds of gallery visitors were adults visiting without children. The museum\'s director has said that income from the gallery will be used to fund free science workshops for local schools.',
      statements: [
        s('T', 'inf-T', 'Visitors can see some of the Harwell Museum\'s exhibits without paying.', 'Entry to the museum is free; only the new gallery costs £8. True.'),
        s('T', 'inf-T', 'No paid exhibition at the museum before 2023 had attracted as many as 140,000 visitors.', 'The new gallery\'s 140,000 was "more than any other paid exhibition the museum has ever staged". So every earlier paid exhibition had fewer than 140,000. True. This kind of statement looks like a guess but is actually settled by the wording.'),
        s('F', 'inf-F', 'Most visitors to the new gallery in its first year were children.', 'Around two-thirds of visitors were adults visiting without children. That leaves about one-third for everyone else, including children, so children cannot have been most visitors. False.'),
        s('PT', 'inf-PT', 'Local schools will benefit from the success of the new gallery.', 'The director has said gallery income will fund free workshops for local schools. That makes it likely, but a stated plan is not a certainty. Probably true.'),
        s('ID', 'inf-ID', 'The computing gallery was the most visited part of the museum in 2023.', 'The passage compares the gallery only with other paid exhibitions. The free parts of the museum might have had more visitors. Insufficient data.'),
        s('ID', 'inf-ID', 'The museum charged for entry to the gallery because it was expensive to build.', 'The passage gives no reason for the charge. Insufficient data.')
      ] },
    { id: 'brightwater',
      passage: 'Brightwater, a regional bus company, replaced its 60 diesel buses with electric buses over the past three years. The company says its fuel and maintenance costs have fallen by a third over the same period. During those three years, passenger numbers grew by 12 percent, while fares rose by 4 percent, less than the rate of inflation. Brightwater has announced that it will open two new routes next year, both serving towns that currently have no bus service.',
      statements: [
        s('T', 'inf-T', 'In real terms, Brightwater\'s fares are cheaper now than they were three years ago.', '"In real terms" means after allowing for inflation. Fares rose by less than inflation, so in real terms they fell. True. (Knowing what "real terms" means is common knowledge you are allowed to use.)'),
        s('PT', 'inf-PT', 'Switching to electric buses was the main reason Brightwater\'s fuel and maintenance costs fell.', 'Costs fell over the same three years as the switch, and electric buses use no diesel, so the switch is a likely main cause. The passage does not prove it, and the figure comes from the company itself. Probably true.'),
        s('T', 'inf-T', 'Brightwater carries more passengers now than it did three years ago.', 'Passenger numbers grew by 12 percent over the three years. True.'),
        s('T', 'inf-T', 'There are towns that currently have no bus service.', 'The two new routes will serve "towns that currently have no bus service". True.'),
        s('F', 'inf-F', 'Brightwater cut its fares over the last three years.', 'Fares rose by 4 percent. Cheaper in real terms is not the same as cut. False.'),
        s('ID', 'inf-ID', 'Most of Brightwater\'s passengers are commuters.', 'The passage says nothing about who the passengers are. Insufficient data.')
      ] },
    { id: 'northgate',
      passage: 'Since 2021, the Northgate Law Centre has offered free telephone advice on housing problems. Callers speak first to a trained adviser, and those whose problem cannot be resolved over the phone are offered an appointment with a solicitor. Last year the service took 9,400 calls, and roughly one in five callers were offered a solicitor\'s appointment. Demand for the service has risen every year since it began. The centre\'s current funding for the service ends in March, and it has applied to two charitable trusts for new funding.',
      statements: [
        s('F', 'inf-F', 'The telephone service has been running for less than a year.', 'It has run since 2021, and demand has risen "every year since it began". False.'),
        s('T', 'inf-T', 'Around 1,900 callers were offered an appointment with a solicitor last year.', 'Roughly one in five of 9,400 is about 1,880, which is around 1,900. True.'),
        s('PT', 'inf-PT', 'The service took more calls last year than in its first year.', 'Demand has risen every year, which makes it likely that more calls were taken. But demand (how many people want help) is not the same as calls taken (how many were answered), so it is not certain. Probably true.'),
        s('ID', 'inf-ID', 'The service will continue after March.', 'Funding ends in March and the centre has applied for more, but the passage does not say whether it will succeed. Nothing tips the balance. Insufficient data.'),
        s('ID', 'inf-ID', 'Callers who are offered a solicitor\'s appointment have to pay for it.', 'The passage says the telephone advice is free but says nothing about the cost of the appointment. It is tempting to say False, but nothing rules it out. Insufficient data.'),
        s('ID', 'inf-ID', 'Housing problems are the most common reason people contact the Northgate Law Centre.', 'The passage only describes the housing service. It says nothing about the centre\'s other work. Insufficient data.')
      ] },
    { id: 'marston',
      passage: 'A survey of 2,000 adults living in Marston found that 38 percent had not visited a dentist in the past two years. More than half of these said the main reason was that they could not find a dentist taking on new patients. Marston has one of the lowest numbers of dentists per head of population in the country. Next year, a new dental school will open in the city, and its students will treat members of the public under supervision.',
      statements: [
        s('T', 'inf-T', 'More than 700 of the adults surveyed had not visited a dentist in the past two years.', '38 percent of 2,000 is 760, which is more than 700. True.'),
        s('T', 'inf-T', 'Marston has fewer dentists per head of population than most places in the country.', 'If Marston has "one of the lowest" numbers per head, most places must have more. True.'),
        s('PT', 'inf-PT', 'Most adults living in Marston have visited a dentist in the past two years.', 'In the survey, 62 percent had. A survey of 2,000 residents is a reasonable guide to the whole city, but a sample can be unrepresentative, so it is not certain. Probably true.'),
        s('PT', 'inf-PT', 'The new dental school will help some Marston residents to get dental treatment.', 'Students will treat members of the public, in a city short of dentists. That makes this likely, but it has not happened yet. Probably true.'),
        s('ID', 'inf-ID', 'Some of the adults surveyed said cost was the main reason they had not seen a dentist.', 'More than half gave the "no dentist taking new patients" reason. The passage does not say what the rest said. Insufficient data.'),
        s('ID', 'inf-ID', 'Treatment at the dental school will be cheaper than at other dentists in Marston.', 'Nothing is said about prices. Insufficient data.')
      ] },
    { id: 'tarn',
      passage: 'The Tarn Philharmonic gave 64 concerts last season, eight more than the season before. Ticket sales rose by 15 percent, and for the first time more than half of all tickets were bought online. The orchestra\'s chief executive said that a new scheme offering £5 tickets to under-26s had brought in "a younger audience than we have ever had". Roughly a third of the orchestra\'s income comes from public funding, which was frozen last season.',
      statements: [
        s('T', 'inf-T', 'The orchestra gave 56 concerts in the season before last.', '64 concerts was eight more than the season before: 64 − 8 = 56. True.'),
        s('T', 'inf-T', 'In no earlier season were more than half of the orchestra\'s tickets bought online.', 'Last season was "the first time" more than half were bought online. True.'),
        s('PT', 'inf-PT', 'The £5 tickets for under-26s helped to increase ticket sales.', 'Sales rose in the season the scheme began, and the chief executive credits it with bringing in younger people. Likely, but other things could explain the rise (eight extra concerts, for one). Probably true.'),
        s('PT', 'inf-PT', 'The average age of the orchestra\'s audience fell last season.', 'The chief executive says the audience was younger than ever. That is a claim by someone with an interest, not measured data, so it is likely rather than certain. Probably true.'),
        s('T', 'inf-T', 'Most of the orchestra\'s income comes from sources other than public funding.', 'Public funding is roughly a third of income, so roughly two-thirds comes from elsewhere. True.'),
        s('F', 'inf-F', 'The orchestra\'s public funding increased last season.', 'It was frozen, so it did not increase. False.'),
        s('ID', 'inf-ID', 'The orchestra made a profit last season.', 'The passage gives no figures for costs or profit. Insufficient data.')
      ] },
    { id: 'elford',
      passage: 'Three years ago, the town of Elford banned cars from its high street between 10am and 5pm. Since then, the number of empty shops on the street has fallen from 14 to 6, and counters show that the number of people visiting the high street on weekdays has risen by 20 percent. Two shops selling car parts closed during the same period, and their owners blamed the ban. A similar scheme in the neighbouring town of Hadlow was abandoned after one year.',
      statements: [
        s('T', 'inf-T', 'Cars can use Elford high street at some times of the day.', 'The ban only covers 10am to 5pm. True.'),
        s('PT', 'inf-PT', 'The ban has helped to reduce the number of empty shops on Elford high street.', 'Empty shops fell and weekday visitors rose after the ban began, which suggests it helped. Other causes are possible. Probably true.'),
        s('F', 'inf-F', 'Every business on Elford high street has supported the ban.', 'Two shop owners blamed the ban for their closures, so not every business supported it. False.'),
        s('ID', 'inf-ID', 'Weekend visitor numbers on Elford high street have also risen.', 'The counters figure is for weekdays only. Nothing is said about weekends. Insufficient data. Watch for statements that quietly widen what was measured.'),
        s('ID', 'inf-ID', 'Hadlow abandoned its scheme because it reduced the number of visitors.', 'The passage does not say why Hadlow\'s scheme was abandoned. Insufficient data.'),
        s('F', 'inf-F', 'Fewer people visit Elford high street on weekdays now than before the ban.', 'Weekday visitors rose by 20 percent. False.')
      ] },
    { id: 'flexstudy',
      passage: 'In a two-year study at a large accountancy firm, staff who were allowed to choose their own working hours took an average of 4 sick days a year, compared with 7 days for staff on fixed hours. Staff were not chosen at random: the option to choose hours was offered only to those who had worked at the firm for at least five years. The firm has now decided to offer flexible hours to all of its staff from next year.',
      statements: [
        s('T', 'inf-T', 'During the study, staff on fixed hours took more sick days on average than staff who chose their own hours.', '7 days against 4 days on average. True.'),
        s('T', 'inf-T', 'All of the staff in the study who chose their own hours had worked at the firm for at least five years.', 'The option was offered only to staff with at least five years\' service. True.'),
        s('T', 'inf-T', 'The study lasted longer than a year.', 'It was a two-year study. True.'),
        s('PF', 'inf-PF', 'Every member of staff who chose their own hours took fewer sick days than every member of staff on fixed hours.', 'The figures are averages. With many staff, it would be very unusual for the two groups not to overlap at all. Not impossible, but unlikely: Probably false.'),
        s('ID', 'inf-ID', 'Most staff at the firm have worked there for at least five years.', 'The passage does not say how many staff fall into each group. Insufficient data.')
      ] }
  ];

  /* ------------------------------------------------------------------ */
  B.TEST_ASSUMPTIONS = [
    { id: 'language', passage: '"Although learning a second language takes years of effort, it is one of the best ways to improve your career prospects in international business."',
      statements: [
        s('made', 'asm-possible', 'It is possible to improve your career prospects in international business.', 'Advice on how to improve your prospects only makes sense if they can be improved. Flip it ("prospects cannot be improved") and the statement makes no sense. Assumed.'),
        s('made', 'asm-made', 'Speaking a second language can be useful in international business.', 'Calling it "one of the best ways" to improve your prospects takes for granted that it is useful. Flip it and the claim collapses. Assumed.'),
        s('not', 'asm-only', 'Learning a second language is the only way to improve career prospects in international business.', '"One of the best ways" openly allows for other ways. Not assumed.'),
        s('not', 'asm-over', 'Everyone in international business who learns a second language will be promoted.', 'The speaker says it improves your prospects, not that it guarantees anything. Not assumed.'),
        s('not', 'asm-not', 'Most people who work in international business already speak a second language.', 'The claim works whether or not most people already do. Not assumed.'),
        s('not', 'asm-not', 'People who speak only one language cannot succeed in international business.', 'Saying a second language helps does not mean you cannot succeed without one. Not assumed.')
      ] },
    { id: 'parks', passage: '"Cities that invest in public parks tend to have healthier residents, so councils that care about public health should protect their park budgets."',
      statements: [
        s('made', 'asm-made', 'The link between park investment and healthier residents is not entirely explained by other factors.', 'The speaker moves from "parks go with health" to "protect parks for health". That only works if parks actually contribute, rather than, say, wealthy cities having both. Flip it and the advice loses its basis. Assumed.'),
        s('made', 'asm-possible', 'Council spending decisions can affect the health of residents.', 'Advising councils to protect budgets for health reasons takes for granted that what they spend can make a difference. Assumed.'),
        s('not', 'asm-conditional', 'Some councils care about public health.', 'This is a conditional: "councils that care... should". It gives advice IF a council cares, without assuming any do. Not assumed. Conditional advice is a common trap.'),
        s('not', 'asm-only', 'Investing in parks is the most effective way to improve public health.', 'The speaker never compares parks with other measures. Not assumed.'),
        s('not', 'asm-over', 'Everyone living in a city without parks is unhealthy.', '"Tend to" describes an overall pattern, not every individual. Not assumed.')
      ] },
    { id: 'reserves', passage: '"If you want your small business to survive its first three years, you should keep at least six months of running costs in reserve."',
      statements: [
        s('made', 'asm-possible', 'It is possible for a small business to build up six months of running costs in reserve.', 'Nobody seriously advises something they think cannot be done. Assumed.'),
        s('made', 'asm-made', 'Having cash in reserve can affect whether a small business survives.', 'The advice links reserves to survival, so it takes for granted that reserves make a difference. Flip it and the advice is pointless. Assumed.'),
        s('not', 'asm-over', 'Every small business with six months of reserves survives its first three years.', 'The speaker says reserves help, not that they guarantee survival. Not assumed.'),
        s('not', 'asm-not', 'Most small businesses fail within their first three years.', 'The advice works whatever the failure rate is. Not assumed.'),
        s('not', 'asm-conditional', 'All small business owners want their business to survive.', 'The advice is conditional: "if you want...". It does not assume everyone wants this. Not assumed.'),
        s('not', 'asm-not', 'Keeping more than six months of reserves would be a mistake.', '"At least six months" sets a minimum, not a maximum. Not assumed.')
      ] },
    { id: 'records', passage: '"Now that most music is streamed rather than bought, record shops that want to stay open will need to offer customers something they cannot get online."',
      statements: [
        s('made', 'asm-made', 'Some customers would visit a record shop for something they cannot get online.', 'The advice only makes sense if offering something unavailable online could bring customers in. Flip it and the advice is useless. Assumed.'),
        s('not', 'asm-over', 'All record shops will close within ten years.', 'The speaker describes what shops need to do to stay open, not a prediction that all will close. Not assumed.'),
        s('not', 'asm-over', 'People who stream music never buy records.', '"Most music is streamed rather than bought" is about the overall pattern. It does not say no streamer buys records. Not assumed.'),
        s('not', 'asm-compare', 'Visiting a record shop is more enjoyable than using a streaming service.', 'The speaker makes no comparison of enjoyment. Not assumed.'),
        s('not', 'asm-not', 'Record shops cannot sell music that is also available to stream.', 'The speaker says shops will need to offer something extra, not that they cannot sell anything available online. Not assumed.')
      ] },
    { id: 'jury', passage: '"Because juries cannot be expected to understand complex financial evidence, fraud trials should be heard by a judge sitting alone."',
      statements: [
        s('made', 'asm-made', 'A judge sitting alone is better able to understand complex financial evidence than a jury.', 'The reason given against juries only supports a judge if a judge would do better. Flip it ("judges understand it no better") and the argument collapses. Assumed.'),
        s('made', 'asm-made', 'Fraud trials can involve complex financial evidence.', 'The argument is about fraud trials because of complex financial evidence, so it takes for granted that such evidence comes up in them. Assumed.'),
        s('not', 'asm-over', 'Juries reach the wrong verdict in most fraud trials.', 'The speaker says juries cannot be expected to understand the evidence, not that they usually get verdicts wrong. Not assumed.'),
        s('not', 'asm-not', 'Juries should be abolished for all criminal trials.', 'The argument is limited to fraud trials. Not assumed.'),
        s('not', 'asm-over', 'Judges never make mistakes.', 'Being better than a jury does not require being perfect. Not assumed.')
      ] },
    { id: 'housing', passage: '"With house prices rising faster than wages, first-time buyers who want a home of their own will increasingly need help from their families."',
      statements: [
        s('made', 'asm-made', 'House prices rising faster than wages makes it harder for first-time buyers to afford a home.', 'The speaker links the price-wage gap to needing family help. That link only works if the gap makes buying harder. Assumed.'),
        s('not', 'asm-over', 'No first-time buyer can afford a home without help from family.', '"Increasingly need help" describes a trend, not every buyer. Not assumed.'),
        s('not', 'asm-not', 'All first-time buyers have family members who could help them.', 'The speaker says buyers will need help, not that all of them can get it. Not assumed.'),
        s('not', 'asm-conditional', 'Most first-time buyers want a home of their own.', 'The statement is about buyers "who want a home of their own". It does not assume how many do. Not assumed.'),
        s('not', 'asm-compare', 'Renting is more expensive than buying a home.', 'Renting is never mentioned. Not assumed.')
      ] },
    { id: 'paygap', passage: '"Firms that publish their gender pay gap are more likely to close it, since public scrutiny encourages employers to act."',
      statements: [
        s('made', 'asm-made', 'Publishing a pay gap exposes a firm to public scrutiny.', 'The reason given is scrutiny. It only explains why publishing helps if publishing actually brings scrutiny. Assumed.'),
        s('made', 'asm-possible', 'Employers can take action that reduces their gender pay gap.', 'Scrutiny "encourages employers to act" to close the gap. That takes for granted that their actions can affect it. Assumed.'),
        s('not', 'asm-over', 'Every firm that publishes its pay gap will close it.', '"More likely" is about chances, not certainty. Not assumed.'),
        s('not', 'asm-not', 'Firms that do not publish their pay gap have larger gaps than those that do.', 'The claim is about which firms are more likely to close a gap, not about current gap sizes. Not assumed.'),
        s('not', 'asm-compare', 'The public cares more about pay gaps than about any other workplace issue.', 'The speaker only needs scrutiny to encourage action, not for pay gaps to be the top concern. Not assumed.')
      ] },
    { id: 'reading', passage: '"Reading to young children every day gives them a head start at school, so parents should make time for it even when they are busy."',
      statements: [
        s('made', 'asm-possible', 'Busy parents are able to find time to read to their children.', '"Should make time even when busy" takes for granted that busy parents can. Assumed.'),
        s('made', 'asm-made', 'What happens before children start school can affect how they get on there.', 'A "head start at school" from reading at home only makes sense if early experiences matter. Assumed.'),
        s('not', 'asm-over', 'Children who are not read to every day will struggle at school.', 'A head start for some does not mean everyone else struggles. Not assumed.'),
        s('not', 'asm-compare', 'Reading is more valuable than any other activity parents can do with their children.', 'No comparison with other activities is made. Not assumed.'),
        s('not', 'asm-not', 'Most parents do not currently read to their children every day.', 'The advice works whatever parents currently do. Not assumed.')
      ] }
  ];

  /* ------------------------------------------------------------------ */
  // logic: { kind: 'cat', k, premises: [...], concl } or { kind: 'prop', n, prem, concl }.
  const A = (x, y) => ({ f: 'A', x, y }), E = (x, y) => ({ f: 'E', x, y }), I = (x, y) => ({ f: 'I', x, y }), O = (x, y) => ({ f: 'O', x, y });
  const L = (a, v) => ({ t: 'lit', a, v }), IMP = (l, r) => ({ t: 'imp', l, r }), OR = (l, r) => ({ t: 'or', l, r });
  const kelmoor = [A(0, 1), E(1, 2), I(3, 2)];
  const paint = [A(0, 1), I(0, 2), E(2, 3)];
  const tax = [I(0, 1), A(1, 2), E(2, 3)];
  const lab = [A(1, 0), A(2, 1), I(3, 2)];
  const lib = [IMP(L(0, true), L(1, true)), IMP(L(1, true), L(2, true)), L(2, false)];
  const merger = [OR(L(0, true), L(1, true)), IMP(L(1, true), L(2, true)), L(2, false)];
  B.TEST_DEDUCTION = [
    { id: 'kelmoor',
      passage: 'All flights leaving Kelmoor airport after 9pm are operated by Skylark. Skylark does not fly to any destination outside Europe. Some flights leaving Kelmoor before 9pm go to destinations outside Europe. Therefore:',
      statements: [
        s('follows', 'ded-chain', 'No flight leaving Kelmoor after 9pm goes to a destination outside Europe.', 'Take any flight leaving after 9pm. It is operated by Skylark (statement 1), and Skylark does not fly outside Europe (statement 2). So it cannot go outside Europe. Follows.', { kind: 'cat', k: 4, premises: kelmoor, concl: E(0, 2) }),
        s('follows', 'ded-some-follow', 'Some flights leaving Kelmoor before 9pm are not operated by Skylark.', 'Some before-9pm flights go outside Europe. Skylark never does. So those flights cannot be Skylark\'s. Follows.', { kind: 'cat', k: 4, premises: kelmoor, concl: O(3, 1) }),
        s('not', 'ded-conversion', 'All Skylark flights from Kelmoor leave after 9pm.', 'Statement 1 says every late flight is Skylark\'s. It does not say every Skylark flight is late. Skylark could run daytime flights too. Does not follow.', { kind: 'cat', k: 4, premises: kelmoor, concl: A(1, 0) }),
        s('not', 'ded-some-all', 'Every flight leaving Kelmoor before 9pm goes to a destination outside Europe.', 'Only "some" before-9pm flights go outside Europe. Others may not. Does not follow.', { kind: 'cat', k: 4, premises: kelmoor, concl: A(3, 2) }),
        s('not', 'ded-nolink', 'Skylark operates no flights from Kelmoor before 9pm.', 'The statements never say whether Skylark flies before 9pm. Does not follow.', { kind: 'cat', k: 4, premises: kelmoor, concl: E(1, 3) })
      ] },
    { id: 'bridge',
      passage: 'Flooding has closed the bridge to the island to all vehicles over 3.5 tonnes. Deliveries over 3.5 tonnes are now being made by ferry, but the ferry can carry only one lorry at a time, so it is being used only for fuel and food deliveries. The bridge cannot be repaired until the flood water has gone down. Therefore:',
      statements: [
        s('not', 'ded-scope', 'At present, only fuel and food are being delivered to the island.', 'The restriction only applies to deliveries over 3.5 tonnes. Lighter vehicles are not mentioned, so other goods could still be arriving by bridge in smaller loads. Does not follow. Always check what a restriction actually covers.'),
        s('follows', 'ded-scope', 'At present, no vehicle over 3.5 tonnes is crossing the bridge.', 'The bridge is closed to all vehicles over 3.5 tonnes. Follows.'),
        s('follows', 'ded-scope', 'Deliveries over 3.5 tonnes of goods other than fuel and food are not currently reaching the island by ferry.', 'The ferry is used only for fuel and food. So heavy deliveries of anything else are not going by ferry. Follows.'),
        s('not', 'ded-notuntil', 'The bridge will be repaired as soon as the flood water has gone down.', '"Cannot be repaired until" sets a condition that must happen first. It does not promise the repair happens straight after. Does not follow.'),
        s('not', 'ded-scope', 'Vehicles weighing less than 3.5 tonnes can still cross the bridge.', 'The statements say heavier vehicles are banned. They do not say lighter ones are allowed; the bridge might be closed to them for another reason. Does not follow. This is the trap in the other direction.')
      ] },
    { id: 'advocacy',
      passage: 'Every trainee at the firm completes a seat in litigation. Every trainee who completes a seat in litigation attends the advocacy course. Nobody who attends the advocacy course has to sit the drafting test. Priya is a trainee at the firm. Therefore:',
      statements: [
        s('follows', 'ded-chain', 'Priya attends the advocacy course.', 'Priya is a trainee, so completes a litigation seat (statement 1). Trainees who complete that seat attend the advocacy course (statement 2). Follows.'),
        s('follows', 'ded-chain', 'Priya does not have to sit the drafting test.', 'Priya attends the advocacy course (above), and nobody who attends it has to sit the drafting test. Follows.'),
        s('not', 'ded-conversion', 'Everyone who attends the advocacy course is a trainee.', 'The statements say trainees attend. They do not say only trainees attend. Does not follow.'),
        s('not', 'ded-scope', 'Nobody at the firm has to sit the drafting test.', 'The statements only cover people who attend the advocacy course. Other staff at the firm might have to sit it. Does not follow.'),
        s('not', 'ded-nolink', 'Priya\'s first seat is in litigation.', 'The statements say every trainee completes a litigation seat at some point, not which seat comes first. Does not follow.')
      ] },
    { id: 'library',
      passage: 'The library opens on a Sunday only if volunteers are available. Volunteers are available only when the community centre next door is closed. The community centre is open every Sunday in December. Therefore:',
      statements: [
        s('follows', 'prop-onlyif', 'The library will not open on any Sunday in December.', 'On a December Sunday the centre is open, so volunteers are not available (statement 2). Without volunteers the library cannot open (statement 1). Follows.', { kind: 'prop', n: 3, prem: lib, concl: L(0, false) }),
        s('not', 'prop-onlyif', 'If the community centre is closed on a Sunday, the library will open.', '"Only if" gives a must-have, not a guarantee. A closed centre is needed for volunteers, and volunteers are needed for the library, but neither guarantees the library opens. Does not follow.', { kind: 'prop', n: 3, prem: [lib[0], lib[1]], concl: IMP(L(2, true), L(0, true)) }),
        s('not', 'prop-onlyif', 'Volunteers are available on every Sunday the community centre is closed.', '"Available only when the centre is closed" means a closed centre is necessary, not that it guarantees volunteers. Does not follow.', { kind: 'prop', n: 3, prem: [lib[0], lib[1]], concl: IMP(L(2, true), L(1, true)) }),
        s('not', 'ded-scope', 'The library does not open on any Sunday.', 'We only know the centre is open on December Sundays. In other months it might be closed, letting the library open. Does not follow.')
      ] },
    { id: 'planning',
      passage: 'Members of the planning committee may not vote on applications in the ward they represent. Councillor Shah represents Eastfield ward and sits on the planning committee. The application for a new supermarket is in Eastfield ward. Some members of the committee have said that they oppose the supermarket. Therefore:',
      statements: [
        s('follows', 'ded-chain', 'Councillor Shah may not vote on the supermarket application.', 'Shah is on the committee, represents Eastfield, and the application is in Eastfield. The rule applies directly. Follows.'),
        s('follows', 'ded-some-follow', 'At least one member of the committee may not vote on the supermarket application.', 'Councillor Shah is one such member. Follows.'),
        s('not', 'ded-nolink', 'Councillor Shah opposes the supermarket.', 'Only "some" members oppose it, and we are not told who. Does not follow.'),
        s('not', 'ded-nolink', 'The supermarket application will be rejected.', 'Nothing tells you how the vote will go. Does not follow.'),
        s('not', 'ded-scope', 'Councillors who do not sit on the planning committee may vote on the application.', 'The statements only describe committee members. They say nothing about whether anyone else can vote. Does not follow.')
      ] },
    { id: 'lab',
      passage: 'Only employees who have completed safety training hold a security pass. Nobody can enter the laboratory without holding a security pass. Some of the people working on the new building have entered the laboratory. Therefore:',
      statements: [
        s('follows', 'ded-some-follow', 'Some of the people working on the new building are employees who have completed safety training.', 'Some of them entered the laboratory, so they hold a pass (statement 2), so they are trained employees (statement 1). Follows, even if it seems surprising.', { kind: 'cat', k: 4, premises: lab, concl: I(3, 0) }),
        s('not', 'ded-some-all', 'Everyone working on the new building has completed safety training.', 'Only "some" of them entered the laboratory. The others might not be trained. Does not follow.', { kind: 'cat', k: 4, premises: lab, concl: A(3, 0) }),
        s('not', 'ded-conversion', 'Every employee who has completed safety training has entered the laboratory.', 'Training is needed to hold a pass, and a pass is needed to enter. Neither means every trained employee has gone in. Does not follow.', { kind: 'cat', k: 4, premises: lab, concl: A(0, 2) }),
        s('not', 'ded-conversion', 'Anyone who holds a security pass can enter the laboratory.', 'A pass is necessary to enter, but the statements never say it is enough. Does not follow.')
      ] },
    { id: 'merger',
      passage: 'Either the regulator will approve the merger, or the two companies will remain separate. If the companies remain separate, the Leeds office will close. The Leeds office will not close. Therefore:',
      statements: [
        s('follows', 'prop-or', 'The regulator will approve the merger.', 'If the companies stayed separate, Leeds would close. Leeds will not close, so they will not stay separate. One of the two options must happen, so the merger will be approved. Follows.', { kind: 'prop', n: 3, prem: merger, concl: L(0, true) }),
        s('follows', 'prop-mt', 'The two companies will not remain separate.', 'Staying separate would close Leeds, and Leeds will not close. Follows.', { kind: 'prop', n: 3, prem: merger, concl: L(1, false) }),
        s('not', 'prop-or', 'The companies will remain separate.', 'This is the opposite of what the statements force. Does not follow.', { kind: 'prop', n: 3, prem: merger, concl: L(1, true) })
      ] },
    { id: 'paintings',
      passage: 'All of the paintings in the exhibition were painted before 1900. Some of the paintings in the exhibition are by Welsh artists. None of the paintings by Welsh artists were painted in oil. Therefore:',
      statements: [
        s('follows', 'ded-some-follow', 'Some paintings painted before 1900 were not painted in oil.', 'Some exhibition paintings are by Welsh artists. Those were painted before 1900 (all exhibition paintings were), and none by Welsh artists is in oil. Follows.', { kind: 'cat', k: 4, premises: paint, concl: O(1, 3) }),
        s('not', 'ded-some-all', 'None of the paintings in the exhibition were painted in oil.', 'Only the Welsh artists\' paintings are ruled out. Others in the exhibition could be oils. Does not follow.', { kind: 'cat', k: 4, premises: paint, concl: E(0, 3) }),
        s('not', 'ded-scope', 'All paintings by Welsh artists were painted before 1900.', 'Only the paintings in the exhibition are known to pre-date 1900. Welsh artists\' paintings elsewhere could be later. Does not follow.', { kind: 'cat', k: 4, premises: paint, concl: A(2, 1) }),
        s('not', 'ded-nolink', 'Some of the paintings in the exhibition were painted in oil.', 'Nothing says any exhibition painting is an oil. Does not follow.', { kind: 'cat', k: 4, premises: paint, concl: I(0, 3) })
      ] },
    { id: 'chambers',
      passage: 'Some of the barristers in the chambers specialise in tax. Every barrister in the chambers who specialises in tax holds an accountancy qualification. None of the barristers in the chambers who hold an accountancy qualification sits as a part-time judge. Therefore:',
      statements: [
        s('follows', 'ded-some-follow', 'Some of the barristers in the chambers do not sit as part-time judges.', 'The tax specialists hold an accountancy qualification, and nobody with one sits as a judge. There is at least one tax specialist. Follows.', { kind: 'cat', k: 4, premises: tax, concl: O(0, 3) }),
        s('not', 'ded-some-all', 'None of the barristers in the chambers sits as a part-time judge.', 'Barristers without an accountancy qualification might sit as judges. Does not follow.', { kind: 'cat', k: 4, premises: tax, concl: E(0, 3) }),
        s('not', 'ded-conversion', 'Every barrister in the chambers with an accountancy qualification specialises in tax.', 'All tax specialists have the qualification, not the other way round. Does not follow.', { kind: 'cat', k: 4, premises: tax, concl: A(2, 1) }),
        s('follows', 'ded-some-follow', 'Some of the barristers in the chambers hold an accountancy qualification.', 'There is at least one tax specialist, and every tax specialist holds the qualification. Follows.', { kind: 'cat', k: 4, premises: tax, concl: I(0, 2) })
      ] },
    { id: 'resits',
      passage: 'Only students who pass all of their first-year exams can progress directly to the second year. Any student who misses more than three exams must resit the whole year. Tom missed four exams. Therefore:',
      statements: [
        s('follows', 'ded-chain', 'Tom must resit the whole year.', 'Four is more than three, so the rule applies to Tom. Follows.'),
        s('not', 'prop-onlyif', 'Every student who passes all of their first-year exams progresses directly to the second year.', '"Only students who pass can progress" makes passing a must-have, not a guarantee. Does not follow.'),
        s('not', 'prop-da', 'Students who miss two exams do not have to resit the year.', 'The rule only covers students who miss more than three. It says nothing either way about those who miss fewer. Does not follow.'),
        s('not', 'ded-nolink', 'Tom failed at least one first-year exam.', 'Missing an exam is not the same as failing one, and the statements do not link the two. Does not follow.')
      ] }
  ];

  /* ------------------------------------------------------------------ */
  B.TEST_INTERPRETATION = [
    { id: 'lessons',
      passage: 'A study followed 1,200 people who passed their driving test in 2015. Those who had taken more than 40 hours of lessons were involved, on average, in 30 percent fewer collisions over the next five years than those who had taken fewer than 20 hours. The researchers noted that the people who had taken more lessons were, on average, older when they passed.',
      statements: [
        s('follows', 'int-flip', 'In the study, people who took fewer than 20 hours of lessons were involved in more collisions on average than those who took more than 40 hours.', 'This is the same finding from the other side. Follows.'),
        s('follows', 'int-exists', 'Some people in the study had taken more than 40 hours of lessons.', 'The study compares that group with another, so the group must contain people. Follows.'),
        s('not', 'int-corr', 'Taking more driving lessons reduces a driver\'s risk of a collision.', 'The passage itself points out that the people with more lessons were also older. Age, not lessons, could explain the difference. A link is not proof of a cause. Does not follow.'),
        s('not', 'int-scope', 'Older drivers are safer than younger drivers.', 'The study did not compare drivers by age; it only noted an age difference between the two lesson groups. Does not follow.'),
        s('not', 'int-gap', 'Everyone in the study took either more than 40 hours or fewer than 20 hours of lessons.', 'The passage only compares those two groups. People who took 20 to 40 hours could also have been in the study. Does not follow.')
      ] },
    { id: 'triage',
      passage: 'At a city\'s three hospitals, the average wait in A&E fell from 4 hours to 3 hours after a new triage system was introduced in January. Over the same period, the number of A&E patients fell by 10 percent because a new walk-in clinic opened in the city.',
      statements: [
        s('follows', 'int-pct', 'The average A&E wait at the city\'s hospitals fell by a quarter.', 'From 4 hours to 3 hours is a fall of 1 hour, and 1 ÷ 4 = a quarter. Follows.'),
        s('follows', 'int-restate', 'Fewer patients attended A&E at the city\'s hospitals after the walk-in clinic opened.', 'The passage says the number of A&E patients fell by 10 percent because of the clinic. Follows.'),
        s('not', 'int-cause', 'The new triage system was the only reason waiting times fell.', 'Patient numbers also fell over the same period, which could have shortened waits. Does not follow.'),
        s('not', 'int-average', 'Waiting times fell at every one of the three hospitals.', 'The passage gives an average across all three. One hospital could have got worse while the others improved a lot. Does not follow.'),
        s('not', 'int-gap', 'The walk-in clinic treats patients more quickly than A&E does.', 'Nothing is said about how quickly the clinic treats people. Does not follow.')
      ] },
    { id: 'smallclaims',
      passage: 'Records from a county court show that, of 600 small claims heard last year, claimants represented by a lawyer won 70 percent of their cases, while claimants who represented themselves won 55 percent. Two-thirds of the claimants represented themselves.',
      statements: [
        s('follows', 'int-restate', 'Most claimants in last year\'s small claims did not have a lawyer.', 'Two-thirds represented themselves, which is more than half. Follows.'),
        s('follows', 'int-pct', 'Claimants won more than half of the 600 claims.', 'One-third of 600 = 200 claimants had a lawyer; 70% of 200 = 140 wins. Two-thirds = 400 represented themselves; 55% of 400 = 220 wins. 140 + 220 = 360, which is 60% of 600. Follows.'),
        s('follows', 'int-num', 'More of last year\'s winning claimants represented themselves than had a lawyer.', 'From the sums above: 220 winners represented themselves and 140 had a lawyer. A higher win rate does not mean more winners when the group is smaller. Follows.'),
        s('not', 'int-corr', 'Hiring a lawyer increases a claimant\'s chances of winning a small claim.', 'Claimants with stronger cases may be more likely to hire a lawyer. A difference in win rates does not prove the lawyer caused it. Does not follow.'),
        s('not', 'int-pct', 'Claimants who represented themselves lost most of their cases.', 'They won 55 percent, so they lost 45 percent. Does not follow.')
      ] },
    { id: 'cycling',
      passage: 'Over the past decade, the number of people cycling to work in Brenton has doubled, while the number of cyclists killed or seriously injured on the city\'s roads each year has stayed roughly the same.',
      statements: [
        s('follows', 'int-restate', 'More people cycle to work in Brenton than did ten years ago.', 'The number has doubled. Follows.'),
        s('not', 'int-gap', 'Each cyclist in Brenton is now less likely to be killed or seriously injured than ten years ago.', 'The injury figure covers all cyclists, but the doubling is only for people cycling to work. Without knowing how many people cycle overall, you cannot work out the risk per cyclist. Does not follow, even though it sounds likely.'),
        s('not', 'int-predict', 'The number of people cycling to work in Brenton will double again over the next decade.', 'The past does not guarantee the future. Does not follow.'),
        s('not', 'int-cause', 'Brenton\'s roads have become more dangerous for cyclists.', 'Casualties stayed the same while commuter cycling doubled, so nothing suggests the roads became more dangerous. Does not follow.')
      ] },
    { id: 'homeworking',
      passage: 'A survey of 500 employees at a bank found that 60 percent of those who worked from home at least two days a week said they were satisfied with their job, compared with 45 percent of those who worked in the office every day. Employees chose for themselves whether to work from home.',
      statements: [
        s('follows', 'int-restate', 'In the survey, a higher proportion of home workers than daily office workers said they were satisfied with their job.', '60 percent against 45 percent. Follows.'),
        s('not', 'int-corr', 'Working from home makes bank employees more satisfied with their jobs.', 'Employees chose for themselves, so people who were already happier, or had more senior jobs, may have been the ones who chose home working. A link is not proof of a cause. Does not follow.'),
        s('not', 'int-gap', 'Most of the employees surveyed said they were satisfied with their job.', 'You are not told how many employees were in each group, or about those who worked from home one day a week. The overall figure cannot be worked out. Does not follow.'),
        s('not', 'int-gap', 'Some of the employees who worked in the office every day said they were not satisfied with their job.', '45 percent said they were satisfied, so 55 percent did not say so. But not saying you are satisfied is not the same as saying you are dissatisfied: they might have said they were neutral. Does not follow. The real test rewards this level of care.')
      ] }
  ];

  /* ------------------------------------------------------------------ */
  const g = (side, a, p, text, why) => ({ side, a, p, text, why });
  B.TEST_ARGUMENTS = [
    { id: 'prisoners', q: 'Should all prisoners be offered the chance to study for a university degree while serving their sentence?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'education in prison reduces reoffending, which protects the public and saves money.', 'Treat it as true. Less reoffending is a major benefit and bears directly on whether to offer degrees. Strong.'),
        g('No', 'strong', 'arg-strong', 'many law-abiding people cannot afford a degree, so funding prisoners\' degrees from public money would be unfair.', 'Fairness in the use of public money is an important consideration, directly about this policy. Strong, even though there are strong arguments for "Yes" too.'),
        g('Yes', 'weak', 'arg-irrelevant', 'many prisons are overcrowded.', 'Overcrowding is a serious problem, but offering degrees does not address it. Not directly related, so weak.'),
        g('No', 'weak', 'arg-irrelevant', 'some prisoners would have no interest in studying.', 'The question is about offering the chance. Prisoners who are not interested can simply decline, so this does not bear on whether to offer it. Weak.'),
        g('Yes', 'weak', 'arg-trivial', 'studying would give prisoners something to do in the evenings.', 'Related, but minor next to the real issues. Not important enough to be strong. Weak.')
      ] },
    { id: 'motorway', q: 'Should the speed limit on UK motorways be lowered from 70 mph to 60 mph?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'it would reduce fuel consumption and harmful emissions from motorway traffic.', 'An important environmental benefit, directly caused by the change. Strong.'),
        g('No', 'strong', 'arg-strong', 'journeys would take longer, costing businesses and the economy a significant amount of time and money.', 'An important cost, directly caused by the change. Strong.'),
        g('Yes', 'weak', 'arg-mismatch', 'many drivers already break the 70 mph limit.', 'This is about drivers ignoring the current limit. Lowering the limit would not fix that, and it is not a reason to lower it. Weak.'),
        g('No', 'weak', 'arg-trivial', 'all the speed limit signs on motorways would have to be replaced.', 'A one-off practical task, minor compared with safety, cost and the environment. Weak.'),
        g('Yes', 'weak', 'arg-irrelevant', 'some other countries have lower motorway speed limits.', 'What other countries do is not, on its own, a reason why the change would be good here. Weak.')
      ] },
    { id: 'carers', q: 'Should employers be required to give staff paid leave to care for seriously ill relatives?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'it would allow carers to stay in work instead of having to give up their jobs.', 'Keeping carers in work is an important benefit, directly linked to the policy. Strong.'),
        g('No', 'strong', 'arg-strong', 'small employers may be unable to cover the cost and could be forced to cut jobs.', 'Job losses are an important consequence, directly linked to the policy. Strong.'),
        g('Yes', 'weak', 'arg-irrelevant', 'everyone becomes ill at some point in their life.', 'True, but it says nothing about whether employers should have to provide paid carer\'s leave. Weak.'),
        g('Yes', 'weak', 'arg-circular', 'carers deserve our gratitude.', 'An emotional appeal rather than a reason about the effects of the policy. Weak.')
      ] },
    { id: 'fees', q: 'Should universities be allowed to charge higher fees for courses that usually lead to well-paid jobs?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'graduates of those courses would be better able to repay higher fees.', 'Ability to repay is important and directly connects the higher fee to the higher pay. Strong.'),
        g('No', 'strong', 'arg-strong', 'higher fees could deter students from poorer backgrounds from entering well-paid professions.', 'Reduced access to those professions is an important, direct consequence. Strong.'),
        g('Yes', 'weak', 'arg-irrelevant', 'some courses cost more to teach than others.', 'This might justify charging by teaching cost, but the question is about charging by graduates\' future pay. It does not support that. Weak.'),
        g('No', 'weak', 'arg-trivial', 'universities would need to update their fee tables.', 'A minor administrative point. Weak.')
      ] },
    { id: 'olderdrivers', q: 'Should drivers aged over 75 have to retake their driving test every three years?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'it would identify drivers whose eyesight or reactions have declined to a dangerous level, reducing collisions.', 'Road safety is important and directly addressed by testing. Strong.'),
        g('No', 'strong', 'arg-strong', 'many older people rely on driving to stay independent, and safe drivers could lose that independence if they failed a test on a bad day.', 'Loss of independence for safe drivers is an important, direct consequence. Strong.'),
        g('Yes', 'weak', 'arg-mismatch', 'young drivers are involved in more collisions than older drivers.', 'If anything this points away from targeting older drivers. It does not support "Yes". Weak.'),
        g('Yes', 'weak', 'arg-mismatch', 'older people have many more years of driving experience.', 'Experience is a reason older drivers might be safe, which supports "No", not "Yes". Weak.')
      ] },
    { id: 'fireworks', q: 'Should the sale of fireworks to the public be banned?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'fireworks used at home cause serious injuries every year, including to children.', 'Serious injuries are important and directly linked to public sales. Strong.'),
        g('Yes', 'strong', 'arg-strong', 'the noise causes serious distress to many animals and to some people, such as those with post-traumatic stress.', 'Widespread distress is an important harm directly caused by fireworks. Strong. Note that both strong arguments here are on the same side; that is allowed.'),
        g('No', 'weak', 'arg-tradition', 'fireworks have been part of celebrations for hundreds of years.', 'Tradition alone does not show that public sales are a good idea. Weak.'),
        g('Yes', 'weak', 'arg-irrelevant', 'most fireworks are made abroad.', 'Where fireworks are made has nothing to do with whether the public should be able to buy them. Weak.')
      ] },
    { id: 'buses', q: 'Should the government fund free bus travel for everyone under 22?',
      args: [
        g('Yes', 'strong', 'arg-strong', 'it would make it easier for young people to reach school, college, training and work, especially in poorer areas.', 'Better access to education and work is an important, direct benefit. Strong.'),
        g('No', 'strong', 'arg-strong', 'the cost would be large and would have to be met by cutting other services or raising taxes.', 'The cost and its consequences are important and directly linked. Strong.'),
        g('No', 'weak', 'arg-irrelevant', 'some young people prefer to cycle.', 'Those who prefer to cycle can carry on doing so. This does not bear on whether free bus travel should be offered. Weak.'),
        g('No', 'weak', 'arg-trivial', 'drivers would have to check more passes.', 'A minor practical point. Weak.')
      ] }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
