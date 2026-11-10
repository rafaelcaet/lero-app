const WALLET_KEY_STORAGE = "lero:wallet-key";

/**
 * Chave de carteira que este navegador usava antes do login existir (ou "").
 * Vai junto no cadastro para a nova conta herdar as Lerocoins já ganhas.
 */
export function readLegacyWalletKey(): string {
  try {
    const stored = localStorage.getItem(WALLET_KEY_STORAGE);
    return stored && /^[A-Za-z0-9-]{16,64}$/.test(stored) ? stored : "";
  } catch {
    return "";
  }
}
