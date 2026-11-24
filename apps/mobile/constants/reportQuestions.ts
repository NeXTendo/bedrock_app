export type ReportAnswer = 'yes' | 'no' | 'unsure';

export interface ReportQuestion {
  key: string;
  prompt: string;
}

const commonQuestions: ReportQuestion[] = [
  { key: 'issue_ongoing', prompt: 'Is the issue still happening?' },
];

const categoryQuestions: { matches: string[]; questions: ReportQuestion[] }[] = [
  {
    matches: ['pothole', 'road'],
    questions: [
      { key: 'road_blocked', prompt: 'Is the road or footpath blocked?' },
      { key: 'water_collecting', prompt: 'Is water collecting around the damaged area?' },
    ],
  },
  {
    matches: ['water', 'leak'],
    questions: [
      { key: 'leak_active', prompt: 'Is water still leaking or flowing?' },
      { key: 'access_affected', prompt: 'Is a road, footpath, or nearby property affected?' },
    ],
  },
  {
    matches: ['trash', 'waste', 'dump'],
    questions: [
      { key: 'waste_blocking_access', prompt: 'Is it blocking a road, footpath, drain, or public access?' },
      {
        key: 'hazardous_waste',
        prompt: 'From a safe distance, does it appear to include hazardous waste?',
      },
    ],
  },
  {
    matches: ['electric', 'light'],
    questions: [
      { key: 'exposed_wires', prompt: 'Are wires visibly exposed? Do not approach to check.' },
      { key: 'sparks_or_fire', prompt: 'Are there sparks or fire? Do not approach to check.' },
    ],
  },
];

export function getReportQuestions(categoryName: string | null): ReportQuestion[] {
  const normalizedName = categoryName?.toLowerCase() || '';
  const specificQuestions = categoryQuestions.find(({ matches }) =>
    matches.some(match => normalizedName.includes(match))
  )?.questions || [];

  return [...commonQuestions, ...specificQuestions];
}
