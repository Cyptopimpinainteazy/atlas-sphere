/**
 * PasswordStrengthMeter - Visual indicator for password strength
 * 
 * Evaluates password based on:
 * - Length
 * - Character variety (uppercase, lowercase, numbers, symbols)
 * - Common pattern avoidance
 */
import { useMemo } from "react";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  feedback: string[];
}

function evaluatePassword(password: string): StrengthResult {
  const feedback: string[] = [];
  let score = 0;

  // Length checks
  if (password.length === 0) {
    return {
      score: 0,
      label: "",
      color: "bg-surface-700",
      feedback: [],
    };
  }

  if (password.length < 8) {
    feedback.push("Password is too short");
  } else if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (varietyCount >= 2) score += 1;
  if (varietyCount >= 3) score += 1;
  if (varietyCount === 4 && password.length >= 12) score += 1;

  // Penalty for common patterns
  const commonPatterns = [
    /^123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /(.)\1{3,}/, // Same character repeated 4+ times
    /^[0-9]+$/, // Only numbers
    /^[a-zA-Z]+$/, // Only letters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 1);
      feedback.push("Avoid common patterns");
      break;
    }
  }

  // Cap score at 4
  score = Math.min(4, score);

  // Determine label and color
  const levels = [
    { label: "Very Weak", color: "bg-red-500" },
    { label: "Weak", color: "bg-orange-500" },
    { label: "Fair", color: "bg-yellow-500" },
    { label: "Strong", color: "bg-lime-500" },
    { label: "Very Strong", color: "bg-accent-500" },
  ];

  return {
    score,
    label: levels[score].label,
    color: levels[score].color,
    feedback,
  };
}

export default function PasswordStrengthMeter({
  password,
  className = "",
}: PasswordStrengthMeterProps) {
  const strength = useMemo(() => evaluatePassword(password), [password]);

  if (!password) return null;

  return (
    <div className={`mt-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 rounded-full transition-all duration-300 ${
              level <= strength.score ? strength.color : "bg-surface-700"
            }`}
          />
        ))}
      </div>

      {/* Label */}
      <div className="flex justify-between items-center mt-1.5">
        <span
          className={`text-xs font-medium ${
            strength.score <= 1
              ? "text-red-400"
              : strength.score === 2
              ? "text-yellow-400"
              : "text-accent-400"
          }`}
        >
          {strength.label}
        </span>

        {strength.feedback.length > 0 && (
          <span className="text-xs text-surface-500">
            {strength.feedback[0]}
          </span>
        )}
      </div>
    </div>
  );
}

export { evaluatePassword };
export type { StrengthResult };


