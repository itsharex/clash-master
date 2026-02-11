/**
 * Base Repository Class
 * 
 * Provides common database operations and utilities for all repositories.
 * All specific repositories should extend this class.
 */
import type Database from 'better-sqlite3';

export abstract class BaseRepository {
  protected db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Convert a Date to minute key format (YYYY-MM-DDTHH:MM:00)
   */
  protected toMinuteKey(date: Date): string {
    return `${date.toISOString().slice(0, 16)}:00`;
  }

  /**
   * Convert a Date to hour key format (YYYY-MM-DDTHH:00:00)
   */
  protected toHourKey(date: Date): string {
    return `${date.toISOString().slice(0, 13)}:00:00`;
  }

  /**
   * Parse minute range from start and end ISO strings
   */
  protected parseMinuteRange(
    start?: string,
    end?: string,
  ): { startMinute: string; endMinute: string } | null {
    if (!start || !end) {
      return null;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return null;
    }

    return {
      startMinute: this.toMinuteKey(startDate),
      endMinute: this.toMinuteKey(endDate),
    };
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  protected withTransaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Split chain string into parts
   */
  protected splitChainParts(chain: string): string[] {
    return chain
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  /**
   * Normalize flow label for comparison
   */
  protected normalizeFlowLabel(label: string): string {
    return label
      .normalize("NFKC")
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Find rule index in chain parts
   */
  protected findRuleIndexInChain(chainParts: string[], rule: string): number {
    const exactIndex = chainParts.findIndex((part) => part === rule);
    if (exactIndex !== -1) {
      return exactIndex;
    }

    const normalizedRule = this.normalizeFlowLabel(rule);
    if (!normalizedRule) {
      return -1;
    }

    return chainParts.findIndex(
      (part) => this.normalizeFlowLabel(part) === normalizedRule,
    );
  }

  /**
   * Get the first hop from a chain
   */
  protected getChainFirstHop(chain: string): string {
    const parts = this.splitChainParts(chain);
    return parts[0] || chain;
  }

  /**
   * Build a normalized rule flow path in "rule -> ... -> proxy" order
   */
  protected buildRuleFlowPath(rule: string, chain: string): string[] {
    const chainParts = this.splitChainParts(chain);
    if (chainParts.length === 0) {
      return [];
    }

    const ruleIndex = this.findRuleIndexInChain(chainParts, rule);
    if (ruleIndex !== -1) {
      // Full chain stored as proxy > ... > rule, reverse to rule > ... > proxy.
      return chainParts.slice(0, ruleIndex + 1).reverse();
    }

    // Fallback for mismatched labels or minute_dim rows:
    // normalize direction to rule/group -> ... -> proxy.
    const reversed = [...chainParts].reverse();
    const normalizedRule = this.normalizeFlowLabel(rule);
    const normalizedHead = this.normalizeFlowLabel(reversed[0] || "");
    if (normalizedRule && normalizedRule === normalizedHead) {
      return reversed;
    }

    return [rule, ...reversed];
  }

  /**
   * Get unique non-empty values from an array
   */
  protected uniqueNonEmpty(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of values) {
      const v = (raw || "").trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  /**
   * Allocate a total value by weights
   */
  protected allocateByWeights(total: number, weights: number[]): number[] {
    if (weights.length === 0) return [];
    const sum = weights.reduce((acc, w) => acc + w, 0);
    if (sum <= 0) {
      const base = Math.floor(total / weights.length);
      const result = new Array(weights.length).fill(base);
      let remainder = total - base * weights.length;
      for (let i = 0; i < result.length && remainder > 0; i++, remainder--) {
        result[i] += 1;
      }
      return result;
    }

    const raw = weights.map(w => (total * w) / sum);
    const floored = raw.map(v => Math.floor(v));
    let remainder = total - floored.reduce((acc, v) => acc + v, 0);
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
      floored[order[k].i] += 1;
    }
    return floored;
  }
}
