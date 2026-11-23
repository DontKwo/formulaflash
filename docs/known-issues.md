# Known Issues & Edge Cases

The following edge cases were evaluated by the exhaustive testing harness and documented for future optimization:

1. **Very Long Mathematical Expressions (>10k characters)**
   - **Diagnosis:** Inputting 10,000+ characters into the MathLive field triggers heavy AST canonicalization inside `@cortex-js/compute-engine`. While safe from catastrophic regex backtracking, AST parsing takes >1s on low-power devices.
   - **Status:** Mitigated with input bounds checks and timeout limits in `MathChecker`.

2. **European Comma Separators in LaTeX Environments**
   - **Diagnosis:** Inputs such as `1,5` in standard LaTeX math modes are parsed as coordinates or lists instead of decimals unless wrapped in `{}` or handled by locale decimal rules.
   - **Status:** Handled via numeric checker preprocessing; standard dot notation is recommended in formulas.

## Related Documentation

- [Project Overview](../README.md)
- [User Guide](USER_GUIDE.md)
- [Expression Language](EXPRESSION_LANGUAGE.md)
- [Developer Guide](DEVELOPMENT.md)
- [Testing Guide](testing.md)
