// loru/packages/clepo/util.ts

/**
 * Utility functions for clepo.
 * @module
 */

/**
 * Computes the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions,
 * or substitutions) needed to transform one string into the other.
 *
 * @param a The first string.
 * @param b The second string.
 * @returns The edit distance between the two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  // Quick exits
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  if (a === b) return 0;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array.from({ length: aLen + 1 }, () => Array(bLen + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= aLen; i++) {
    matrix[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= bLen; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Finds the closest match to a target string from a list of candidates.
 * Uses Levenshtein distance to determine similarity.
 *
 * @param target The string to match.
 * @param candidates A list of possible matches.
 * @param maxDistance The maximum edit distance to consider a match (default: 3).
 * @returns The closest matching string, or undefined if no match is within the threshold.
 */
export function findClosestMatch(
  target: string,
  candidates: string[],
  maxDistance = 3,
): string | undefined {
  if (candidates.length === 0) return undefined;

  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(
      target.toLowerCase(),
      candidate.toLowerCase(),
    );

    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Finds all close matches to a target string from a list of candidates.
 * Useful when you want to show multiple suggestions.
 *
 * @param target The string to match.
 * @param candidates A list of possible matches.
 * @param maxDistance The maximum edit distance to consider a match (default: 3).
 * @param limit Maximum number of suggestions to return (default: 3).
 * @returns An array of close matches, sorted by distance (closest first).
 */
export function findCloseMatches(
  target: string,
  candidates: string[],
  maxDistance = 3,
  limit = 3,
): string[] {
  if (candidates.length === 0) return [];

  const matches: Array<{ candidate: string; distance: number }> = [];

  for (const candidate of candidates) {
    const distance = levenshteinDistance(
      target.toLowerCase(),
      candidate.toLowerCase(),
    );

    if (distance <= maxDistance) {
      matches.push({ candidate, distance });
    }
  }

  // Sort by distance and return the candidates
  return matches
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((m) => m.candidate);
}
