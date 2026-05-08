const openRouterService = require('./openRouterService');
const { sanitizeLongText } = require('../utils/validators');

async function buildVoiceSuggestions(resumeType, answers) {
  const aiSuggestions = await generateWithOpenRouter(resumeType, answers).catch(() => null);

  if (aiSuggestions) {
    return aiSuggestions;
  }

  return buildFallbackSuggestions(resumeType, answers);
}

async function generateWithOpenRouter(resumeType, answers) {
  const content = await openRouterService.createChatCompletion([
    {
      role: 'system',
      content:
        'You are ResumeForge AI. Return only valid JSON with keys summary and atsSkills. summary must be a concise professional resume summary. atsSkills must be an array of ATS-friendly skills.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        answers,
        resumeType,
      }),
    },
  ]);

  if (!content) {
    return null;
  }

  const parsed = parseJsonFromModel(content);
  if (!parsed || !parsed.summary || !Array.isArray(parsed.atsSkills)) {
    return null;
  }

  return {
    atsSkills: parsed.atsSkills.map((skill) => sanitizeLongText(skill, 80)).filter(Boolean).slice(0, 14),
    summary: sanitizeLongText(parsed.summary, 520),
  };
}

function parseJsonFromModel(content) {
  const text = String(content || '').trim();

  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

function buildFallbackSuggestions(resumeType, answers) {
  const summary =
    resumeType === 'non-technical'
      ? buildNonTechnicalSummary(answers)
      : buildTechnicalSummary(answers);

  return {
    atsSkills: collectAtsSkills(resumeType, answers),
    summary,
  };
}

function buildTechnicalSummary(answers) {
  const name = prettifyPhrase(answers.fullName) || 'This candidate';
  const role = prettifyPhrase(answers.jobTitle) || 'software professional';
  const skills = collectLeadSkills([
    answers.skills,
    answers.tools,
    answers.projectStack,
    answers.certifications,
  ]);
  const experience = normalizeSentenceText(answers.summarySeed || answers.experienceHighlights);
  const project = normalizeSentenceText(answers.projectDescription);

  return trimSummary(
    [
      `${name} is a ${role}${skills ? ` with strengths in ${skills}` : ' with strong technical execution and problem-solving ability'}.`,
      sentenceWithPeriod(experience) ||
        'Known for building reliable products, collaborating across teams, and delivering measurable engineering impact.',
      project ? `Featured work includes ${sentenceWithPeriod(project)}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function buildNonTechnicalSummary(answers) {
  const name = prettifyPhrase(answers.fullName) || 'This candidate';
  const role = prettifyPhrase(answers.designation) || 'business professional';
  const skills = collectLeadSkills([
    answers.coreSkills,
    answers.leadershipSkills,
    answers.tools,
    answers.certifications,
  ]);
  const impact = normalizeSentenceText(answers.summarySeed || answers.kpis || answers.achievementImpact);

  return trimSummary(
    [
      `${name} is a ${role}${skills ? ` with strengths in ${skills}` : ' with strong leadership, planning, and delivery discipline'}.`,
      sentenceWithPeriod(impact) ||
        'Recognized for driving teams, stakeholder alignment, and measurable commercial or operational outcomes.',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function collectAtsSkills(resumeType, answers) {
  const sourceText = Object.values(answers).join(' ');
  const explicitSkills = splitSkillLike([
    answers.skills,
    answers.tools,
    answers.softSkills,
    answers.certifications,
    answers.coreSkills,
    answers.leadershipSkills,
    answers.languages,
    answers.projectStack,
  ].filter(Boolean).join(', ')).map(prettifySkillToken);

  const knownKeywords = (resumeType === 'non-technical' ? NONTECH_ATS_KEYWORDS : TECH_ATS_KEYWORDS).filter(
    (keyword) => sourceText.toLowerCase().includes(keyword.toLowerCase()),
  );

  return Array.from(new Set([...explicitSkills, ...knownKeywords])).filter(Boolean).slice(0, 14);
}

function collectLeadSkills(skillInputs) {
  const skills = splitSkillLike(skillInputs.filter(Boolean).join(', ')).slice(0, 4).map(prettifySkillToken);

  if (skills.length <= 1) {
    return skills[0] || '';
  }

  return `${skills.slice(0, -1).join(', ')}, and ${skills[skills.length - 1]}`;
}

function splitSkillLike(value) {
  return String(value || '')
    .replace(/\band\b/gi, ',')
    .split(/[,\n/;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSentenceText(value) {
  const cleaned = sanitizeLongText(value, 420).replace(/^[-*]\s*/, '');
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
}

function sentenceWithPeriod(value) {
  const cleaned = String(value || '').trim();
  if (!cleaned) {
    return '';
  }

  return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
}

function prettifyPhrase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lowerWord = word.toLowerCase();
      if (KNOWN_SKILL_CASES[lowerWord]) {
        return KNOWN_SKILL_CASES[lowerWord];
      }
      if (/[A-Z]/.test(word.slice(1))) {
        return word;
      }
      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(' ');
}

function prettifySkillToken(value) {
  const lowerValue = String(value || '').trim().toLowerCase();
  if (!lowerValue) {
    return '';
  }
  if (KNOWN_SKILL_CASES[lowerValue]) {
    return KNOWN_SKILL_CASES[lowerValue];
  }
  if (/^[a-z]{1,4}$/.test(lowerValue)) {
    return lowerValue.toUpperCase();
  }
  return prettifyPhrase(lowerValue);
}

function trimSummary(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 520);
}

const KNOWN_SKILL_CASES = {
  agile: 'Agile',
  aws: 'AWS',
  azure: 'Azure',
  crm: 'CRM',
  css: 'CSS',
  docker: 'Docker',
  figma: 'Figma',
  github: 'GitHub',
  git: 'Git',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  jira: 'Jira',
  kpi: 'KPI',
  kubernetes: 'Kubernetes',
  linkedin: 'LinkedIn',
  linux: 'Linux',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  'node.js': 'Node.js',
  postgresql: 'PostgreSQL',
  python: 'Python',
  react: 'React',
  rest: 'REST',
  sap: 'SAP',
  seo: 'SEO',
  sql: 'SQL',
  tableau: 'Tableau',
  typescript: 'TypeScript',
  ui: 'UI',
  ux: 'UX',
};

const TECH_ATS_KEYWORDS = [
  'Agile',
  'AWS',
  'Azure',
  'CI/CD',
  'Docker',
  'Git',
  'Java',
  'JavaScript',
  'Kubernetes',
  'Linux',
  'MongoDB',
  'MySQL',
  'Node.js',
  'PostgreSQL',
  'Python',
  'React',
  'REST APIs',
  'TypeScript',
];

const NONTECH_ATS_KEYWORDS = [
  'Analytics',
  'Budgeting',
  'Business Development',
  'CRM',
  'Digital Marketing',
  'Google Analytics',
  'KPI Tracking',
  'Leadership',
  'Negotiation',
  'Operations',
  'P&L Management',
  'Salesforce',
  'Stakeholder Management',
  'Strategic Planning',
  'Tableau',
  'Team Management',
];

module.exports = {
  buildVoiceSuggestions,
};
