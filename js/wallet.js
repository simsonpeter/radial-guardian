/**
 * Persistent coin balance. Survives restarts; spent on shield repairs.
 */

import { STORAGE_KEYS } from "./config.js";

export class Wallet {
  constructor() {
    this.balance = Math.max(0, Math.floor(Number(load(STORAGE_KEYS.coins)) || 0));
  }

  add(amount) {
    const n = Math.max(0, Math.floor(amount));
    if (!n) return 0;
    this.balance += n;
    persist(this.balance);
    return n;
  }

  canAfford(amount) {
    return this.balance >= amount;
  }

  spend(amount) {
    const n = Math.max(0, Math.floor(amount));
    if (this.balance < n) return false;
    this.balance -= n;
    persist(this.balance);
    return true;
  }
}

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.coins, String(value));
  } catch {
    /* ignore */
  }
}
