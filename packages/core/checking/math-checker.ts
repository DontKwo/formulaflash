import { ComputeEngine, solve, type Expression } from '@cortex-js/compute-engine';
import type { AnswerChecker, Verdict } from './types.js';
import { preprocessLatex, type PreprocessOptions } from '../math/preprocess.js';
import { checkDomainCompatibility } from '../math/domain.js';

export interface MathCheckerOptions extends PreprocessOptions {
  allowTier1?: boolean;
  allowTier2?: boolean;
  allowTier3?: boolean;
  allowTier4?: boolean;
  allowSideSwap?: boolean;
  allowNumericFallback?: boolean;
  strictDomains?: boolean;
  sampleCount?: number;
  tolerance?: number;
}

function getOps(expr: Expression): readonly Expression[] | undefined {
  return (expr as unknown as { ops?: readonly Expression[] }).ops;
}

function getNumericValue(expr: Expression): unknown {
  return (expr as unknown as { numericValue?: unknown }).numericValue;
}

function getSymbols(expr: Expression): readonly string[] | undefined {
  const syms = (expr as unknown as { symbols?: readonly string[] | Record<string, string> }).symbols;
  if (Array.isArray(syms)) return syms;
  return undefined;
}

function toPrimitiveNumber(expr: Expression): number | null {
  try {
    const evaluated = expr.evaluate();
    const nv = getNumericValue(evaluated) ?? getNumericValue(evaluated.N());
    if (typeof nv === 'number') return Number.isFinite(nv) ? nv : null;
    if (nv !== undefined && nv !== null) {
      const num = Number(nv);
      return Number.isFinite(num) ? num : null;
    }
    const val = Number(evaluated.json);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export class MathChecker implements AnswerChecker {
  readonly id = 'math';
  private ce: ComputeEngine;

  constructor(ce?: ComputeEngine) {
    this.ce = ce ?? new ComputeEngine();
  }

  check(given: string, expected: string, options?: Record<string, unknown>): Verdict {
    const opts: MathCheckerOptions = {
      allowTier1: true,
      allowTier2: true,
      allowTier3: true,
      allowTier4: true,
      allowSideSwap: true,
      allowNumericFallback: true,
      accentsMatter: true,
      greekVariantsEqual: true,
      strictDomains: false,
      sampleCount: 16,
      tolerance: 1e-7,
      ...options,
    };

    if (!given || !expected) {
      return { correct: false, via: 'normalized', message: 'Empty expression' };
    }

    if (given === expected) {
      return { correct: true, via: 'exact' };
    }

    const preprocessedGiven = preprocessLatex(given, opts);
    const preprocessedExpected = preprocessLatex(expected, opts);

    // Tier 1: Normalized string comparison
    if (opts.allowTier1) {
      const sGiven = preprocessedGiven.replace(/\s+/g, '');
      const sExpected = preprocessedExpected.replace(/\s+/g, '');
      if (sGiven === sExpected) {
        return { correct: true, via: 'normalized' };
      }
    }

    let givenExpr: Expression;
    let expectedExpr: Expression;

    try {
      givenExpr = this.ce.parse(preprocessedGiven).canonical;
      expectedExpr = this.ce.parse(preprocessedExpected).canonical;
    } catch {
      return { correct: false, via: 'indeterminate', message: 'Unable to parse mathematical expression' };
    }

    // Check domain constraints if strictDomains is enabled
    if (opts.strictDomains) {
      const domainResult = checkDomainCompatibility(preprocessedGiven, preprocessedExpected);
      if (!domainResult.compatible) {
        return { correct: false, via: 'structural', message: domainResult.notes };
      }
    }

    // Tier 2: Structural AST comparison
    if (opts.allowTier2) {
      if (givenExpr.isSame(expectedExpr)) {
        return { correct: true, via: 'structural' };
      }

      // Equation side-swap: A = B equals B = A
      if (opts.allowSideSwap && this.isEqualExpr(givenExpr) && this.isEqualExpr(expectedExpr)) {
        const gOps = getOps(givenExpr);
        const eOps = getOps(expectedExpr);
        if (gOps && eOps && gOps.length === 2 && eOps.length === 2) {
          if (gOps[0].isSame(eOps[1]) && gOps[1].isSame(eOps[0])) {
            return { correct: true, via: 'structural' };
          }
        }
      }
    }

    const isGivenEq = this.isEqualExpr(givenExpr);
    const isExpectedEq = this.isEqualExpr(expectedExpr);

    // Guard: one is equation and the other is expression
    if (isGivenEq !== isExpectedEq) {
      return { correct: false, via: 'structural', message: 'Equation vs expression mismatch' };
    }

    // Tier 4: Equation equivalence (rearrangements)
    if (opts.allowTier4 && isGivenEq && isExpectedEq) {
      const eqVerdict = this.checkEquationEquivalence(givenExpr, expectedExpr, opts);
      if (eqVerdict.correct || eqVerdict.via === 'indeterminate' || eqVerdict.via === 'numeric') {
        return eqVerdict;
      }
    }

    // Tier 3: Algebraic equivalence for expressions
    if (opts.allowTier3 && !isGivenEq && !isExpectedEq) {
      const exprVerdict = this.checkExpressionEquivalence(givenExpr, expectedExpr, opts);
      if (exprVerdict.correct || exprVerdict.via === 'indeterminate' || exprVerdict.via === 'numeric') {
        return exprVerdict;
      }
    }

    return { correct: false, via: 'structural' };
  }

  private checkExpressionEquivalence(
    given: Expression,
    expected: Expression,
    opts: MathCheckerOptions
  ): Verdict {
    // 1. Symbolic simplification comparison
    try {
      const givenSimp = given.simplify();
      const expectedSimp = expected.simplify();
      if (givenSimp.isSame(expectedSimp)) {
        return { correct: true, via: 'structural' };
      }

      // 2. Symbolic difference simplification (given - expected === 0)
      const diff = this.ce.box(['Subtract', given, expected]).simplify();
      const diffNum = toPrimitiveNumber(diff);
      if (diff.isSame(this.ce.box(0)) || diffNum === 0) {
        return { correct: true, via: 'structural' };
      }
    } catch {
      // Continue to numeric verification
    }

    // 3. Variable set inspection
    const givenVars = this.getFreeVariables(given);
    const expectedVars = this.getFreeVariables(expected);
    if (!this.setsEqual(givenVars, expectedVars)) {
      return { correct: false, via: 'structural', message: 'Variables do not match' };
    }

    // 4. Numerical sampling / counterexample search
    if (opts.allowNumericFallback) {
      return this.sampleExpressionEquivalence(given, expected, givenVars, opts);
    }

    return { correct: false, via: 'structural' };
  }

  private checkEquationEquivalence(
    given: Expression,
    expected: Expression,
    opts: MathCheckerOptions
  ): Verdict {
    const givenVars = this.getFreeVariables(given);
    const expectedVars = this.getFreeVariables(expected);

    // Guard: variable sets must match
    if (!this.setsEqual(givenVars, expectedVars)) {
      return { correct: false, via: 'structural', message: 'Variables do not match' };
    }

    // Guard: reject trivial tautologies like 0 = 0 unless expected is also tautology
    if (givenVars.size === 0 && expectedVars.size > 0) {
      return { correct: false, via: 'structural', message: 'Degenerate equation' };
    }

    const gOps = getOps(givenExprOrDefault(given));
    const eOps = getOps(expected);
    if (!gOps || !eOps || gOps.length !== 2 || eOps.length !== 2) {
      return { correct: false, via: 'structural' };
    }

    // 1. Check difference equation (A - B) vs (C - D)
    try {
      const diffG = this.ce.box(['Subtract', gOps[0], gOps[1]]).simplify();
      const diffE = this.ce.box(['Subtract', eOps[0], eOps[1]]).simplify();

      if (diffG.isSame(diffE)) {
        return { correct: true, via: 'structural' };
      }

      const diffSum = this.ce.box(['Add', diffG, diffE]).simplify();
      const sumNum = toPrimitiveNumber(diffSum);
      if (diffSum.isSame(this.ce.box(0)) || sumNum === 0) {
        return { correct: true, via: 'structural' };
      }

      const diffDiff = this.ce.box(['Subtract', diffG, diffE]).simplify();
      const diffDiffNum = toPrimitiveNumber(diffDiff);
      if (diffDiff.isSame(this.ce.box(0)) || diffDiffNum === 0) {
        return { correct: true, via: 'structural' };
      }

      const ratio = this.ce.box(['Divide', diffG, diffE]).simplify();
      const ratioNum = toPrimitiveNumber(ratio);
      if (ratioNum !== null && ratioNum !== 0) {
        return { correct: true, via: 'structural' };
      }
    } catch {
      // Continue to solve-based check
    }

    // 2. Symbolic solve & substitution
    try {
      for (const v of givenVars) {
        const solutionsRaw = solve(expected, v);
        if (Array.isArray(solutionsRaw) && solutionsRaw.length > 0) {
          for (const item of solutionsRaw) {
            if (!item || typeof item !== 'object' || !('isSame' in item)) continue;
            const sol = item as unknown as Expression;
            const solSymbols = getSymbols(sol) ?? [];
            if (givenVars.size > 1 && solSymbols.length === 0) {
              continue;
            }
            const sub = given.subs({ [v]: sol });
            const subOps = getOps(sub);
            if (subOps && subOps.length === 2) {
              const leftSimp = subOps[0].simplify();
              const rightSimp = subOps[1].simplify();
              const subDiff = this.ce.box(['Subtract', leftSimp, rightSimp]).simplify();
              const diffNum = toPrimitiveNumber(subDiff);
              if (leftSimp.isSame(rightSimp) || subDiff.isSame(this.ce.box(0)) || diffNum === 0) {
                // Verify reverse direction to ensure bidirectional implication
                const reverseRaw = solve(given, v);
                if (Array.isArray(reverseRaw) && reverseRaw.length > 0) {
                  for (const rItem of reverseRaw) {
                    if (!rItem || typeof rItem !== 'object' || !('isSame' in rItem)) continue;
                    const revSol = rItem as unknown as Expression;
                    const revSymbols = getSymbols(revSol) ?? [];
                    if (givenVars.size > 1 && revSymbols.length === 0) {
                      continue;
                    }
                    const revSub = expected.subs({ [v]: revSol });
                    const revOps = getOps(revSub);
                    if (revOps && revOps.length === 2) {
                      const rLeft = revOps[0].simplify();
                      const rRight = revOps[1].simplify();
                      const rDiff = this.ce.box(['Subtract', rLeft, rRight]).simplify();
                      const rDiffNum = toPrimitiveNumber(rDiff);
                      if (rLeft.isSame(rRight) || rDiff.isSame(this.ce.box(0)) || rDiffNum === 0) {
                        return { correct: true, via: 'structural' };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      // Continue to numerical manifold sampling
    }

    // 3. Numerical solution manifold sampling
    if (opts.allowNumericFallback) {
      return this.sampleEquationEquivalence(given, expected, givenVars, opts);
    }

    return { correct: false, via: 'structural' };
  }

  private sampleExpressionEquivalence(
    given: Expression,
    expected: Expression,
    vars: Set<string>,
    opts: MathCheckerOptions
  ): Verdict {
    const varList = Array.from(vars);
    const count = opts.sampleCount ?? 16;
    const tol = opts.tolerance ?? 1e-7;
    let testedCount = 0;

    for (let i = 0; i < count; i++) {
      const point: Record<string, number> = {};
      // Sample strictly positive numbers away from zero and integer multiples
      for (let j = 0; j < varList.length; j++) {
        point[varList[j]] = 1.35 + (i * 0.47 + j * 0.71) % 4.0;
      }

      try {
        const valG = toPrimitiveNumber(given.subs(point));
        const valE = toPrimitiveNumber(expected.subs(point));

        if (valG !== null && valE !== null) {
          testedCount++;
          const diff = Math.abs(valG - valE);
          const scale = Math.max(1, Math.abs(valG), Math.abs(valE));
          if (diff > tol * scale) {
            return { correct: false, via: 'numeric', message: 'Counterexample found' };
          }
        }
      } catch {
        return { correct: false, via: 'indeterminate', message: 'Unable to evaluate expression numerically' };
      }
    }

    if (testedCount < 3 && varList.length > 0) {
      return { correct: false, via: 'indeterminate', message: 'Insufficient evaluation points' };
    }

    return { correct: true, via: 'numeric' };
  }

  private sampleEquationEquivalence(
    given: Expression,
    expected: Expression,
    vars: Set<string>,
    opts: MathCheckerOptions
  ): Verdict {
    const varList = Array.from(vars);
    if (varList.length === 0) return { correct: false, via: 'structural' };

    const count = opts.sampleCount ?? 16;
    const tol = opts.tolerance ?? 1e-7;

    const gOps = getOps(given);
    const eOps = getOps(expected);
    if (!gOps || !eOps || gOps.length !== 2 || eOps.length !== 2) {
      return { correct: false, via: 'structural' };
    }

    // Try to solve for the first variable in expected
    const solveVar = varList[0];
    let sol: Expression | null = null;
    try {
      const raw = solve(expected, solveVar);
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && typeof item === 'object' && 'isSame' in item) {
            sol = item as unknown as Expression;
            break;
          }
        }
      }
    } catch {
      sol = null;
    }

    if (!sol) {
      return { correct: false, via: 'indeterminate', message: 'Unable to determine equation equivalence' };
    }

    const otherVars = varList.filter((v) => v !== solveVar);
    let testedCount = 0;

    for (let i = 0; i < count; i++) {
      const point: Record<string, number> = {};
      for (let j = 0; j < otherVars.length; j++) {
        point[otherVars[j]] = 1.25 + (i * 0.43 + j * 0.67) % 3.5;
      }

      try {
        const solvedVal = toPrimitiveNumber(sol.subs(point));
        if (solvedVal === null || Math.abs(solvedVal) < 1e-6) {
          continue;
        }
        point[solveVar] = solvedVal;

        const leftVal = toPrimitiveNumber(gOps[0].subs(point));
        const rightVal = toPrimitiveNumber(gOps[1].subs(point));

        if (leftVal !== null && rightVal !== null) {
          testedCount++;
          const diff = Math.abs(leftVal - rightVal);
          const scale = Math.max(1, Math.abs(leftVal), Math.abs(rightVal));
          if (diff > tol * scale) {
            return { correct: false, via: 'numeric', message: 'Counterexample found' };
          }
        }
      } catch {
        return { correct: false, via: 'indeterminate', message: 'Unable to evaluate equation numerically' };
      }
    }

    if (testedCount < 3) {
      return { correct: false, via: 'indeterminate', message: 'Insufficient evaluation points' };
    }

    return { correct: true, via: 'numeric' };
  }

  private isEqualExpr(expr: Expression): boolean {
    if (expr.operator === 'Equal') return true;
    if (Array.isArray(expr.json) && expr.json[0] === 'Equal') return true;
    return false;
  }

  private getFreeVariables(expr: Expression): Set<string> {
    const syms = getSymbols(expr);
    if (syms) {
      return new Set(syms);
    }
    return new Set<string>();
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
}

function givenExprOrDefault(expr: Expression): Expression {
  return expr;
}

export const mathChecker = new MathChecker();
