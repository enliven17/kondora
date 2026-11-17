import { createHash } from "node:crypto";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const PROGRAM = new PublicKey("BoZu45xZ4HFe4bvpYaGjcaDeqPaPTKSjMGYg5xFyXSuJ");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const DELEGATION = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const VALIDATOR = new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
const MAGIC = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");
const NAMES = { init: "init_user", deposit: "deposit", withdraw: "withdraw", delegate: "delegate_user", undelegate: "undelegate_user", open: "open_position", close: "close_position", claim: "claim" };
const pda = (seeds, program = PROGRAM) => PublicKey.findProgramAddressSync(seeds, program)[0];
const seed = (s) => Buffer.from(s);
const fail = () => { throw new Error("API returned a transaction that does not match the requested action"); };

function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail();
  return BigInt(value);
}

function u64(value) {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(value);
  return data;
}

/** Validate intent before any private key sees an API-built transaction. */
export function validateTransaction(built, request, owner) {
  if (!NAMES[request.action] || request.owner !== owner.toBase58()) fail();
  if (built.layer !== "base" && built.layer !== "er") fail();
  if (["init", "deposit", "withdraw", "delegate"].includes(request.action) && built.layer !== "base") fail();
  if (request.action === "undelegate" && built.layer !== "er") fail();
  if (typeof built.transaction !== "string" || built.transaction.length > 1644) fail();
  const tx = Transaction.from(Buffer.from(built.transaction, "base64"));
  if (!tx.feePayer?.equals(owner) || tx.instructions.length !== 1 || tx.signatures.length !== 1 || !tx.signatures[0].publicKey.equals(owner)) fail();
  const ix = tx.instructions[0];
  if (!ix.programId.equals(PROGRAM)) fail();
  const discriminator = createHash("sha256").update(`global:${NAMES[request.action]}`).digest().subarray(0, 8);
  if (!ix.data.subarray(0, 8).equals(discriminator)) fail();
  const user = pda([seed("user"), owner.toBuffer()]);
  const config = pda([seed("config")]);
  let accounts;
  let args = Buffer.alloc(0);
  switch (request.action) {
    case "init":
      accounts = [owner, user, SystemProgram.programId];
      break;
    case "deposit":
    case "withdraw": {
      const ata = pda([owner.toBuffer(), TOKEN.toBuffer(), MINT.toBuffer()], ASSOCIATED_TOKEN);
      accounts = [owner, config, user, pda([seed("vault")]), ata, TOKEN];
      const amount = integer(Math.round(Number(request.amount) * 1e6));
      if (amount === 0n) fail();
      args = u64(amount);
      break;
    }
    case "delegate":
      accounts = [owner, config, pda([seed("buffer"), user.toBuffer()]), pda([seed("delegation"), user.toBuffer()], DELEGATION), pda([seed("delegation-metadata"), user.toBuffer()], DELEGATION), user, PROGRAM, DELEGATION, SystemProgram.programId, VALIDATOR];
      break;
    case "undelegate":
      accounts = [owner, user, MAGIC, MAGIC_CONTEXT];
      break;
    case "open":
    case "close":
    case "claim": {
      const marketId = integer(Number(request.marketId));
      if (marketId === 0n) fail();
      const market = pda([seed("market"), u64(marketId)]);
      accounts = request.action === "claim" ? [owner, user, market] : [owner, config, owner, user, market, PROGRAM];
      if (request.action === "claim") break;
      if (request.side !== "yes" && request.side !== "no") fail();
      const side = Buffer.from([request.side === "yes" ? 0 : 1]);
      if (request.action === "open") {
        const margin = integer(Math.round(Number(request.margin) * 1e6));
        const leverage = integer(Math.round(Number(request.leverage ?? 1) * 10_000));
        if (margin === 0n || leverage < 10_000n || leverage > 100_000n || ix.data.length !== 33 || ix.data.readBigUInt64LE(25) === 0n) fail();
        args = Buffer.concat([side, u64(margin), u64(leverage), ix.data.subarray(25, 33)]);
      } else {
        const fraction = Number(request.fraction ?? 1);
        if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1 || ix.data.length !== 25 || ix.data.readBigUInt64LE(17) === 0n) fail();
        args = Buffer.concat([side, u64(integer(Math.round(fraction * 10_000))), ix.data.subarray(17, 25)]);
      }
      break;
    }
    default: fail();
  }
  if (!ix.data.equals(Buffer.concat([discriminator, args])) || ix.keys.length !== accounts.length || accounts.some((key, i) => !ix.keys[i].pubkey.equals(key))) fail();
  return tx;
}

/** RPC URLs are local policy, never instructions supplied by the API. */
export function rpcForLayer(layer) {
  const rpc = layer === "er" ? process.env.KONDORA_ER_RPC ?? "https://devnet-as.magicblock.app" : process.env.KONDORA_SOLANA_RPC ?? "https://api.devnet.solana.com";
  if (new URL(rpc).protocol !== "https:") throw new Error("RPC must use HTTPS");
  return rpc;
}
