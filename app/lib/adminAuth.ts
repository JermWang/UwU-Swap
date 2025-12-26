import { getAdminSessionWallet, getAllowedAdminWallets } from "./adminSession";

export async function isAdminRequestAsync(req: Request): Promise<boolean> {
  const allowed = getAllowedAdminWallets();
  if (allowed.size === 0) return false;

  const wallet = await getAdminSessionWallet(req);
  if (!wallet) return false;
  return allowed.has(wallet);
}
