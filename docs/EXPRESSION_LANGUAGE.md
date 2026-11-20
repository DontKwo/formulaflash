# Formula Flash Expression Language & Equivalence Specification

## 1. System Scope & Guarantees
Formula Flash provides an answer checker for mathematical flashcards across STEM disciplines.
The evaluator supports a defined expression language. It is not a general automated theorem prover.

Equivalence checks operate through four distinct evaluation tiers:
1. **Tier 1 (Normalized String):** Exact syntactic match after whitespace, delimiter, and macro normalization.
2. **Tier 2 (Structural AST):** Canonical MathJSON comparison and equation side-swap equality ($A = B \iff B = A$).
3. **Tier 3 (Algebraic Equivalence):** Symbolic reduction, factoring, expansion, and trigonometric/exponential identity checks for expressions.
4. **Tier 4 (Equation Rearrangement):** Bidirectional symbolic solution substitution and manifold solution-set sampling for rearranged equations (such as $PV = nRT \iff P = \frac{nRT}{V} \iff PV - nRT = 0$).

When an expression cannot be proven equivalent or refuted by counterexample, the evaluator returns an explicit `indeterminate` verdict.

## 2. Supported Grammar & Syntax

### Operators
- Arithmetic: `+`, `-`, `\cdot`, `\times`, `/`, `\frac{a}{b}`
- Powers: `x^n`, `x^{ab}`
- Radicals: `\sqrt{x}`, `\sqrt[n]{x}`
- Relations: `=`, `\leq`, `\geq`, `<`, `>`
- Signs: `\pm`, `\mp`

### Standard Functions
- Trigonometric: `\sin`, `\cos`, `\tan`, `\sec`, `\csc`, `\cot`
- Inverse trigonometric: `\arcsin`, `\arccos`, `\arctan`
- Exponential: `e^x`, `\exp(x)`
- Logarithmic: `\ln(x)`, `\log(x)`, `\log_{b}(x)`
- Absolute value: `|x|`, `\left|x\right|`

### Constants & Identifiers
- Constants: `\pi`, `e`
- Single Latin letters: `a` through `z`, `A` through `Z`
- Greek letters: `\alpha` through `\omega`, `\Alpha` through `\Omega`
- Decorated symbols: `\hat{x}`, `\bar{x}`, `\vec{x}`, `\dot{x}`, `\ddot{x}`, `\tilde{x}`

Accented symbols (such as $\hat{\rho}$ vs $\rho$) represent distinct variables when `accentsMatter: true` (default).

## 3. Domain Assumptions & Constraints

### Real Domain Default
Evaluation operates in the real domain $\mathbb{R}$ by default:
- Radicands under even roots require non-negative values ($\sqrt{u} \implies u \ge 0$).
- Logarithm arguments require strictly positive values ($\ln(u) \implies u > 0$).
- Denominators require non-zero values ($\frac{u}{v} \implies v \ne 0$).

### Domain Restrictions & Boundary Behavior
Simplifications that discard singularities (such as $\frac{x}{x} \to 1$) carry domain constraints ($x \ne 0$).
When `strictDomains: true` is configured, expressions with differing singularity sets are rejected.
When `strictDomains: false` (default), conditional equivalences are accepted and report the domain constraint.

## 4. Proof vs Heuristics Separation

| Check Type | Method | Guarantee | Verdict Via |
|---|---|---|---|
| Normalized String | Preprocessing pipeline | Syntactic equality | `normalized` |
| Canonical AST | Structural MathJSON comparison | Exact canonical match | `structural` |
| Symbolic Simplification | Computer algebra rewrite rules | Mathematical proof | `structural` |
| Solution Substitution | Bidirectional equation solve | Exact algebraic implication | `structural` |
| Numerical Sampling | Multi-point domain-constrained evaluation | Counterexample detection | `numeric` (or refutation) |
| Unsupported / Inconclusive | Grammar limit or divergence | Inconclusive | `indeterminate` |

Numerical sampling is used exclusively to find refuting counterexamples or as an auxiliary fallback. It does not replace symbolic proof.
