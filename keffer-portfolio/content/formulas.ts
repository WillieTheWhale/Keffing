// Background text: the formulas typed into the print layout (layout2d.tsx).
// Each is a real objective or update rule from machine learning, written out
// in plain Unicode (the blocks are `white-space: pre`); the Greek and math
// symbols come from the formula fonts (app/layout.tsx). Keep lines short: a
// block is ~40 characters wide.

export const formulas = {
  // Williams 1992
  reinforce: `∇θ J(θ) =
  E[ Σₜ ∇θ log πθ(aₜ | sₜ) · Gₜ ]`,

  // Shao et al. 2024 (DeepSeekMath)
  grpo: `Âᵢ = (rᵢ − mean(r)) / std(r)
J(θ) = E[ 1/G Σᵢ 1/|oᵢ| Σₜ (
  min(ρᵢ,ₜ Âᵢ, clip(ρᵢ,ₜ, 1−ε, 1+ε) Âᵢ)
  − β KL[πθ ‖ πref] ) ]`,
} as const;

export type FormulaId = keyof typeof formulas;
