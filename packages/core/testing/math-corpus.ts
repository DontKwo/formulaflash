export interface CorpusCase {
  reference: string;
  accept: Array<string | { given: string; options?: Record<string, unknown> }>;
  reject: Array<string | { given: string; options?: Record<string, unknown> }>;
}

export const mathCorpus: CorpusCase[] = [
  {
    reference: 'PV = nRT',
    accept: [
      'PV=nRT',
      'nRT=PV',
      'P V = n R T',
      'P=\\frac{nRT}{V}',
      'V=\\frac{nRT}{P}',
      'PV-nRT=0',
      'nRT-PV=0',
    ],
    reject: [
      'P=nRT',
      'PV=nR',
      'PV=nRT^2',
      'PV=nrT',
      'PV=nRt',
      'P=nRT/V^2',
    ],
  },
  {
    reference: 'P = \\hat{\\rho} R T',
    accept: [
      'P=\\hat{\\rho}RT',
      'P=R T\\hat{\\rho}',
      '\\hat{\\rho}RT=P',
      '\\frac{P}{\\hat{\\rho}}=RT',
      { given: 'P=\\rho RT', options: { accentsMatter: false } },
    ],
    reject: [
      'P=\\rho RT',
      'P=\\hat{\\rho}R',
      'P=\\bar{\\rho}RT',
    ],
  },
  {
    reference: 'E = \\frac{1}{2} m v^{2}',
    accept: [
      'E=\\frac12mv^2',
      'E=\\frac{mv^2}{2}',
      '2E=mv^2',
      'E=0.5mv^2',
    ],
    reject: [
      'E=mv^2',
      'E=\\frac12 m v',
      'E=\\frac12 m^2 v',
      'E=\\frac14 m v^2',
    ],
  },
  {
    reference: '\\Delta G = \\Delta H - T\\Delta S',
    accept: [
      '\\Delta G=\\Delta H-T\\Delta S',
      '\\Delta G=\\Delta H-\\Delta S T',
      '\\Delta H=\\Delta G+T\\Delta S',
      '\\Delta H-T\\Delta S=\\Delta G',
    ],
    reject: [
      '\\Delta G=\\Delta H+T\\Delta S',
      'G=H-TS',
      '\\Delta G=\\Delta H-T',
    ],
  },
  {
    reference: 'x = \\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
    accept: [
      'x = \\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
    ],
    reject: [
      'x = \\frac{-b\\pm\\sqrt{b^2-4ac}}{a}',
      'x = \\frac{b\\pm\\sqrt{b^2-4ac}}{2a}',
    ],
  },
  // Identities and factoring expressions
  {
    reference: 'x^2 - 1',
    accept: [
      '(x-1)(x+1)',
      '(x+1)(x-1)',
      'x^2 - 1',
    ],
    reject: [
      'x^2 + 1',
      '(x-1)^2',
      'x - 1',
    ],
  },
  {
    reference: '\\sin^2(x) + \\cos^2(x)',
    accept: [
      '1',
      '\\cos^2(x) + \\sin^2(x)',
    ],
    reject: [
      '0',
      '\\sin(x) + \\cos(x)',
      '2',
    ],
  },
  {
    reference: 'e^{a+b}',
    accept: [
      'e^a e^b',
      'e^b e^a',
      'e^{b+a}',
    ],
    reject: [
      'e^a + e^b',
      'e^{ab}',
    ],
  },
  // Domain constraints: x/x vs 1
  {
    reference: '\\frac{x}{x}',
    accept: [
      '1',
      '\\frac{x}{x}',
    ],
    reject: [
      '0',
      'x',
      { given: '1', options: { strictDomains: true } },
    ],
  },
];
