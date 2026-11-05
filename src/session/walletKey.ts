const WALLET_KEY_STORAGE = "lero:wallet-key";

/**
 * Chave da carteira de Lerocoins deste navegador. Gerada na primeira visita e
 * guardada no localStorage; sem armazenamento, vale só nesta aba.
 */
export function loadWalletKey(): string {
  try {
    const stored = localStorage.getItem(WALLET_KEY_STORAGE);
    if (stored && /^[A-Za-z0-9-]{16,64}$/.test(stored)) return stored;
    const key = crypto.randomUUID();
    localStorage.setItem(WALLET_KEY_STORAGE, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}
