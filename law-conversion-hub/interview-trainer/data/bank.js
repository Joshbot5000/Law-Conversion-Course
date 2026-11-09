/*
 * bank.js: the question bank.
 *
 * Questions are grouped by competency ("sub"). Each competency carries the
 * marking guidance shared by its questions:
 *   look   - what assessors credit
 *   traps  - what loses marks
 *   probes - follow-ups an interviewer uses to dig deeper (also used when the
 *            app runs without AI)
 *   shape  - the answer structure a strong candidate uses
 * {firm} is replaced with the firm you are practising for. {topic} is filled
 * in from your own answer when a probe refers back to it.
 *
 * Sources: question themes reported by candidates and careers services for
 * UK training contract and vacation scheme interviews (TargetJobs, AllAboutLaw,
 * Chambers Student, LawCareers.Net, Prospects, TCLA, Legal Cheek, Glassdoor
 * reviews of Baker McKenzie and Mishcon de Reya), and firms' own descriptions
 * of their assessment stages. Wording is our own.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};

  /* Marking criteria per category. Each answer thread is scored 1-5 on these. */
  IT.RUBRICS = {
    motivation: ['Relevance', 'Genuine motivation', 'Evidence from your own experience', 'Insight into the job', 'Structure', 'Delivery'],
    firm: ['Relevance', 'Firm-specific research', 'Differentiation from competitors', 'Link to your own goals', 'Structure', 'Delivery'],
    competency: ['Relevance', 'Structure', 'Specific evidence', 'Personal ownership', 'Result and reflection', 'Delivery'],
    strengths: ['Relevance', 'Self-awareness', 'Specific evidence', 'Relevance to the role', 'Structure', 'Delivery'],
    commercial: ['Relevance', 'Accuracy', 'Depth of analysis', 'Client impact', 'Law firm and business development insight', 'Delivery'],
    ethics: ['Identifies the real issue', 'Judgement and integrity', 'Professional duties', 'Practical next steps', 'Structure', 'Delivery'],
    case: ['Issue spotting', 'Commercial reasoning', 'Legal and risk awareness', 'Practical recommendation', 'Structure', 'Delivery'],
    curveball: ['Relevance', 'Composure', 'Clarity of reasoning', 'Originality', 'Structure', 'Delivery'],
    conversion: ['Accuracy of law', 'Clarity of explanation', 'Commercial application', 'Structure', 'Delivery'],
    closing: ['Quality of questions', 'Research behind them', 'Genuine interest', 'Delivery']
  };

  /* Rubric descriptors the AI grader and the self-check use. */
  IT.SCALE = [
    { n: 1, label: 'Poor', text: 'Does not answer the question, or shows a red flag. Would not progress.' },
    { n: 2, label: 'Weak', text: 'Generic or vague. Claims qualities without evidence. Below the bar.' },
    { n: 3, label: 'Competent', text: 'Answers the question with a real example and some structure. Borderline at a competitive firm.' },
    { n: 4, label: 'Strong', text: 'Specific, structured, owned and reflective. Would progress at most City firms.' },
    { n: 5, label: 'Exceptional', text: 'Memorable, insightful and polished. Top few per cent of candidates.' }
  ];

  IT.CATS = {
    motivation: { label: 'Motivation', blurb: 'Why law, why a solicitor, why commercial work, why now.' },
    firm: { label: 'Why this firm', blurb: 'Firm knowledge, differentiation and fit.' },
    competency: { label: 'Competency', blurb: '"Tell me about a time..." questions scored on evidence.' },
    strengths: { label: 'Strengths', blurb: 'What energises you, what you do well, what you avoid.' },
    commercial: { label: 'Commercial awareness', blurb: 'News, clients, the legal market and business development.' },
    ethics: { label: 'Ethics and judgement', blurb: 'Integrity dilemmas and professional conduct.' },
    case: { label: 'Case study', blurb: 'Client scenarios, deals and estimation under pressure.' },
    curveball: { label: 'Curveballs', blurb: 'Unexpected questions that test composure.' },
    conversion: { label: 'Law and the PGDL', blurb: 'Your legal knowledge and your conversion journey.' },
    closing: { label: 'Your questions', blurb: 'The questions you ask at the end.' }
  };

  const SUBS = {
    /* ---------------- motivation ---------------- */
    'why-law': {
      cat: 'motivation', label: 'Why law',
      look: ['A specific trigger or experience, not "I have always wanted to"', 'Understanding of what solicitors actually do day to day', 'Evidence you tested the interest (work experience, events, reading, the PGDL itself)', 'Skills you enjoy using that the job demands'],
      traps: ['Money, prestige or TV dramas as the reason', 'Generic lines that any applicant could say', 'Describing a barrister\'s job by mistake', 'No evidence of having tested the career'],
      probes: ['What exactly happened that made you decide on law rather than something else?', 'What do you think a trainee actually spends most of their day doing?', 'What have you done to test that this is right for you?', 'What part of legal work do you think you would find hardest?', 'Many people say that. What makes your reason different?'],
      shape: 'Trigger -> how you tested it -> what you learned about the work -> why it fits your strengths.',
      qs: ['Why do you want to be a lawyer?', 'Why law?', 'When did you first decide you wanted a career in law, and why?', 'What do you think makes a good lawyer?', 'What has surprised you most about the law since you started studying it?', 'Why do you think you would make a good solicitor?', 'What do you understand the day-to-day role of a trainee solicitor to be?', 'What would you do if you could not become a lawyer?']
    },
    'why-solicitor': {
      cat: 'motivation', label: 'Solicitor, not barrister',
      look: ['Clear distinction: long-term client relationships, teamwork, transactions, project management', 'Personal reason linked to how you like to work', 'No disrespect to the Bar'],
      traps: ['Saying the Bar was too hard to get into', 'Not knowing the difference', 'Dismissive of advocacy'],
      probes: ['Did you ever consider the Bar? What put you off?', 'What does a solicitor do that a barrister does not?', 'Give me an example of when you worked in the way a solicitor works.'],
      shape: 'What differs -> which suits you -> evidence from your own experience.',
      qs: ['Why do you want to be a solicitor rather than a barrister?', 'What is the difference between a solicitor and a barrister, and which suits you better?', 'Would you ever consider becoming a solicitor-advocate?']
    },
    'why-commercial': {
      cat: 'motivation', label: 'Why commercial law',
      look: ['Interest in business, deals and how companies work', 'An example of commercial curiosity in action', 'Understanding that lawyers serve business goals, not just legal points'],
      traps: ['"It is intellectually challenging" with nothing else', 'No sense of what clients want', 'Confusing commercial law with crime or family work'],
      probes: ['What is a deal or business story that genuinely interested you, and why?', 'What do you think a commercial client wants from its lawyers?', 'Why not go into banking or consulting instead?', 'Which practice area appeals most, and why?'],
      shape: 'Interest in business -> evidence -> what commercial lawyers add -> why that suits you.',
      qs: ['Why commercial law?', 'Why do you want to work in a commercial law firm rather than a high street firm?', 'Why not investment banking or management consulting?', 'Which area of commercial law interests you most, and why?', 'What do you think clients value most in their lawyers?', 'What is the difference between being a lawyer and being a business adviser?']
    },
    'about-you': {
      cat: 'motivation', label: 'About you',
      look: ['A 60-90 second narrative with a thread that leads to this interview', 'Two or three highlights with evidence', 'Ends with why you are here today'],
      traps: ['Reciting your CV chronologically', 'Rambling past two minutes', 'Personal details irrelevant to the role'],
      probes: ['Which of those experiences taught you the most, and what was it?', 'You mentioned {topic}. Tell me more about your role in that.', 'What would your last manager say is your biggest area for improvement?'],
      shape: 'Present -> relevant past -> why this firm and this role next.',
      qs: ['Tell me about yourself.', 'Walk me through your CV.', 'What is the achievement you are most proud of?', 'What do you do outside work or study?', 'How would your friends describe you?', 'What is the most important thing we should know about you that is not on your application?', 'Which experience on your CV best prepares you to be a trainee here?']
    },
    'career-change': {
      cat: 'conversion', label: 'Your conversion journey',
      look: ['A positive pull towards law, not just a push from the previous path', 'Transferable skills with evidence', 'How your first degree or career is an advantage to clients'],
      traps: ['Sounding as if law is a fallback', 'Apologising for not doing a law degree', 'Unable to explain what you gained from the switch'],
      probes: ['What does your first degree give you that a law graduate does not have?', 'Why did you not choose law from the start?', 'How have you found the step up in workload on the conversion course?', 'What module has been hardest, and how did you deal with it?'],
      shape: 'Why the change -> what you bring -> how you have proved commitment since.',
      qs: ['You did not study law first. Why the change?', 'What does your non-law background bring to a law firm?', 'Why the PGDL, and how are you finding it?', 'Which module on your conversion course have you enjoyed most, and why?', 'Which module have you found hardest, and what did you do about it?', 'How would you explain a legal concept you have learned recently to a client with no legal knowledge?']
    },
    'ambition': {
      cat: 'motivation', label: 'Ambition and goals',
      look: ['Realistic, firm-relevant ambitions', 'Commitment to the firm long term', 'Growth mindset'],
      traps: ['"Partner in five years"', 'Plans to leave for another sector', 'No idea'],
      probes: ['What would you need to learn to get there?', 'What would make you leave a firm?', 'How would you measure success at the end of your training contract?'],
      shape: 'Short term (learn, seats) -> medium term (specialism, clients) -> link to the firm.',
      qs: ['Where do you see yourself in five years?', 'What would you like to have achieved by the end of your training contract?', 'What does success look like to you?', 'Which seats would you like to do, and why?']
    },

    /* ---------------- firm ---------------- */
    'why-firm': {
      cat: 'firm', label: 'Why this firm',
      look: ['Two or three reasons specific to {firm}, not true of every rival', 'Evidence of real contact: events, people, open days, vacation scheme, deals you followed', 'Link each reason to your own goals or experience'],
      traps: ['Reasons that apply to any City firm ("international", "prestigious", "great training")', 'Reciting the website', 'Flattery with no substance', 'Getting a fact about the firm wrong'],
      probes: ['Every firm says that. What is unique to {firm}?', 'Who have you spoken to at {firm}, and what did you learn?', 'If you had offers from {firm} and a direct competitor, why would you choose us?', 'Tell me about a recent deal or case of ours that interested you.', 'What do you think is the biggest challenge {firm} faces right now?'],
      shape: 'Reason 1 (unique to the firm) + evidence -> Reason 2 + evidence -> why it matters to you.',
      qs: ['Why do you want to work at {firm}?', 'Why {firm} and not one of our competitors?', 'What do you know about {firm}?', 'What three words would you use to describe {firm}, and why?', 'If you could work in any practice area at {firm}, which would it be and why?', 'What attracted you to apply to {firm}?', 'Tell me about a recent deal or case that {firm} worked on.', 'What do you think the culture is like at {firm}, and what is your evidence?', 'Which other firms have you applied to, and why?']
    },
    'differentiation': {
      cat: 'firm', label: 'Competitors and strategy',
      look: ['Names realistic competitors', 'Understands the firm\'s strategy and market position', 'Balanced view of strengths and weaknesses'],
      traps: ['Cannot name competitors', 'Rude about other firms', 'Only praises the firm'],
      probes: ['Who would you say our closest competitors are, and where do they beat us?', 'What would you change about our strategy?', 'How would a client choose between us and them?'],
      shape: 'Market position -> competitors -> what sets the firm apart -> risk or challenge.',
      qs: ['Who do you think are {firm}\'s main competitors?', 'What sets {firm} apart from its competitors?', 'What is {firm}\'s biggest weakness, in your view?', 'If you were managing partner of {firm}, what would you change?', 'How do you think {firm} should grow over the next five years?', 'What threats does {firm} face in the next few years?', 'How do US firms in London affect a firm like {firm}?']
    },
    'culture-fit': {
      cat: 'firm', label: 'Fit and values',
      look: ['Knows the firm\'s stated values and can match them to evidence about yourself', 'Honest about what kind of environment suits you'],
      traps: ['Listing values without evidence', 'Contradicting your earlier answers'],
      probes: ['Which of our values do you most identify with, and when have you shown it?', 'What would your ideal working environment look like?', 'What kind of person would struggle here?'],
      shape: 'Value -> evidence you share it -> why it matters to clients.',
      qs: ['Which of {firm}\'s values resonates with you most, and why?', 'What kind of working environment brings out your best?', 'How would you contribute to the culture at {firm}?', 'What does diversity and inclusion mean to you in a law firm?']
    },

    /* ---------------- competency ---------------- */
    'teamwork': {
      cat: 'competency', label: 'Teamwork',
      look: ['A real team with a shared goal', 'Your specific contribution, not the team\'s', 'How you handled friction or different working styles', 'A measurable outcome and what you learned'],
      traps: ['Using "we" throughout', 'A trivial example', 'No result', 'Blaming others'],
      probes: ['What did you personally do, as opposed to the team?', 'Was there any disagreement in the team? How did you handle it?', 'How did you measure whether the team succeeded?', 'What would you do differently next time?', 'What did the team member you worked least well with think of you?'],
      shape: 'STAR: Situation (brief) -> Task -> Action (most of the answer, "I") -> Result (numbers) -> Reflection.',
      qs: ['Tell me about a time you worked successfully in a team.', 'Describe a time when a team you were in was not working well. What did you do?', 'Tell me about a time a team member was not pulling their weight.', 'Give an example of when you had to work with someone very different from you.', 'What role do you usually take in a team, and why?', 'Tell me about a time you had to rely on others to get something done.', 'Describe a time you put the team\'s interests ahead of your own.']
    },
    'leadership': {
      cat: 'competency', label: 'Leadership',
      look: ['Leading people, not just being in charge of a task', 'How you motivated, delegated or set direction', 'Handling a challenge as a leader', 'Result and reflection'],
      traps: ['Only a job title as evidence', 'Doing everything yourself', 'No difficulty overcome'],
      probes: ['How did you get people to follow you?', 'What was the hardest decision you made as the leader?', 'How did you handle someone who disagreed with your direction?', 'What would the people you led say about your leadership?'],
      shape: 'STAR, with the Action showing direction, delegation and motivation.',
      qs: ['Tell me about a time you led a team.', 'Describe a time you motivated others to achieve something difficult.', 'Tell me about a time you took the lead when no one else would.', 'Give an example of when you had to delegate.', 'Describe a decision you made as a leader that was unpopular.']
    },
    'integrity': {
      cat: 'competency', label: 'Integrity',
      look: ['A real dilemma where doing the right thing had a cost', 'Clear reasoning about why it was right', 'How you acted despite pressure', 'Link to the trust clients and regulators place in solicitors (SRA Principles)'],
      traps: ['A dilemma with no cost to you ("I returned a wallet")', 'Bending the rules and calling it pragmatism', 'Moralising without action', 'An example that reveals poor judgement'],
      probes: ['What did doing the right thing cost you?', 'Did anyone pressure you to act differently? How did you respond?', 'How would you handle the same situation as a trainee solicitor?', 'Which of the SRA Principles does that example connect to?', 'Looking back, is there anything you would do differently?'],
      shape: 'The dilemma and the pressure -> your reasoning -> what you did -> consequence -> why integrity matters to a law firm.',
      qs: ['Tell me about a time your integrity was challenged.', 'Tell me about a time your integrity was challenged, and how you turned that setback into an advantage.', 'Describe a time you had to do the right thing even though it was unpopular.', 'Tell me about a time you noticed someone acting unethically. What did you do?', 'Describe a time you admitted a mistake when you could have hidden it.', 'Tell me about a time you were asked to cut a corner.']
    },
    'resilience': {
      cat: 'competency', label: 'Resilience and setbacks',
      look: ['A genuine setback, not a humblebrag', 'How you responded practically and emotionally', 'What you changed as a result', 'Evidence the change worked'],
      traps: ['A setback that was not really yours', 'Blaming others', 'No learning', 'Dwelling on the negative'],
      probes: ['How did you feel at the time, and how did you manage that?', 'What specifically did you change afterwards?', 'How do you know the change worked?', 'How did you turn it into an advantage?', 'What would you do if the same thing happened in your first seat?'],
      shape: 'Setback -> immediate response -> what you learned -> what you changed -> later success.',
      qs: ['Tell me about a setback you have faced and how you dealt with it.', 'Describe a time you used a setback to build towards something better.', 'Tell me about a time you received bad news. How did you respond?', 'Describe a time you had to keep going despite repeated obstacles.', 'Tell me about a goal you did not achieve.', 'How do you deal with rejection?']
    },
    'failure': {
      cat: 'competency', label: 'Failure and mistakes',
      look: ['A genuine failure you own', 'Honest analysis of why it happened', 'Concrete change in behaviour', 'Maturity'],
      traps: ['A disguised strength', 'A failure with catastrophic judgement', 'Blaming circumstances'],
      probes: ['Why did it really go wrong?', 'What was your own part in it?', 'What do you do differently now?', 'Has the same thing ever happened again?'],
      shape: 'The failure -> your part in it -> the lesson -> the change -> proof.',
      qs: ['Tell me about a time you failed.', 'Describe the biggest mistake you have made and what you learned.', 'Tell me about a time you missed a deadline.', 'Describe a project that did not go to plan. What was your role in that?']
    },
    'conflict': {
      cat: 'competency', label: 'Conflict and difficult people',
      look: ['Understanding the other person\'s position', 'Calm, constructive steps', 'Resolution that preserved the relationship', 'What you learned about handling people'],
      traps: ['Portraying the other person as the villain', 'Escalating straight to a manager', 'Avoiding the conflict entirely'],
      probes: ['What do you think the other person would say about the situation?', 'What did you do to understand their point of view?', 'Is the relationship good now?', 'What would you have done if they had refused to compromise?'],
      shape: 'The disagreement -> their perspective -> your approach -> resolution -> lesson.',
      qs: ['Tell me about a time you disagreed with someone senior.', 'Describe a time you had to deal with a difficult person.', 'Tell me about a conflict in a team and how you resolved it.', 'Describe a time you had to give someone difficult feedback.', 'Tell me about a time you had to manage an unhappy customer or client.']
    },
    'persuasion': {
      cat: 'competency', label: 'Persuasion and negotiation',
      look: ['Tailoring the argument to the audience', 'Evidence and reasoning used', 'Listening and adapting', 'Outcome'],
      traps: ['Winning by force of personality', 'No sense of the other side\'s interests'],
      probes: ['Why did they resist at first?', 'What changed their mind?', 'What would you have done if they still said no?', 'What did you concede?'],
      shape: 'Goal -> their interests -> your approach -> outcome -> lesson.',
      qs: ['Tell me about a time you persuaded someone to change their mind.', 'Describe a negotiation you were involved in.', 'Tell me about a time you influenced a decision without having authority.', 'Describe a time you had to win someone over who was sceptical.']
    },
    'detail': {
      cat: 'competency', label: 'Attention to detail',
      look: ['A task where accuracy mattered', 'Your checking system', 'An error you caught and the consequence avoided'],
      traps: ['"I am a perfectionist"', 'No method, only a claim'],
      probes: ['How do you check your work?', 'Tell me about a time you missed a detail. What happened?', 'How do you balance accuracy and speed?'],
      shape: 'Task -> why accuracy mattered -> method -> what you caught -> result.',
      qs: ['Tell me about a time your attention to detail made a difference.', 'Describe a time you spotted an error others had missed.', 'How do you make sure your work is accurate under time pressure?', 'Tell me about a time you made a mistake because you missed a detail.']
    },
    'pressure': {
      cat: 'competency', label: 'Pressure and time management',
      look: ['Genuinely competing deadlines', 'How you prioritised and communicated', 'Staying calm', 'Delivering'],
      traps: ['"I work well under pressure" without evidence', 'Pulling all-nighters as the solution', 'Not telling anyone about the problem'],
      probes: ['How did you decide what came first?', 'Did you tell anyone you were stretched? Why or why not?', 'What would you do if two partners gave you urgent work at the same time?', 'What did you drop or delay?'],
      shape: 'Competing demands -> prioritisation -> communication -> delivery -> lesson.',
      qs: ['Tell me about a time you had to manage several competing deadlines.', 'Describe a time you worked under intense pressure.', 'How do you prioritise when everything is urgent?', 'Tell me about a time you had to deliver something with very little notice.', 'Two partners give you urgent tasks due at the same time. What do you do?']
    },
    'initiative': {
      cat: 'competency', label: 'Initiative',
      look: ['Something you started without being asked', 'Why you saw the need', 'Obstacles overcome', 'Measurable impact'],
      traps: ['Doing your normal job and calling it initiative', 'No impact'],
      probes: ['Why did no one else do it?', 'What obstacles did you face?', 'How did you measure its impact?', 'Is it still running now?'],
      shape: 'Need spotted -> action -> obstacles -> impact.',
      qs: ['Tell me about a time you took the initiative.', 'Describe something you started from scratch.', 'Tell me about a time you improved a process.', 'Describe a time you went beyond what was expected of you.']
    },
    'client': {
      cat: 'competency', label: 'Client service',
      look: ['Understanding what the customer or client actually needed', 'Going beyond the request', 'Managing expectations', 'Outcome for the client'],
      traps: ['Treating client service as being polite', 'Promising what you cannot deliver'],
      probes: ['What did the client actually need, as opposed to what they asked for?', 'How did you manage their expectations?', 'How would that translate to a law firm client?'],
      shape: 'Client need -> your response -> extra value -> outcome.',
      qs: ['Tell me about a time you provided excellent customer or client service.', 'Describe a time you dealt with a demanding client or customer.', 'What does excellent client service mean to you?', 'Tell me about a time you had to say no to a client or customer.']
    },
    'adaptability': {
      cat: 'competency', label: 'Adaptability',
      look: ['A real change you did not control', 'How quickly you adjusted', 'What you learned'],
      traps: ['Resisting the change', 'A trivial change'],
      probes: ['What was hardest about the change?', 'What did you have to learn quickly?', 'How did you help others adapt?'],
      shape: 'Change -> response -> outcome -> lesson.',
      qs: ['Tell me about a time you had to adapt to a sudden change.', 'Describe a time you had to learn something new very quickly.', 'Tell me about a time your plans changed at the last minute.']
    },
    'feedback': {
      cat: 'competency', label: 'Feedback',
      look: ['Real critical feedback', 'Openness, not defensiveness', 'What you changed', 'Evidence of improvement'],
      traps: ['Feedback that is really praise', 'Getting defensive'],
      probes: ['How did you feel when you heard it?', 'Did you agree with it?', 'What did you change and how do you know it worked?'],
      shape: 'Feedback -> reaction -> change -> result.',
      qs: ['Tell me about the most useful feedback you have received.', 'Describe a time you received criticism. How did you respond?', 'Tell me about a time you asked for feedback.']
    },
    'communication': {
      cat: 'competency', label: 'Communication',
      look: ['Adapting the message to the audience', 'Clarity and simplicity', 'Checking understanding'],
      traps: ['Confusing talking a lot with communicating well'],
      probes: ['How did you know they had understood?', 'What did you change for that audience?', 'Explain something complicated to me now, in thirty seconds.'],
      shape: 'Audience -> challenge -> how you adapted -> result.',
      qs: ['Tell me about a time you had to explain something complex to a non-expert.', 'Describe a presentation you gave. How did you prepare?', 'Tell me about a time a miscommunication caused a problem.', 'Explain something you are interested in to me as if I knew nothing about it.']
    },
    'problem': {
      cat: 'competency', label: 'Problem solving',
      look: ['Breaking the problem down', 'Options considered', 'Reasoned choice', 'Result'],
      traps: ['Jumping to a solution', 'No alternatives considered'],
      probes: ['What other options did you consider?', 'Why did you choose that one?', 'What information did you not have, and how did you deal with that?'],
      shape: 'Problem -> analysis -> options -> decision -> result.',
      qs: ['Tell me about a complex problem you solved.', 'Describe a time you had to make a decision with incomplete information.', 'Tell me about a time you had to think on your feet.', 'Describe a time you found a creative solution to a problem.']
    },
    'innovation': {
      cat: 'competency', label: 'Innovation and technology',
      look: ['A practical use of technology or a new approach', 'Critical view of its limits', 'Results'],
      traps: ['Hype without understanding', 'Claiming AI will do everything'],
      probes: ['What were the limits of that tool?', 'How did you check its output?', 'How could a law firm use that idea?'],
      shape: 'Problem -> new approach -> limits managed -> result.',
      qs: ['Tell me about a time you used technology to solve a problem or improve a process.', 'How have you used AI tools in your studies or work, and how did you check the results?', 'Describe a time you challenged the way things had always been done.']
    },
    'inclusion': {
      cat: 'competency', label: 'Diversity and inclusion',
      look: ['Action, not just belief', 'Awareness of different perspectives', 'Impact'],
      traps: ['Platitudes', 'Tokenism'],
      probes: ['What did you actually do?', 'What did you learn about your own assumptions?', 'How would you contribute to inclusion at {firm}?'],
      shape: 'Situation -> action -> impact -> learning.',
      qs: ['Tell me about a time you helped make a group more inclusive.', 'Describe a time you worked with people from very different backgrounds.', 'Why does diversity matter to a law firm\'s clients?']
    },

    /* ---------------- strengths ---------------- */
    'strengths': {
      cat: 'strengths', label: 'Strengths',
      look: ['Genuine strengths with quick evidence', 'Relevant to trainee work', 'Energy and authenticity'],
      traps: ['Clichés ("hard-working", "perfectionist") with no proof', 'Strengths irrelevant to the job'],
      probes: ['When did you last use that strength?', 'What would someone who disagrees with that say?', 'How would that strength help you in your first seat?'],
      shape: 'Strength -> evidence -> relevance to the role.',
      qs: ['What are your three greatest strengths?', 'What do you do better than most people?', 'What would your last manager say is your greatest strength?', 'What tasks do you find come naturally to you?', 'What are you learning to do better at the moment?', 'What do you think you would bring to {firm} that other candidates would not?']
    },
    'weakness': {
      cat: 'strengths', label: 'Weaknesses',
      look: ['A real but manageable weakness', 'Self-awareness about its effect', 'Concrete steps to improve and evidence of progress'],
      traps: ['A disguised strength ("I care too much")', 'A weakness central to the job', 'No improvement plan'],
      probes: ['How has that weakness affected your work?', 'What are you doing about it?', 'What would your friends say your weakness is?'],
      shape: 'Weakness -> effect -> steps taken -> progress.',
      qs: ['What is your greatest weakness?', 'What would your last manager say you need to improve on?', 'What do you find most difficult about working with others?', 'Which part of a trainee\'s job do you think you would find hardest?']
    },
    'energy': {
      cat: 'strengths', label: 'What energises you',
      look: ['Honest, specific answers', 'Consistency with the job', 'Quick examples'],
      traps: ['Saying what you think they want to hear', 'Contradicting the reality of trainee work'],
      probes: ['When did you last feel like that?', 'What drains you, by contrast?', 'How would you stay motivated during repetitive tasks?'],
      shape: 'Honest answer -> example -> link to the role.',
      qs: ['What energises you?', 'When do you feel at your best?', 'What kind of tasks do you tend to leave until last?', 'Describe a perfect working day.', 'What motivates you?', 'How do you stay motivated doing repetitive work?', 'What did you enjoy most in your last job or degree, and why?']
    },

    /* ---------------- commercial ---------------- */
    'news': {
      cat: 'commercial', label: 'News story',
      look: ['A specific, recent story with accurate facts', 'Why it matters, beyond what happened', 'Who wins and who loses', 'The legal angle: which practice areas get work', 'A view of your own'],
      traps: ['Only summarising the headline', 'A story months old with no update', 'Factual errors', 'Politics without a business angle', 'No opinion'],
      probes: ['How is that likely to affect a client of {firm}?', 'What would that mean for {firm}\'s business development?', 'Which practice areas would be busiest because of it?', 'Who are the winners and losers?', 'What is the strongest argument against your view?', 'What happens next, in your opinion?'],
      shape: 'What happened (20 seconds) -> why it matters -> effect on clients -> legal work and firm impact -> your view.',
      qs: ['Tell me about a news story you have been following recently.', 'What commercial news story has interested you most in the last month?', 'Tell me about a recent deal that caught your attention.', 'What is a business story you have been following, and what is your view on it?', 'What is the most important news story for the legal sector right now?', 'Tell me about a recent development in the legal market.', 'What is a story from the last week that a client of {firm} would be worried about?', 'Tell me about a company you think is undervalued, and why.', 'What news story do you think is being under-reported, and why does it matter to business?']
    },
    'client-impact': {
      cat: 'commercial', label: 'Impact on clients',
      look: ['A named, realistic client type', 'Concrete commercial effects (costs, revenue, risk, regulation)', 'What the client would need from lawyers'],
      traps: ['Vague "it would affect clients"', 'Ignoring the client\'s sector'],
      probes: ['Name a type of client that would be hit hardest. Why?', 'What would that client ask its lawyers to do?', 'How would the client\'s board think about this risk?'],
      shape: 'Client type -> effect on the business -> what they need legally -> who at the firm helps.',
      qs: ['How might rising tariffs affect a client of {firm}?', 'How would a sharp fall in interest rates affect {firm}\'s clients?', 'How do you think AI regulation will affect technology clients?', 'What legal issues would a retailer face if it wanted to expand overseas?', 'How might new sanctions affect a client with operations in several countries?', 'What should a client do to prepare for a recession?']
    },
    'firm-impact': {
      cat: 'commercial', label: 'Impact on the firm',
      look: ['Revenue and demand by practice area', 'Countercyclical work (restructuring, disputes)', 'Business development opportunities', 'Risks to the firm'],
      traps: ['Only discussing the client, never the firm', 'Ignoring that firms are businesses'],
      probes: ['Which practice groups would win and which would suffer?', 'How should {firm} position itself to win that work?', 'How would you pitch to a client about it?', 'What does that mean for trainees?'],
      shape: 'Demand shift -> practice areas -> how the firm wins work -> risks.',
      qs: ['What would that mean for {firm}\'s business development?', 'How does an economic downturn affect a commercial law firm?', 'Which practice areas do you think will grow most over the next few years, and why?', 'How should {firm} win more work from a client it already advises?', 'If you were asked to write a client briefing on that story, what would it say?']
    },
    'legal-market': {
      cat: 'commercial', label: 'The legal market',
      look: ['Up-to-date knowledge of mergers, US firms, pricing pressure, salaries and technology', 'A view on what it means for the firm'],
      traps: ['Out-of-date facts', 'No opinion'],
      probes: ['What does that trend mean for {firm} specifically?', 'Is that trend good or bad for clients?', 'How would you respond if you ran a firm?'],
      shape: 'Trend -> causes -> impact on firms and clients -> your view.',
      qs: ['Why are so many UK and US law firms merging?', 'How are US firms changing the London legal market?', 'What do you think of the billable hour?', 'What are the biggest challenges facing law firms today?', 'Should law firms list on the stock market or take private equity investment?', 'Are rising newly qualified salaries good for the profession?', 'How do alternative legal service providers compete with traditional firms?']
    },
    'ai-tech': {
      cat: 'commercial', label: 'AI and legal technology',
      look: ['Specific uses (document review, due diligence, drafting, research)', 'Risks: hallucination, confidentiality, regulation, professional duty', 'Effect on training and business models', 'A balanced, informed view'],
      traps: ['"AI will replace lawyers" or "AI is irrelevant"', 'No awareness of risks', 'No examples'],
      probes: ['What are the risks of a trainee relying on AI output?', 'How should a firm bill for work AI does in minutes?', 'Which tasks should never be handed to AI, and why?', 'How do you think AI will change what trainees learn?', 'How would you use AI responsibly in your first seat?'],
      shape: 'Use cases -> risks -> business model impact -> your view on the trainee role.',
      qs: ['How is AI changing the legal profession?', 'Will AI replace trainee solicitors?', 'How should law firms use AI responsibly?', 'What legal risks does AI create for our clients?', 'How do you think AI will change the way law firms charge for their work?', 'Persuade me that AI is good for junior lawyers.']
    },
    'macro': {
      cat: 'commercial', label: 'Economy and markets',
      look: ['Correct economics (rates, inflation, growth, currency)', 'Clear chain from the economy to deals and disputes', 'Sector-specific consequences'],
      traps: ['Economic errors', 'No link to legal work'],
      probes: ['How does that affect M&A activity?', 'Which clients benefit and which suffer?', 'What would change your view?'],
      shape: 'Economic driver -> effect on businesses -> effect on legal work.',
      qs: ['How do interest rates affect the work of a commercial law firm?', 'Why does London want more companies to list on its stock exchange, and what is holding it back?', 'How is the energy transition creating work for lawyers?', 'What is private credit, and why are law firms interested in it?', 'How does geopolitical tension affect international businesses?', 'How has private equity changed the work of City law firms?', 'What is the outlook for the UK economy, and what does it mean for {firm}?']
    },
    'deals': {
      cat: 'commercial', label: 'Deals and transactions',
      look: ['Understanding of deal rationale', 'Legal workstreams (due diligence, regulatory approval, financing, employment, competition)', 'Risks'],
      traps: ['Only the price', 'No legal angle'],
      probes: ['Why did the buyer want that business?', 'What regulatory approvals would that deal need?', 'What could make the deal fall apart?', 'Which teams at a law firm would work on it?'],
      shape: 'Parties and rationale -> legal workstreams -> risks -> your view.',
      qs: ['Walk me through what happens in an M&A deal.', 'Tell me about a deal you have followed and why it happened.', 'What makes a merger fail?', 'Why might a company choose to sell a division?', 'What is due diligence and why does it matter?']
    },
    'sector': {
      cat: 'commercial', label: 'Sectors',
      look: ['Knowledge of a sector\'s drivers and regulation', 'Clients in that sector and their legal needs'],
      traps: ['Generic answers', 'No regulation awareness'],
      probes: ['Who are the main players in that sector?', 'What regulation affects them most?', 'Where will the next disputes in that sector come from?'],
      shape: 'Sector drivers -> challenges -> legal needs.',
      qs: ['Pick a sector. What are the biggest challenges it faces?', 'What legal issues does the technology sector face at the moment?', 'What challenges does the real estate sector face?', 'What are the main legal risks for a bank today?', 'What legal issues do sports clubs and media companies face?', 'How is the retail sector changing, and what does that mean for lawyers?']
    },
    'bd': {
      cat: 'commercial', label: 'Business development',
      look: ['Understanding that relationships win work', 'Practical ideas: content, events, cross-selling, sector teams', 'Commercial thinking'],
      traps: ['Thinking only partners do BD', 'Purely marketing answers'],
      probes: ['What could a trainee do to help win work?', 'How would you cross-sell to an existing client?', 'How should the firm measure whether BD is working?'],
      shape: 'Client need -> how the firm meets it -> how it wins and keeps the work.',
      qs: ['How do law firms win new clients?', 'What role can a trainee play in business development?', 'How would you build a relationship with a new client?', 'How would you pitch {firm} to a technology start-up?']
    },

    /* ---------------- ethics ---------------- */
    'ethics-dilemma': {
      cat: 'ethics', label: 'Ethical dilemmas',
      look: ['Spots the professional conduct issue (confidentiality, conflict, honesty, client interests)', 'Escalates to the right person', 'Does not cover up or act alone beyond their role', 'Practical steps in order'],
      traps: ['Covering up a mistake', 'Ignoring a conflict of interest', 'Going over everyone\'s head on day one', 'Freezing with no plan'],
      probes: ['Who would you tell first, and when?', 'What if the partner told you to ignore it?', 'What are your duties to the client here?', 'Which SRA Principle is engaged?', 'What if the client asked you to keep it quiet?'],
      shape: 'Identify the issue -> immediate step -> escalate -> protect the client and the firm -> learn.',
      qs: ['You realise you have sent a confidential document to the wrong person. What do you do?', 'A partner asks you to backdate a document. What do you do?', 'You notice an error in a document that has already gone to the client. What do you do?', 'A client offers you an expensive gift. How do you respond?', 'You overhear a colleague discussing a client\'s deal in a pub. What do you do?', 'A friend asks you about a deal your firm is working on. What do you say?', 'You discover the firm is acting for both sides of a dispute. What do you do?', 'Your supervisor asks you to bill time you did not work. What do you do?', 'A client tells you in confidence about a problem that you think the other side in a deal ought to know. What do you do?', 'You find a social media post by a colleague that reveals details of a client matter. What do you do?', 'A senior associate tells you to sign off a document you have not had time to check. What do you do?', 'You are offered a chance to invest in a company that your firm is advising on a deal. What do you do?', 'A client asks you to delete emails after they receive a letter warning of litigation. What do you do?', 'You realise a fellow trainee has been using a public AI tool to summarise confidential client documents. What do you do?', 'A client asks you to help them structure a transaction in a way that seems designed to mislead a regulator. What do you do?', 'You are running late on a deadline because of a mistake you made. What do you do?']
    },

    /* ---------------- case study ---------------- */
    'case-study': {
      cat: 'case', label: 'Client case study',
      look: ['Structured approach (clarify, issues, options, recommendation)', 'Commercial priorities of the client', 'Legal risks in plain English', 'A clear recommendation'],
      traps: ['Diving into detail with no structure', 'Sitting on the fence', 'Ignoring the client\'s commercial goal'],
      probes: ['What extra information would you ask the client for?', 'What is the single biggest risk?', 'What would you recommend, and why?', 'How would you explain that to the client\'s CEO in one minute?', 'What would the other side want?'],
      shape: 'Clarify the goal -> key issues (commercial and legal) -> options -> recommendation -> next steps.',
      qs: ['A UK clothing retailer wants to buy a competitor in Germany. What would you want to consider?', 'A technology start-up client is about to raise its first major funding round. What legal issues should it think about?', 'A client\'s main supplier has just gone into administration. What should the client do?', 'A client wants to use AI to screen job applicants. What risks would you flag?', 'A family-owned business wants to sell to a private equity buyer. What are the main issues?', 'A client has suffered a data breach affecting thousands of customers. What should it do in the first 48 hours?', 'A football club wants to bring in a foreign investor. What issues arise?', 'A client is considering moving its stock market listing from London to New York. What should it weigh up?', 'A property developer client\'s project is delayed and costs are rising. What options does it have?', 'An energy company wants to build a wind farm. What legal workstreams would be involved?', 'A listed company has received an unsolicited takeover approach. What should its board do first?', 'A client\'s factory in another country has been hit by new export controls. How would you help?', 'A celebrity client\'s private information has been published online. What can they do?', 'A start-up client says a former employee has taken its source code to a rival. What would you advise?', 'A client wants to cut costs by moving staff onto freelance contracts. What risks would you flag?']
    },
    'estimation': {
      cat: 'case', label: 'Estimation and reasoning',
      look: ['Clear assumptions stated aloud', 'Logical steps', 'Sense-checking the final number', 'Calm under pressure'],
      traps: ['Guessing a number with no reasoning', 'Refusing to try'],
      probes: ['Which assumption are you least sure about?', 'How would you check that number?', 'What would change if that assumption doubled?'],
      shape: 'Clarify -> break down -> assumptions -> calculate -> sense-check.',
      qs: ['How many coffees are sold in London each day?', 'How would you estimate the annual revenue of a law firm with 500 lawyers?', 'How many trainees do you think the top 50 UK law firms recruit each year, and how did you get there?', 'Estimate how many hours a trainee might bill in a year.']
    },

    /* ---------------- curveballs ---------------- */
    'curveball': {
      cat: 'curveball', label: 'Curveballs',
      look: ['Composure: pause, then answer', 'A clear position with a reason', 'Linking back to yourself or the job where natural', 'A little personality'],
      traps: ['Panic or long silence', 'Refusing to answer', 'Rambling without a point'],
      probes: ['Why that and not something else?', 'Convince me of the opposite view.', 'How does that relate to being a lawyer?'],
      shape: 'Pause -> position -> one or two reasons -> close.',
      qs: ['Sell me this pen.', 'If you could change one law, what would it be and why?', 'Who is a business leader you admire, and why?', 'What is the last book you read, and what did you take from it?', 'If you were a law firm, which would you be and why?', 'Convince me that remote working is bad for junior lawyers.', 'What is something you have changed your mind about?', 'What is the most difficult question you have been asked in an interview, and how would you answer it now?', 'Argue for a four-day working week at a law firm, then argue against it.', 'What would you do with a million pounds to improve access to justice?', 'If you had to start a business tomorrow, what would it be?', 'Which historical figure would make the best lawyer, and why?', 'Tell me something about yourself that would surprise me.', 'What is the best piece of advice you have ever been given?', 'Teach me something in sixty seconds.', 'What question are you hoping I will not ask you today?', 'If you were the interviewer, what would you ask yourself, and how would you answer?', 'What is the most overrated quality in a lawyer?', 'Give me three reasons not to hire you, then answer each one.', 'What would you do on your first day here if no one gave you any work?']
    },

    /* ---------------- law ---------------- */
    'law-knowledge': {
      cat: 'conversion', label: 'Legal knowledge',
      look: ['Accurate legal principles with a leading case where natural', 'Plain English explanation', 'Commercial relevance'],
      traps: ['Wrong law', 'Jargon without explanation', 'No link to clients'],
      probes: ['What is the leading case on that?', 'Why does that rule matter to a business?', 'Do you think that rule is fair? Why?', 'How would you explain that to a client?'],
      shape: 'Rule -> authority -> why it matters commercially -> your view.',
      qs: ['What is the most interesting case you have studied, and why?', 'Explain the doctrine of consideration to a client.', 'What makes a contract term unfair?', 'Explain the duty of care in negligence in plain English.', 'Why does the separate legal personality of a company matter to businesses?', 'What is an injunction, and when would a client want one?', 'What is the difference between a breach of contract and a misrepresentation?', 'What is a trust, and why would a wealthy client use one?', 'What is judicial review?', 'Which area of law you have studied do you think is most in need of reform?']
    },

    /* ---------------- closing ---------------- */
    'questions-for-us': {
      cat: 'closing', label: 'Questions for the interviewer',
      look: ['Two or three questions that show research and curiosity', 'Questions about the interviewer\'s experience or the firm\'s direction', 'Not answerable from the website'],
      traps: ['"No questions"', 'Salary or holiday questions', 'Questions answered on the firm\'s website'],
      probes: ['Anything else you would like to ask?', 'Why does that matter to you?'],
      shape: 'Research-based question -> genuine interest -> follow-up.',
      qs: ['Do you have any questions for me?', 'Is there anything you would like to ask about {firm}?', 'What would you like to know about the training contract that you have not been able to find out?']
    }
  };
  IT.SUBS = SUBS;

  /* Flatten into individual questions with stable ids. */
  const QUESTIONS = [];
  Object.keys(SUBS).forEach(sub => {
    const s = SUBS[sub];
    s.qs.forEach((text, i) => {
      QUESTIONS.push({ id: sub + '-' + (i + 1), sub, cat: s.cat, q: text });
    });
  });
  IT.QUESTIONS = QUESTIONS;
  IT.qById = id => QUESTIONS.find(q => q.id === id) || null;

  /* Questions you can drill as "quick-fire": short answers expected. */
  IT.QUICKFIRE_SUBS = ['strengths', 'weakness', 'energy', 'curveball', 'why-law', 'why-solicitor', 'culture-fit'];

  /* Sector words used to turn a commercial answer into a client-impact follow-up. */
  IT.TOPICS = [
    ['artificial intelligence', 'AI'], ['ai', 'AI'], ['tariff', 'tariffs'], ['trade war', 'trade tensions'], ['interest rate', 'interest rates'],
    ['inflation', 'inflation'], ['bank of england', 'Bank of England policy'], ['budget', 'the Budget'], ['tax', 'tax changes'],
    ['merger', 'that merger'], ['acquisition', 'that acquisition'], ['takeover', 'that takeover'], ['ipo', 'the IPO market'],
    ['listing', 'London listings'], ['private equity', 'private equity'], ['private credit', 'private credit'], ['sanction', 'sanctions'],
    ['ukraine', 'the war in Ukraine'], ['russia', 'Russia sanctions'], ['china', 'China'], ['middle east', 'Middle East tensions'],
    ['energy', 'the energy market'], ['oil', 'oil prices'], ['renewable', 'renewable energy'], ['net zero', 'net zero'], ['climate', 'climate regulation'],
    ['esg', 'ESG'], ['crypto', 'crypto regulation'], ['bitcoin', 'crypto markets'], ['stablecoin', 'stablecoins'], ['data', 'data protection'],
    ['cyber', 'cyber security'], ['retail', 'the retail sector'], ['property', 'the property market'], ['real estate', 'real estate'],
    ['housing', 'the housing market'], ['football', 'football regulation'], ['sport', 'the sports sector'], ['defence', 'defence spending'],
    ['pharma', 'the pharmaceutical sector'], ['nhs', 'healthcare'], ['water', 'the water industry'], ['thames water', 'Thames Water'],
    ['insolvency', 'insolvencies'], ['administration', 'administrations'], ['restructuring', 'restructuring'], ['bank', 'the banking sector'],
    ['regulator', 'regulation'], ['cma', 'competition regulation'], ['competition', 'competition law'], ['employment', 'employment law changes'],
    ['tech', 'the technology sector'], ['semiconductor', 'semiconductors'], ['chip', 'chip supply chains'], ['supply chain', 'supply chains'],
    ['election', 'that election'], ['trump', 'US policy'], ['us ', 'the US']
  ];
})(typeof window !== 'undefined' ? window : globalThis);
