export interface DomainConstraint {
  type: 'non-zero' | 'non-negative' | 'positive';
  expr: string;
  variable: string;
  description: string;
}

export interface DomainCheckResult {
  compatible: boolean;
  conditional: boolean;
  notes?: string;
  constraints: DomainConstraint[];
}

/**
 * Extracts domain constraints from a LaTeX expression.
 */
export function extractDomainConstraints(latex: string): DomainConstraint[] {
  const constraints: DomainConstraint[] = [];
  if (!latex) return constraints;

  // 1. Fractions: denominator != 0
  const fracRegex = /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = fracRegex.exec(latex)) !== null) {
    const denom = match[2].trim();
    if (denom && !/^-?\d+(?:\.\d+)?$/.test(denom)) {
      const vars = extractVariableNames(denom);
      for (const v of vars) {
        constraints.push({
          type: 'non-zero',
          expr: denom,
          variable: v,
          description: `${denom} \\neq 0`,
        });
      }
    }
  }

  // 2. Square roots: radicand >= 0
  const sqrtRegex = /\\sqrt(?:\s*\[[^{}[\]]+\])?\s*\{([^{}]+)\}/g;
  while ((match = sqrtRegex.exec(latex)) !== null) {
    const radicand = match[1].trim();
    if (radicand && !/^\d+(?:\.\d+)?$/.test(radicand)) {
      const vars = extractVariableNames(radicand);
      for (const v of vars) {
        constraints.push({
          type: 'non-negative',
          expr: radicand,
          variable: v,
          description: `${radicand} \\geq 0`,
        });
      }
    }
  }

  // 3. Logarithms: argument > 0
  const logRegex = /\\(?:ln|log)(?:\s*_\s*\{[^{}]+\}|\s*_[a-zA-Z0-9]+)?\s*\{([^{}]+)\}/g;
  while ((match = logRegex.exec(latex)) !== null) {
    const arg = match[1].trim();
    if (arg) {
      const vars = extractVariableNames(arg);
      for (const v of vars) {
        constraints.push({
          type: 'positive',
          expr: arg,
          variable: v,
          description: `${arg} > 0`,
        });
      }
    }
  }

  // Deduplicate constraints
  const seen = new Set<string>();
  return constraints.filter((c) => {
    const key = `${c.type}:${c.expr}:${c.variable}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extracts free variable names from an expression fragment.
 */
export function extractVariableNames(fragment: string): string[] {
  const vars = new Set<string>();
  const tokenRegex = /(?:\\[a-zA-Z]+|[a-zA-Z])/g;
  let m: RegExpExecArray | null;
  const reserved = new Set([
    '\\frac', '\\sqrt', '\\ln', '\\log', '\\sin', '\\cos', '\\tan',
    '\\cdot', '\\times', '\\partial', '\\nabla', '\\pi', '\\left', '\\right',
    '\\mathrm', '\\text', '\\mathbf', '\\hat', '\\bar', '\\vec', '\\dot',
  ]);

  while ((m = tokenRegex.exec(fragment)) !== null) {
    const tok = m[0];
    if (!reserved.has(tok)) {
      const clean = tok.startsWith('\\') ? tok.slice(1) : tok;
      vars.add(clean);
    }
  }
  return Array.from(vars);
}

/**
 * Checks domain compatibility between two LaTeX expressions.
 */
export function checkDomainCompatibility(givenLatex: string, expectedLatex: string): DomainCheckResult {
  const givenConstraints = extractDomainConstraints(givenLatex);
  const expectedConstraints = extractDomainConstraints(expectedLatex);

  const allConstraints = [...givenConstraints];
  for (const ec of expectedConstraints) {
    if (!allConstraints.some((gc) => gc.type === ec.type && gc.expr === ec.expr)) {
      allConstraints.push(ec);
    }
  }

  const givenDescriptions = new Set(givenConstraints.map((c) => c.description));
  const expectedDescriptions = new Set(expectedConstraints.map((c) => c.description));

  const differences = [
    ...givenConstraints.filter((c) => !expectedDescriptions.has(c.description)),
    ...expectedConstraints.filter((c) => !givenDescriptions.has(c.description)),
  ];

  if (differences.length === 0) {
    return {
      compatible: true,
      conditional: allConstraints.length > 0,
      notes: allConstraints.length > 0 ? `Valid for ${allConstraints.map((c) => c.description).join(', ')}` : undefined,
      constraints: allConstraints,
    };
  }

  return {
    compatible: false,
    conditional: true,
    notes: `Conditional equivalence subject to domain: ${differences.map((d) => d.description).join(', ')}`,
    constraints: allConstraints,
  };
}
